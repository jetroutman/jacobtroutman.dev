import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trackHandler } from '../src/functions/track';
import { alertText } from '../src/lib/outbox';
import { parseUpdate, recordVisit, slideName, type CompanyRows, type Store, type Summary, type TrackDeps, type VisitRow } from '../src/lib/track';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const V1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const update = (over = {}) => ({ slug: 'acme-x1', visitor: A, visit: V1, slide: 'intro', reached: 0, seen: 1, total: 8, activeMs: 2000, device: 'mouse', ...over });

class FakeStore implements Store {
  rows = new Map<string, CompanyRows>();
  private get(s: string) { if (!this.rows.has(s)) this.rows.set(s, { visits: new Map(), visitors: new Set(), summary: null }); return this.rows.get(s)!; }
  async read(s: string) { const r = this.get(s); return { visits: new Map(r.visits), visitors: new Set(r.visitors), summary: r.summary }; }
  async saveVisit(s: string, v: string, row: VisitRow) { this.get(s).visits.set(v, row); }
  async addVisitor(s: string, v: string) { const r = this.get(s); if (r.visitors.has(v)) return false; r.visitors.add(v); return true; }
  async saveSummary(s: string, sum: string) { this.get(s).summary = sum; }
}

function setup(over: Partial<TrackDeps['outbox']> = {}) {
  const store = new FakeStore(), notion: Summary[] = [], alerts: number[] = [], errors: unknown[] = [];
  const deps: TrackDeps = {
    companies: { 'acme-x1': { company: 'Acme', notion: 'page-1' } }, store,
    outbox: { updateNotion: async (_, s) => { notion.push(s); }, alert: async (_, n) => { alerts.push(n); }, ...over },
    now: () => new Date('2026-11-18T20:00:00Z'), log: (_, e) => errors.push(e),
  };
  const send = (o = {}) => recordVisit(parseUpdate(update(o))!, deps);
  return { store, notion, alerts, errors, deps, send };
}

test('a first visit is stored, alerted once and sent to Notion', async () => {
  const t = setup();
  assert.equal(await t.send(), 'recorded');
  assert.deepEqual(t.alerts, [1]);
  assert.equal(t.notion[0].visitors, 1);
  assert.equal(t.notion[0].furthest, '1 of 8 · Intro');
});

test('progress only moves forward, and an unchanged report does not touch Notion', async () => {
  const t = setup();
  await t.send({ slide: 'plan', reached: 5, seen: 6, activeMs: 90000 });
  const writes = t.notion.length;
  await t.send({ slide: 'fit', reached: 1, seen: 2, activeMs: 1000 });
  assert.equal(t.notion.length, writes);
  const row = t.store.rows.get('acme-x1')!.visits.get(V1)!;
  assert.deepEqual([row.slide, row.reached, row.seen, row.activeMs], ['plan', 5, 6, 90000]);
  assert.deepEqual(t.alerts, [1]);
});

test('a returning visitor adds a visit but no alert; a new browser alerts again', async () => {
  const t = setup();
  await t.send();
  await t.send({ visit: V2 });
  assert.deepEqual(t.alerts, [1]);
  assert.deepEqual([t.notion.at(-1)!.visitors, t.notion.at(-1)!.visits], [1, 2]);
  await t.send({ visitor: B, visit: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
  assert.deepEqual(t.alerts, [1, 2]);
});

test('unknown pages are ignored', async () => {
  const t = setup();
  assert.equal(await t.send({ slug: 'someone-else' }), 'ignored');
  assert.equal(t.store.rows.size, 0);
});

test('a failed Notion update keeps the visit, still alerts, and retries next time', async () => {
  let fail = true; const seen: Summary[] = [];
  const t = setup({ updateNotion: async (_, s) => { if (fail) throw new Error('nope'); seen.push(s); } });
  await t.send();
  assert.equal(t.store.rows.get('acme-x1')!.visits.size, 1);
  assert.deepEqual(t.alerts, [1]);
  assert.equal(t.errors.length, 1);
  fail = false;
  await t.send();
  assert.equal(seen.length, 1);
});

test('alerts stop after ten visitors for one page', async () => {
  const t = setup();
  for (let i = 0; i < 12; i++) {
    const n = String(i).padStart(12, '0');
    await t.send({ visitor: `11111111-1111-4111-8111-${n}`, visit: `aaaaaaaa-aaaa-4aaa-8aaa-${n}` });
  }
  assert.equal(t.alerts.length, 10);
});

test('bad reports are rejected', () => {
  for (const bad of [{ visitor: 'x' }, { visit: 'x' }, { slug: 'A B' }, { slide: 'nope' }, { reached: 8 }, { total: 0 }, { seen: -1 }, { reached: 1.5 }, { device: 'tv' }, { activeMs: '5' }])
    assert.equal(parseUpdate(update(bad)), null, JSON.stringify(bad));
  assert.equal(parseUpdate(null), null);
  assert.equal(parseUpdate(update({ activeMs: 99e9 }))!.activeMs, 21600000);
});

test('names read the way the page does', () => {
  assert.equal(slideName('evidence-2'), 'Exhibit B');
  assert.equal(alertText('Acme', 1).title, 'Someone opened your Acme page');
  assert.equal(alertText('Acme', 3).title, '3 people have opened your Acme page');
});

function request(body: string, headers: Record<string, string> = {}) {
  const h = new Map(Object.entries({ origin: 'https://jacobtroutman.dev', 'user-agent': 'Mozilla/5.0 Safari', ...headers }));
  return { headers: { get: (n: string) => h.get(n) ?? null }, text: async () => body };
}
const ctx = { error() {} };

test('the endpoint records real page reports and quietly drops everything else', async () => {
  const t = setup(), handle = trackHandler(() => t.deps), good = JSON.stringify(update());
  for (const req of [request(good, { origin: 'https://evil.example' }), request(good, { 'user-agent': 'HeadlessChrome/120' }), request('{oops'), request('x'.repeat(3000))])
    assert.equal((await handle(req, ctx)).status, 204);
  assert.equal(t.store.rows.size, 0);
  assert.equal((await handle(request(good), ctx)).status, 204);
  assert.equal(t.store.rows.get('acme-x1')!.visits.size, 1);
});

test('without storage configured the endpoint does nothing', async () => {
  assert.equal((await trackHandler(() => null)(request(JSON.stringify(update())), ctx)).status, 204);
});
