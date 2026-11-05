// Pulls Jacob's Slip Box (permanent Zettelkasten notes) into src/data/notes.json.
// Everything is public unless the note's "Private" box is ticked; a private note hides everything under it.
// Without NOTION_TOKEN, or on any error, the committed file stays.
import { writeFile } from 'node:fs/promises';
import { TOKEN, call, text, allBlocks, queryAll, relationIds, plainId } from './notion.mjs';

const DB = process.env.NOTION_SLIPBOX_DB || '46c7acfec6a54287ba2f0a7bbbe9b799';
const OUT = new URL('../src/data/notes.json', import.meta.url);
if (!TOKEN) { console.log('[notes] NOTION_TOKEN not set; keeping the committed file.'); process.exit(0); }

// Note body as simple blocks: headings, paragraphs, (nested) list items, quotes, to-dos. Max 3 levels deep.
async function body(id, depth = 0) {
  const out = [];
  for (const b of await allBlocks(id)) {
    const t = b.type, d = b[t] || {}, line = text(d.rich_text);
    const kind = t.startsWith('heading_') ? 'h' : t === 'bulleted_list_item' ? 'li' : t === 'numbered_list_item' ? 'ol'
      : t === 'quote' || t === 'callout' ? 'q' : t === 'to_do' ? 'li' : t === 'paragraph' ? 'p' : null;
    if (kind && line) out.push({ k: kind, d: depth, t: line });
    if (b.has_children && depth < 3 && ['bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle', 'paragraph'].includes(t)) out.push(...await body(b.id, depth + 1));
  }
  return out;
}

try {
  const pages = await queryAll(DB);
  const all = await Promise.all(pages.map(async (p) => {
    const P = p.properties;
    return {
      id: plainId(p.id),
      title: text(P.Title?.title),
      type: P.Type?.select?.name || null,
      tags: (P.Tag?.multi_select || []).map((o) => o.name),
      private: !!P.Private?.checkbox,
      previous: (await relationIds(p.id, P.Previous)).map(plainId),
      next: (await relationIds(p.id, P.Next)).map(plainId),
      related: (await relationIds(p.id, P.Related)).map(plainId),
      sources: (await relationIds(p.id, P.Source)).map(plainId),
      created: p.created_time?.slice(0, 10) || null,
      edited: p.last_edited_time?.slice(0, 10) || null,
    };
  }));
  // Private notes, and anything that only hangs off a private note, never leave Notion.
  const hidden = new Set(all.filter((n) => n.private).map((n) => n.id));
  const fid = (t) => (t.match(/^(\d+[A-Za-z0-9]*)\s/) || [])[1] || null;
  const privateFids = all.filter((n) => n.private && fid(n.title)).map((n) => fid(n.title));
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of all) {
      if (hidden.has(n.id)) continue;
      const f = fid(n.title);
      const underPrivateFid = f && privateFids.some((pf) => f !== pf && f.startsWith(pf));
      const onlyPrivateParents = !f && n.previous.length > 0 && n.previous.every((x) => hidden.has(x));
      if (underPrivateFid || onlyPrivateParents) { hidden.add(n.id); if (f) privateFids.push(f); grew = true; }
    }
  }
  const notes = [];
  for (const n of all) {
    if (hidden.has(n.id)) continue;
    const { private: _, ...pub } = n;
    const keep = (ids) => ids.filter((x) => !hidden.has(x));
    notes.push({ ...pub, previous: keep(n.previous), next: keep(n.next), related: keep(n.related), body: await body(n.id) });
  }
  await writeFile(OUT, JSON.stringify({ source: 'notion', syncedAt: new Date().toISOString(), notes }, null, 1));
  console.log(`[notes] Synced ${notes.length} Slip Box notes (${hidden.size} kept private).`);
} catch (err) {
  console.warn(`[notes] Sync failed, keeping the committed file: ${err.message}`);
}
