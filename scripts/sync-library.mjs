// Pulls Jacob's Published books from the Notion Book Catalog into src/data/library.json.
// Runs before `astro build` in CI when NOTION_TOKEN is set; without it, the committed JSON is used as-is.
// Only books whose "Inspectional Reading Status" is Published are ever fetched.
import { writeFile } from 'node:fs/promises';

const TOKEN = process.env.NOTION_TOKEN;
const DB = process.env.NOTION_BOOKS_DB || '013be0b5d6394f138c9c139b85cf2358';
const OUT = new URL('../src/data/library.json', import.meta.url);
const API = 'https://api.notion.com/v1';
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };

if (!TOKEN) {
  console.log('[library] NOTION_TOKEN not set; keeping the committed snapshot.');
  process.exit(0);
}

async function call(path, init = {}, tries = 3) {
  for (let i = 0; ; i++) {
    const res = await fetch(API + path, { ...init, headers: HEADERS });
    if (res.status === 429 && i < tries) { await new Promise((r) => setTimeout(r, 1000 * (i + 1))); continue; }
    if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${await res.text()}`);
    return res.json();
  }
}

const text = (rich = []) => rich.map((t) => t.plain_text).join('').trim();
const names = (p) => (p?.multi_select || []).map((o) => o.name.replace(/^[^\p{L}\p{N}$]+/u, '').trim());

async function allBlocks(id) {
  const out = []; let cursor;
  do {
    const r = await call(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    out.push(...r.results); cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

async function relationIds(pageId, prop) {
  if (!prop) return [];
  const ids = []; let cursor;
  do {
    const r = await call(`/pages/${pageId}/properties/${prop.id}${cursor ? `?start_cursor=${cursor}` : ''}`);
    for (const x of r.results || []) if (x.relation?.id) ids.push(x.relation.id);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return ids;
}

// Quotes stay short on a public page: anything over ~60 words is cut to 50 with an ellipsis.
const trimQuote = (q) => { const w = q.split(/\s+/); return w.length > 60 ? `${w.slice(0, 50).join(' ')}…` : q; };

// A Reference Box (literature) note: "Quote" section, "Bibliography", "Interpretation" (Jacob's own words).
async function refNote(id) {
  const page = await call(`/pages/${id}`);
  const P = page.properties;
  let mode = null; const quote = [], interp = [];
  for (const b of await allBlocks(id)) {
    const t = b.type, body = b[t] || {};
    if (t.startsWith('heading_')) { const h = text(body.rich_text).toLowerCase(); mode = h.includes('quote') ? 'q' : h.includes('interpretation') ? 'i' : null; continue; }
    const line = text(body.rich_text);
    if (!line) continue;
    if (mode === 'q' && (t === 'quote' || t === 'paragraph')) quote.push(line);
    if (mode === 'i' && ['paragraph', 'bulleted_list_item', 'numbered_list_item', 'quote'].includes(t)) interp.push(t === 'paragraph' || t === 'quote' ? line : `• ${line}`);
  }
  return {
    id: id.replace(/-/g, ''),
    title: text(P.Title?.title),
    type: P['Note Type']?.select?.name || null,
    page: P.Page?.number ?? null,
    quote: quote.length ? trimQuote(quote.join(' ')) : null,
    interpretation: interp.join('\n') || null,
    created: page.created_time?.slice(0, 10) || null,
  };
}

// Book page sections (prompt callouts skipped everywhere):
//   "🚀 The Book in 3 Sentences" → review (paragraphs and bullets; an AI apology line is dropped)
//   "🎨 Impressions" → impressions (Jacob's own words)
//   "Who Should Read It?" → bullets (if a "Questions to ask yourself" list comes first, only the bullets after "Who should read this book:")
//   "☘️ How the Book Changed Me" → changed (Jacob's own words)
function extract(blocks) {
  const out = { review: [], impressions: [], who: [], changed: [] };
  let mode = null;
  for (const b of blocks) {
    const t = b.type, body = b[t] || {};
    if (t.startsWith('heading_')) {
      const h = text(body.rich_text).toLowerCase();
      mode = h.includes('3 sentences') ? 'review' : h.includes('impressions') ? 'impressions' : h.includes('who should read') ? 'who' : h.includes('changed me') ? 'changed' : null;
      continue;
    }
    if (t === 'callout' || !mode) continue;
    const line = text(body.rich_text);
    if (!line) continue;
    const bullet = t === 'bulleted_list_item' || t === 'numbered_list_item';
    if (mode === 'who') {
      if (t === 'paragraph' && /questions to ask/i.test(line)) { mode = 'whoQs'; continue; }
      if (bullet) out.who.push(line);
      continue;
    }
    if (mode === 'whoQs') { if (t === 'paragraph' && /who should read this book/i.test(line)) mode = 'who'; continue; }
    if (mode === 'review' && /^sorry,? i couldn/i.test(line)) continue;
    if (t === 'paragraph' || t === 'quote' || bullet) out[mode].push(bullet ? `• ${line}` : line);
  }
  const join = (a) => a.join('\n') || null;
  return { review: join(out.review), impressions: join(out.impressions), who: out.who, changed: join(out.changed) };
}

try {
  const pages = []; let cursor;
  do {
    const r = await call(`/databases/${DB}/query`, {
      method: 'POST',
      body: JSON.stringify({ filter: { property: 'Inspectional Reading Status', status: { equals: 'Published' } }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    pages.push(...r.results); cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);

  const books = [];
  for (const p of pages) {
    const P = p.properties;
    const { review, impressions, who, changed } = extract(await allBlocks(p.id));
    const noteIds = await relationIds(p.id, P.References);
    const notes = [];
    for (const nid of noteIds) { try { notes.push(await refNote(nid)); } catch (e) { console.warn(`[library] note ${nid}: ${e.message}`); } }
    books.push({
      id: p.id.replace(/-/g, ''),
      title: text(P.Name?.title),
      author: text(P.Author?.rich_text) || null,
      kind: P['Fiction?']?.select?.name || null,
      genres: names(P.Genres),
      topics: names(P.Topical),
      score: P['Rating Score']?.number ?? null,
      rating: P['Rating 2023']?.select?.name || null,
      finished: P['Last Read']?.date?.start || P['Date Finished (First Time)']?.date?.start || null,
      notes: notes.length || null,
      review,
      impressions,
      who,
      changed,
      refNotes: notes,
    });
  }
  await writeFile(OUT, JSON.stringify({ source: 'notion', syncedAt: new Date().toISOString(), books }, null, 1));
  console.log(`[library] Synced ${books.length} published books (${books.filter((b) => b.review).length} with reviews, ${books.reduce((n, b) => n + b.refNotes.length, 0)} notes).`);
  // Short summary for checking the sync from CI logs (all of this is public on the site anyway).
  for (const b of books.filter((x) => x.review || x.notes)) console.log(`[library]  - ${b.title.slice(0, 40)} | notes ${b.notes ?? 0} | who ${b.who.length} | imp ${b.impressions ? 'y' : 'n'} | changed ${b.changed ? 'y' : 'n'} | ${(b.review || '').slice(0, 70).replace(/\n/g, ' ')}`);
} catch (err) {
  // A Notion hiccup should never block a deploy: keep the last committed snapshot.
  console.warn(`[library] Sync failed, keeping the committed snapshot: ${err.message}`);
}
