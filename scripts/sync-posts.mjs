// Pulls Jacob's Posts (story-led essays built from Slip Box cards) into src/data/posts.json.
// Every status is synced: Published posts get public pages; anything else only appears under /admin/,
// which staticwebapp.config.json locks to the admin role. A paragraph that is just a mention of a
// Slip Box card becomes a card in the post. Callouts are notes to Jacob and are skipped.
// Without NOTION_TOKEN, or on any error, the committed file stays.
import { writeFile } from 'node:fs/promises';
import { TOKEN, text, allBlocks, queryAll, relationIds, plainId } from './notion.mjs';

const DB = process.env.NOTION_POSTS_DB || '1716b4f885cd4d129faf1c72bba78c4b';
const OUT = new URL('../src/data/posts.json', import.meta.url);
if (!TOKEN) { console.log('[posts] NOTION_TOKEN not set; keeping the committed file.'); process.exit(0); }

const mentionOnly = (rich = []) => {
  const parts = rich.filter((t) => t.plain_text.trim());
  return parts.length === 1 && parts[0].type === 'mention' && parts[0].mention?.type === 'page' ? plainId(parts[0].mention.page.id) : null;
};
// Keep italics and bold as a tiny markup: *x* and **x**. Struck-through text is dropped.
const rich = (r = []) => r.filter((t) => !t.annotations?.strikethrough).map((t) => {
  let s = t.plain_text; const a = t.annotations || {};
  if (!s.trim()) return s;
  if (a.bold) s = `**${s}**`; if (a.italic) s = `*${s}*`;
  return s;
}).join('').trim();

async function body(id) {
  const out = [];
  for (const b of await allBlocks(id)) {
    const t = b.type, d = b[t] || {};
    if (t === 'callout') continue;
    const card = t === 'paragraph' ? mentionOnly(d.rich_text) : null;
    if (card) { out.push({ k: 'card', id: card }); continue; }
    const line = rich(d.rich_text);
    if (!line) continue;
    if (t.startsWith('heading_')) out.push({ k: 'h', t: line });
    else if (t === 'quote') out.push({ k: 'q', t: line });
    else if (t === 'bulleted_list_item' || t === 'numbered_list_item') out.push({ k: 'li', t: line });
    else if (t === 'paragraph') out.push({ k: 'p', t: line });
  }
  return out;
}

try {
  const pages = await queryAll(DB);
  const posts = [];
  for (const p of pages) {
    const P = p.properties;
    const title = text(P.Title?.title);
    if (!title) continue;
    posts.push({
      id: plainId(p.id), title,
      status: P.Status?.select?.name || 'Draft',
      hook: text(P.Hook?.rich_text) || null,
      published: P.Published?.date?.start || null,
      cards: (await relationIds(p.id, P.Cards)).map(plainId),
      books: (await relationIds(p.id, P.Books)).map(plainId),
      edited: p.last_edited_time?.slice(0, 10) || null,
      body: await body(p.id),
    });
    const x = posts.at(-1);
    console.log(`[posts] ${x.status.padEnd(9)} ${x.title} (${x.body.filter((b) => b.k === 'card').length} cards)`);
  }
  await writeFile(OUT, JSON.stringify({ source: 'notion', syncedAt: new Date().toISOString(), posts }, null, 1) + '\n');
  console.log(`[posts] Synced ${posts.length} posts (${posts.filter((x) => x.status === 'Published').length} published).`);
} catch (e) {
  console.warn(`[posts] Notion sync failed; keeping the committed file. ${e.message}`);
  if (/404|object_not_found/.test(e.message)) console.warn('[posts] Share the Posts database with the Notion integration (••• → Connections).');
}
