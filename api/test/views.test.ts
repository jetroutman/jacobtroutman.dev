import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAdmin, statsHandler, viewHandler } from '../src/functions/views';
import { monthOf, parseView, previousMonth, sectionOf, viewStats, type CountRow, type ViewDeps, type ViewStore } from '../src/lib/views';

class FakeViews implements ViewStore {
  rows = new Map<string, CountRow>();
  async increment(month: string, path: string, at: string) {
    const k = `${month}|${path}`, r = this.rows.get(k);
    this.rows.set(k, { month, path, views: (r?.views ?? 0) + 1, lastAt: at });
  }
  async all() { return [...this.rows.values()]; }
}

const pages = { '/posts/hello/': { title: 'Hello' }, '/library/noise/': { title: 'Noise' }, '/': { title: 'Jacob Troutman' } };
const setup = (iso = '2026-11-19T12:00:00Z') => {
  const store = new FakeViews();
  const deps: ViewDeps = { pages, store, now: () => new Date(iso) };
  return { store, deps };
};
const request = (body: string, headers: Record<string, string> = {}) => {
  const h = new Map(Object.entries({ origin: 'https://jacobtroutman.dev', 'user-agent': 'Mozilla/5.0 Safari', ...headers }));
  return { headers: { get: (n: string) => h.get(n) ?? null }, text: async () => body };
};
const principal = (roles: string[]) => Buffer.from(JSON.stringify({ userRoles: roles })).toString('base64');
const ctx = { error() {} };

test('only real pages count', () => {
  assert.equal(parseView({ path: '/posts/hello/' }, pages), '/posts/hello/');
  for (const bad of [{ path: '/posts/nope/' }, { path: '/for/acme/' }, { path: 'constructor' }, { path: 5 }, null, {}])
    assert.equal(parseView(bad, pages), null, JSON.stringify(bad));
});

test('months follow Chicago time and roll over the year', () => {
  assert.equal(monthOf(new Date('2026-12-01T03:00:00Z')), '2026-11');
  assert.equal(previousMonth('2026-01'), '2025-12');
  assert.equal(previousMonth('2026-11'), '2026-10');
});

test('sections', () => {
  assert.deepEqual(['/posts/a/', '/library/b/', '/notes/1/', '/', '/pocket-log/'].map(sectionOf), ['Posts', 'Library', 'Notes', 'Other', 'Other']);
});

test('the endpoint counts real views and drops everything else', async () => {
  const t = setup(), handle = viewHandler(() => t.deps);
  for (const req of [request('{"path":"/posts/hello/"}', { origin: 'https://evil.example' }), request('{"path":"/posts/hello/"}', { 'user-agent': 'Googlebot/2.1' }), request('{"path":"/nope/"}'), request('{oops'), request('x'.repeat(600))])
    assert.equal((await handle(req, ctx)).status, 204);
  assert.equal(t.store.rows.size, 0);
  await handle(request('{"path":"/posts/hello/"}'), ctx);
  await handle(request('{"path":"/posts/hello/"}'), ctx);
  assert.equal([...t.store.rows.values()][0].views, 2);
});

test('stats add up this month, last month and all time', async () => {
  const t = setup();
  t.store.rows.set('a', { month: '2026-11', path: '/posts/hello/', views: 3, lastAt: '2026-11-18T10:00:00Z' });
  t.store.rows.set('b', { month: '2026-10', path: '/posts/hello/', views: 5, lastAt: '2026-10-02T10:00:00Z' });
  t.store.rows.set('c', { month: '2026-08', path: '/posts/hello/', views: 1, lastAt: '2026-08-02T10:00:00Z' });
  t.store.rows.set('d', { month: '2026-11', path: '/library/noise/', views: 1, lastAt: '2026-11-19T01:00:00Z' });
  const s = await viewStats(t.deps);
  assert.deepEqual(s.months, ['Nov 2026', 'Oct 2026']);
  const hello = s.rows.find((r) => r.path === '/posts/hello/')!;
  assert.deepEqual([hello.title, hello.section, hello.thisMonth, hello.lastMonth, hello.total, hello.lastAt], ['Hello', 'Posts', 3, 5, 9, '2026-11-18T10:00:00Z']);
});

test('stats are for the admin only', async () => {
  const t = setup(), handle = statsHandler(() => t.deps);
  assert.equal((await handle(request(''), ctx)).status, 403);
  assert.equal((await handle(request('', { 'x-ms-client-principal': principal(['anonymous', 'authenticated']) }), ctx)).status, 403);
  assert.equal((await handle(request('', { 'x-ms-client-principal': 'garbage' }), ctx)).status, 403);
  assert.equal(isAdmin(request('', { 'x-ms-client-principal': principal(['authenticated', 'admin']) })), true);
  const ok = await handle(request('', { 'x-ms-client-principal': principal(['admin']) }), ctx);
  assert.equal(ok.status, 200);
  assert.equal((await statsHandler(() => null)(request('', { 'x-ms-client-principal': principal(['admin']) }), ctx)).status, 503);
});
