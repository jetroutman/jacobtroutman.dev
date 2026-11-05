// Small Notion API client shared by the sync scripts. Paced at ~3 req/s; waits on 429 as long as Notion asks.
export const TOKEN = process.env.NOTION_TOKEN;
const API = 'https://api.notion.com/v1';
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };

let last = 0;
export async function call(path, init = {}, tries = 6) {
  for (let i = 0; ; i++) {
    const wait = last + 350 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(API + path, { ...init, headers: HEADERS });
    if ((res.status === 429 || res.status >= 500) && i < tries) {
      const after = Number(res.headers.get('retry-after')) || 2 ** i;
      await new Promise((r) => setTimeout(r, (after + 1) * 1000)); continue;
    }
    if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${await res.text()}`);
    return res.json();
  }
}

// Plain text of a rich-text array. Struck-through text is dropped (Jacob strikes out retired thoughts).
export const text = (rich = []) => rich.filter((t) => !t.annotations?.strikethrough).map((t) => t.plain_text).join('').trim();

export async function allBlocks(id) {
  const out = []; let cursor;
  do {
    const r = await call(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    out.push(...r.results); cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

export async function queryAll(db, body = {}) {
  const out = []; let cursor;
  do {
    const r = await call(`/databases/${db}/query`, { method: 'POST', body: JSON.stringify({ ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }) });
    out.push(...r.results); cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

export async function relationIds(pageId, prop) {
  if (!prop) return [];
  if (prop.relation && !prop.has_more) return prop.relation.map((r) => r.id);
  const ids = []; let cursor;
  do {
    const r = await call(`/pages/${pageId}/properties/${prop.id}${cursor ? `?start_cursor=${cursor}` : ''}`);
    for (const x of r.results || []) if (x.relation?.id) ids.push(x.relation.id);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return ids;
}

export const plainId = (id) => id.replace(/-/g, '');
