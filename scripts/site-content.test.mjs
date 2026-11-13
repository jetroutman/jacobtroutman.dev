// Round trip: rebuild each committed snapshot entry as Notion API blocks, written the way the
// conventions on the jacobtroutman.dev page say, then check the parsers give the entry back.
// Run: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCase, parseCompany } from './site-content.mjs';

const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))[name];
const cases = load('cases'), companies = load('companies');
const names = Object.fromEntries(cases.map((c) => [c.id, `${c.id} ${c.slug.split('-').slice(2).join(' ')}`]));

// Notion stores what was typed: straight quotes, plain entities.
const unhtml = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const run = (text, bold = false) => ({ type: 'text', plain_text: text, text: { content: text, link: null }, href: null, annotations: { bold, italic: false, strikethrough: false, code: false } });
const mention = (id) => ({ type: 'mention', plain_text: names[id], href: 'https://www.notion.so/x', mention: { type: 'page', page: { id } }, annotations: { bold: false } });
const rt = (s) => [run(s)];
const rtHtml = (h) => h.split(/(<strong>.*?<\/strong>)/).filter(Boolean).map((p) => p.startsWith('<strong>') ? run(unhtml(p.slice(8, -9)), true) : run(unhtml(p)));
const blk = (type, rich, extra = {}) => ({ type, has_children: false, [type]: { rich_text: rich }, ...extra });
const h = (n, s) => blk(`heading_${n}`, rt(s));
const table = (header, rows) => ({ type: 'table', has_children: true, table: { has_column_header: true }, children: [header.map(rt), ...rows].map((cells) => ({ type: 'table_row', table_row: { cells } })) });
const shape = {
  title: (v) => ({ title: rt(v) }), text: (v) => ({ rich_text: v ? rt(v) : [] }), select: (v) => ({ select: v ? { name: v } : null }),
  multi: (v) => ({ multi_select: v.map((name) => ({ name })) }), number: (v) => ({ number: v }), check: (v) => ({ checkbox: v }),
  url: (v) => ({ url: v ?? null }), date: (v) => ({ date: v ? { start: v } : null }), phone: (v) => ({ phone_number: v ?? null }),
};
const props = (o) => Object.fromEntries(Object.entries(o).map(([k, [type, v]]) => [k, shape[type](v)]));

function caseBlocks(c) {
  const out = [blk('callout', rt('A note to self. Never published.'))];
  for (const s of c.body) {
    out.push(h(2, s.title));
    if (s.lede) out.push(blk('quote', rt(s.lede)));
    for (const b of s.blocks) {
      if (b.k === 'p') out.push(blk('paragraph', rtHtml(b.html)));
      if (b.k === 'ol' || b.k === 'ul') for (const i of b.items) out.push(blk(b.k === 'ol' ? 'numbered_list_item' : 'bulleted_list_item', rtHtml(i)));
      if (b.k === 'parts') out.push(table(['Part', 'What it does'], b.rows.map((r) => r.map(rt))));
      if (b.k === 'points') out.push(table(['Point', 'Why'], b.rows.map((r) => r.map(rt))));
      if (b.k === 'options') out.push(table(['Option', 'Verdict', 'Approach', 'Why'], b.items.map((o) => [rt(o.label), rt(o.verdict), rt(o.title), rtHtml(o.body)])));
      if (b.k === 'callout') out.push({ ...blk('toggle', rt(`${b.label}: ${b.title}`)), has_children: true, children: b.body.map((p) => blk('paragraph', rtHtml(p))) });
    }
  }
  if (c.quiz) out.push(h(2, 'Quiz'), blk('quote', rt(c.quiz.question)), table(['Answer', 'Verdict', 'Reply'], c.quiz.options.map((o) => [rt(o.label), rt(o.chosen ? 'Chosen' : ''), rt(o.reply)])));
  if (c.todo.length) out.push(h(2, 'Before launch'), ...c.todo.map((t) => blk('bulleted_list_item', rt(t))));
  return out;
}

