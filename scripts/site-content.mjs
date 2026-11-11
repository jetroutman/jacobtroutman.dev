// Turns Notion pages from the Decision Log and Company Pages databases into the shapes in
// src/content.config.ts. Pure functions over API blocks (with `children` attached), so they can be
// tested without Notion. The editing conventions live on the "jacobtroutman.dev" page in Notion.
// Callouts are notes to Jacob and never reach the site; struck-through text is dropped.

const live = (rich = []) => rich.filter((t) => !t.annotations?.strikethrough);
export const plain = (rich = []) => live(rich).map((t) => t.plain_text).join('').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Typographic quotes, as Astro's Markdown did for case-file prose. `prev` carries the character
// before this run so a quote at a run boundary still curls the right way.
export function smart(s, prev = '') {
  let out = '';
  for (const ch of s) {
    const open = !prev || /[\s([{—–-]/.test(prev);
    if (ch === '"') out += open ? '“' : '”';
    else if (ch === "'") out += open ? '‘' : '’';
    else out += ch;
    prev = ch;
  }
  return out;
}

// Rich text → inline HTML for prose blocks: bold, italic, code and links survive; mentions become text.
export function html(rich = []) {
  let prev = '', out = '';
  for (const t of live(rich)) {
    const raw = t.plain_text;
    if (!raw) continue;
    const a = t.annotations || {};
    let s = esc(a.code ? raw : smart(raw, prev));
    prev = raw.at(-1);
    if (a.code) s = `<code>${s}</code>`;
    if (a.italic) s = `<em>${s}</em>`;
    if (a.bold) s = `<strong>${s}</strong>`;
    const href = t.href || t.text?.link?.url;
    if (href && t.type !== 'mention') s = `<a href="${esc(href)}">${s}</a>`;
    out += s;
  }
  return out.trim();
}

const prop = {
  text: (p) => plain(p?.rich_text ?? p?.title),
  select: (p) => p?.select?.name ?? null,
  multi: (p) => (p?.multi_select ?? []).map((o) => o.name),
  number: (p) => p?.number ?? null,
  check: (p) => !!p?.checkbox,
  url: (p) => p?.url || null,
  date: (p) => p?.date?.start ?? null,
  phone: (p) => p?.phone_number || null,
};

const rtOf = (b) => b[b.type]?.rich_text ?? [];
const isHeading = (b, n) => b.type === `heading_${n}`;
const isList = (b) => b.type === 'bulleted_list_item' || b.type === 'numbered_list_item';
export const slugify = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const splitLabel = (s) => { const i = s.indexOf(': '); return i < 0 ? ['', s] : [s.slice(0, i).trim(), s.slice(i + 2).trim()]; };

// A table's rows as arrays of rich-text cells, without the header row. The header is dropped when
// Notion marks it, or when the first cell is one of the names from the conventions (in case the
// "Header row" toggle got switched off).
const HEADERS = ['part', 'option', 'point', 'answer', 'you asked for', 'case'];
function tableRows(b) {
  const rows = (b.children ?? []).filter((r) => r.type === 'table_row').map((r) => r.table_row.cells);
  const first = plain(rows[0]?.[0]).toLowerCase();
  const header = b.table?.has_column_header || HEADERS.includes(first) ? rows.shift() : null;
  return { header: header?.map(plain).map((h) => h.toLowerCase()) ?? [], rows };
}

// Split the page into `##` sections. Anything above the first heading is ignored.
function sections(blocks) {
  const out = []; let cur = null;
  for (const b of blocks) {
    if (b.type === 'callout') continue;
    if (isHeading(b, 1) || isHeading(b, 2)) { cur = { title: plain(rtOf(b)), blocks: [] }; out.push(cur); continue; }
    cur?.blocks.push(b);
  }
  return out;
}

// ---------- Case files (Decision Log) ----------

const sectionId = (title) => (/interviewer/i.test(title) ? 'interviewer' : slugify(title));

function caseBlocks(list, warn) {
  const out = []; let lede = null;
  for (const b of list) {
    const t = b.type, rich = rtOf(b);
    if (t === 'quote' && lede === null && !out.length) { lede = plain(rich); continue; }
    if (t === 'paragraph') { const h = html(rich); if (h) out.push({ k: 'p', html: h }); continue; }
    if (isList(b)) {
      const k = t === 'numbered_list_item' ? 'ol' : 'ul', last = out.at(-1);
      if (last?.k === k) last.items.push(html(rich)); else out.push({ k, items: [html(rich)] });
      continue;
    }
    if (t === 'quote') { out.push({ k: 'q', html: html(rich) }); continue; }
    if (isHeading(b, 3)) { out.push({ k: 'h3', text: plain(rich) }); continue; }
    if (t === 'toggle') {
      const [label, title] = splitLabel(plain(rich));
      const body = (b.children ?? []).filter((c) => c.type === 'paragraph').map((c) => html(rtOf(c))).filter(Boolean);
      out.push({ k: 'callout', label, title, body });
      continue;
    }
    if (t === 'table') {
      const { header, rows } = tableRows(b);
      if (header[0] === 'option') {
        out.push({ k: 'options', items: rows.map(([label, verdict, title, why]) => ({
          label: plain(label), verdict: plain(verdict), chosen: /^chosen$/i.test(plain(verdict)), title: plain(title), body: html(why),
        })) });
      } else if (header[0] === 'point') {
        out.push({ k: 'points', rows: rows.map(([a, b2]) => [plain(a), plain(b2)]) });
      } else {
        out.push({ k: 'parts', rows: rows.map(([a, b2]) => [plain(a), plain(b2)]) });
      }
      continue;
    }
    if (!['divider', 'table_of_contents', 'child_page', 'child_database'].includes(t)) warn(`skipped a ${t} block`);
  }
  return { lede, blocks: out };
}

/** One Decision Log page → a `cases` entry (plus `slug`), or null with a reason. */
export function parseCase(page, blocks, warn = () => {}) {
  const P = page.properties;
  const name = prop.text(P.Name);
  const id = name.match(/^DR-\d+/i)?.[0].toUpperCase();
  if (!id) return { error: `"${name}" has no DR-nn at the start of its name` };

  const body = []; let quiz, todo = [];
  for (const s of sections(blocks)) {
    if (/^quiz\b/i.test(s.title)) {
      const question = plain(rtOf(s.blocks.find((b) => b.type === 'quote') ?? {}));
      const table = s.blocks.find((b) => b.type === 'table');
      const options = table ? tableRows(table).rows.map(([label, verdict, reply]) => ({
        label: plain(label), reply: plain(reply), chosen: /^chosen$/i.test(plain(verdict)),
      })) : [];
      if (question && options.length >= 2) quiz = { question, options };
      else warn('Quiz needs a quote (the question) and a table with at least two answers; skipped it');
      continue;
    }
    if (/^before launch\b/i.test(s.title)) { todo = s.blocks.filter(isList).map((b) => plain(rtOf(b))).filter(Boolean); continue; }
    const { lede, blocks: inner } = caseBlocks(s.blocks, warn);
    body.push({ id: sectionId(s.title), n: String(body.length + 1).padStart(2, '0'), title: s.title, ...(lede ? { lede } : {}), blocks: inner });
  }

  const entry = {
    slug: prop.text(P.Slug) || slugify(name),
    id,
    title: prop.text(P['Proof line']),
    status: prop.select(P.Status),
    stack: prop.multi(P.Stack),
    readMinutes: prop.number(P['Read minutes']) ?? 5,
    role: prop.text(P.Role),
    tldr: { problem: prop.text(P.Problem), decision: prop.text(P.Decision), outcome: prop.text(P.Outcome) },
    order: Number(id.slice(3)),
    ...(prop.url(P.App) ? { app: prop.url(P.App) } : {}),
    published: prop.check(P['Case page']),
    ...(prop.text(P.Teaser) ? { teaser: prop.text(P.Teaser) } : {}),
    ...(quiz ? { quiz } : {}),
    todo,
    body,
  };
  const missing = ['title', 'status', 'role'].filter((k) => !entry[k]).concat(Object.entries(entry.tldr).filter(([, v]) => !v).map(([k]) => k));
  if (missing.length) return { error: `${id} is missing ${missing.join(', ')}` };
  if (entry.published && !body.length) return { error: `${id} has Case page ticked but no sections` };
  return { entry };
}

// ---------- Company pages ----------

const caseIds = (rich) => [...new Set(plain(rich).toUpperCase().match(/DR-\d+/g) ?? [])];
const monthYear = (iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** One Company Pages page → a `companies` entry (plus `slug`), null for Archived, or an error. */
export function parseCompany(page, blocks, warn = () => {}) {
  const P = page.properties;
  const company = prop.text(P.Company);
  const status = prop.select(P.Status) ?? 'Draft';
  if (status === 'Archived') return { entry: null };

  const summary = [], requirements = [], evidence = [], plan = [], questions = []; let bonus;
  for (const s of sections(blocks)) {
    const key = s.title.toLowerCase();
    const tables = s.blocks.filter((b) => b.type === 'table').flatMap((b) => tableRows(b).rows);
    if (key.startsWith('intro')) {
      for (const b of s.blocks) if (b.type === 'paragraph' && plain(rtOf(b))) summary.push(plain(rtOf(b)));
    } else if (/wish|asked/.test(key)) {
      for (const [need, proof] of tables) requirements.push({ need: plain(need), cases: caseIds(proof) });
    } else if (/exhibit|evidence/.test(key)) {
      for (const [c, why] of tables) { const id = caseIds(c)[0]; if (id) evidence.push({ case: id, relevance: plain(why) }); else warn(`an Exhibits row names no DR-nn`); }
    } else if (/90|plan/.test(key)) {
      for (const b of s.blocks) {
        if (isHeading(b, 3)) { const [days, title] = splitLabel(plain(rtOf(b))); plan.push({ days, title, items: [] }); }
        else if (isList(b) && plan.length) plan.at(-1).items.push(plain(rtOf(b)));
      }
    } else if (/question/.test(key)) {
      for (const b of s.blocks) if (isList(b)) questions.push(plain(rtOf(b)));
    } else if (/locked|bonus|note/.test(key)) {
      const h = s.blocks.find((b) => isHeading(b, 3));
      const body = s.blocks.filter((b) => b.type === 'paragraph').map((b) => plain(rtOf(b))).filter(Boolean).join(' ');
      if (h && body) { const [label, title] = splitLabel(plain(rtOf(h))); bonus = { label: label || 'A note for you', title, body }; }
    } else warn(`unknown section "${s.title}"`);
  }

  const greeting = prop.text(P.Greeting), phone = prop.phone(P.Phone);
  const entry = {
    slug: prop.text(P.Slug) || slugify(company),
    company,
    role: prop.text(P['Role line']),
    date: monthYear(prop.date(P.Prepared) ?? page.created_time ?? new Date().toISOString()),
    draft: status !== 'Live',
    summary: summary.join('\n\n'),
    ...(greeting ? { greeting } : {}),
    requirements, evidence, plan, questions,
    ...(phone ? { phone } : {}),
    ...(bonus ? { bonus } : {}),
  };
  const missing = [['company', company], ['Role line', entry.role], ['Intro', entry.summary], ['Wishlist', requirements.length], ['Exhibits', evidence.length], ['First 90 days', plan.length], ['My questions', questions.length]]
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return { error: `${company || 'A page'} is missing ${missing.join(', ')}` };
  return { entry };
}
