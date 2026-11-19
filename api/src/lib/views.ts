// Page view counts: one counter per page per month, so the admin page can show this month, last month and all time.
export type Page = { title: string };
export type CountRow = { month: string; path: string; views: number; lastAt: string };

export interface ViewStore {
  increment(month: string, path: string, at: string): Promise<void>;
  all(): Promise<CountRow[]>;
}

export type ViewDeps = { pages: Record<string, Page>; store: ViewStore; now?: () => Date };

export const monthOf = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'America/Chicago' }).slice(0, 7);

export function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function sectionOf(path: string) {
  if (path.startsWith('/posts/')) return 'Posts';
  if (path.startsWith('/library/')) return 'Library';
  if (path.startsWith('/notes/')) return 'Notes';
  return 'Other';
}

/** Only real pages count, so a flood can't fill the table with made-up paths. */
export function parseView(input: unknown, pages: Record<string, Page>): string | null {
  const path = (input as { path?: unknown } | null)?.path;
  return typeof path === 'string' && path.length <= 300 && Object.hasOwn(pages, path) ? path : null;
}

export async function recordView(path: string, deps: ViewDeps) {
  const now = deps.now?.() ?? new Date();
  await deps.store.increment(monthOf(now), path, now.toISOString());
}

export async function viewStats(deps: ViewDeps) {
  const thisMonth = monthOf(deps.now?.() ?? new Date()), lastMonth = previousMonth(thisMonth);
  const byPath = new Map<string, { path: string; title: string; section: string; thisMonth: number; lastMonth: number; total: number; lastAt: string }>();
  for (const r of await deps.store.all()) {
    const row = byPath.get(r.path) ?? { path: r.path, title: deps.pages[r.path]?.title ?? '', section: sectionOf(r.path), thisMonth: 0, lastMonth: 0, total: 0, lastAt: '' };
    row.total += r.views;
    if (r.month === thisMonth) row.thisMonth += r.views;
    if (r.month === lastMonth) row.lastMonth += r.views;
    if (r.lastAt > row.lastAt) row.lastAt = r.lastAt;
    byPath.set(r.path, row);
  }
  const label = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return { months: [label(thisMonth), label(lastMonth)], rows: [...byPath.values()] };
}