function companyBlocks(c) {
  return [
    h(2, 'Intro'), ...c.summary.split('\n\n').map((p) => blk('paragraph', rt(p))),
    h(2, 'Wishlist'), table(['You asked for', 'Proof'], c.requirements.map((r) => [rt(r.need), r.cases.flatMap((id, i) => (i ? [run(' '), mention(id)] : [mention(id)]))])),
    h(2, 'Exhibits'), table(['Case', 'For you'], c.evidence.map((e) => [[mention(e.case)], rt(e.relevance)])),
    h(2, 'First 90 days'), ...c.plan.flatMap((p) => [h(3, `${p.days}: ${p.title}`), ...p.items.map((i) => blk('bulleted_list_item', rt(i)))]),
    h(2, 'My questions'), ...c.questions.map((q) => blk('bulleted_list_item', rt(q))),
    ...(c.bonus ? [h(2, 'Locked note'), h(3, `${c.bonus.label}: ${c.bonus.title}`), blk('paragraph', rt(c.bonus.body))] : []),
  ];
}

for (const c of cases) test(`case ${c.id}`, () => {
  const page = { properties: props({ Name: ['title', names[c.id]], 'Proof line': ['text', c.title], Status: ['select', c.status], Stack: ['multi', c.stack],
    Role: ['text', c.role], 'Read minutes': ['number', c.readMinutes], Problem: ['text', c.tldr.problem], Decision: ['text', c.tldr.decision],
    Outcome: ['text', c.tldr.outcome], Teaser: ['text', c.teaser ?? ''], 'Case page': ['check', c.published], App: ['url', c.app], Slug: ['text', c.slug] }) };
  const { entry, error } = parseCase(page, caseBlocks(c));
  assert.equal(error, undefined);
  const { notion, ...want } = c;
  assert.deepEqual(entry, want);
});

for (const c of companies) test(`company ${c.slug}`, () => {
  const page = { properties: props({ Company: ['title', c.company], Status: ['select', c.draft ? 'Draft' : 'Live'], Slug: ['text', c.slug], 'Role line': ['text', c.role],
    Greeting: ['text', c.greeting ?? ''], Prepared: ['date', `${{ Nov: '2026-11-04' }[c.date.slice(0, 3)]}`], Phone: ['phone', c.phone] }) };
  const { entry, error } = parseCompany(page, companyBlocks(c));
  assert.equal(error, undefined);
  const { notion, ...want } = c;
  assert.deepEqual(entry, want);
});

test('Archived company pages are dropped; incomplete ones report what is missing', () => {
  const page = (Status) => ({ properties: props({ Company: ['title', 'Acme'], Status: ['select', Status], Slug: ['text', 'acme-1234'], 'Role line': ['text', 'For the X role.'] }) });
  assert.deepEqual(parseCompany(page('Archived'), []), { entry: null });
  assert.match(parseCompany(page('Live'), []).error, /missing Intro, Wishlist, Exhibits, First 90 days, My questions/);
});

test('a case mention resolves by page id when the API gives it no title', () => {
  const companyPage = (c) => ({ properties: props({ Company: ['title', c.company], Status: ['select', c.draft ? 'Draft' : 'Live'], Slug: ['text', c.slug], 'Role line': ['text', c.role],
    Greeting: ['text', c.greeting ?? ''], Prepared: ['date', '2026-11-04'], Phone: ['phone', c.phone] }) });
  const c = companies.find((x) => x.evidence.length) ?? companies[0];
  const ids = Object.fromEntries(cases.map((k, i) => [k.id, `4150596e1aaa81${String(i).padStart(2, '0')}9447d46550d6915c`]));
  const byPage = new Map(Object.entries(ids).map(([id, pid]) => [pid, id]));
  const untitled = (id) => ({ type: 'mention', plain_text: 'Untitled', href: `https://www.notion.so/${ids[id]}`, mention: { type: 'page', page: { id: ids[id].replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-') } }, annotations: { bold: false } });
  const blocks = companyBlocks(c).map((b) => b.type !== 'table' ? b : { ...b, children: b.children.map((r, i) => i === 0 ? r : { ...r, table_row: { cells: r.table_row.cells.map((cell) => cell.map((t) => t.type === 'mention' ? untitled(Object.keys(names).find((k) => names[k] === t.plain_text)) : t)) } }) });
  const without = parseCompany(companyPage(c), blocks);
  assert.match(without.error ?? '', /Exhibits/);
  const { entry, error } = parseCompany(companyPage(c), blocks, () => {}, byPage);
  assert.equal(error, undefined);
  assert.deepEqual(entry.evidence.map((e) => e.case), c.evidence.map((e) => e.case));
  assert.deepEqual(entry.requirements.map((r) => r.cases), c.requirements.map((r) => r.cases));
});
