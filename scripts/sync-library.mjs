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

async function relationCount(pageId, prop) {
  if (!prop) return null;
  let n = 0, cursor;
  do {
    const r = await call(`/pages/${pageId}/properties/${prop.id}${cursor ? `?start_cursor=${cursor}` : ''}`);
    n += (r.results || []).length; cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return n || null;
}

// "🚀 The Book in 3 Sentences" → the paragraphs after it (prompt callouts skipped), until the next heading.
// "Who Should Read It?" → the bullets after the "Who should read this book:" line.
function extract(blocks) {
  let review = [], who = [], mode = null;
  for (const b of blocks) {
    const t = b.type, body = b[t] || {};
    if (t.startsWith('heading_')) {
      const h = text(body.rich_text).toLowerCase();
      mode = h.includes('3 sentences') ? 'review' : h.includes('who should read') ? 'whoIntro' : null;
      continue;
    }
    if (t === 'callout') continue;
    if (mode === 'review' && t === 'paragraph' && text(body.rich_text)) review.push(text(body.rich_text));
    if (mode === 'whoIntro' && t === 'paragraph' && /who should read this book/i.test(text(body.rich_text))) mode = 'who';
    else if (mode === 'who' && t === 'bulleted_list_item' && text(body.rich_text)) who.push(text(body.rich_text));
    else if (mode === 'who' && t === 'paragraph' && text(body.rich_text)) mode = null;
  }
  return { review: review.join('\n\n') || null, who };
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
    const { review, who } = extract(await allBlocks(p.id));
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
      notes: await relationCount(p.id, P.References),
      review,
      who,
    });
  }
  await writeFile(OUT, JSON.stringify({ source: 'notion', syncedAt: new Date().toISOString(), books }, null, 1));
  console.log(`[library] Synced ${books.length} published books (${books.filter((b) => b.review).length} with reviews).`);
} catch (err) {
  // A Notion hiccup should never block a deploy: keep the last committed snapshot.
  console.warn(`[library] Sync failed, keeping the committed snapshot: ${err.message}`);
}
