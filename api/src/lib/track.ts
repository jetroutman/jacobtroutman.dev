// What a visit means: validates what the page reports, keeps one row per visit and per visitor,
// and turns them into the per-company numbers. Storage and outside services are passed in.

export type Company = { company: string; notion: string };

export type VisitUpdate = {
  slug: string; visitor: string; visit: string;
  slide: string; reached: number; seen: number; total: number;
  activeMs: number; device: 'touch' | 'mouse';
};

export type VisitRow = Omit<VisitUpdate, 'slug' | 'visit'> & { startedAt: string; lastAt: string };

export type CompanyRows = { visits: Map<string, VisitRow>; visitors: Set<string>; summary: string | null };

export interface Store {
  read(slug: string): Promise<CompanyRows>;
  saveVisit(slug: string, visit: string, row: VisitRow): Promise<void>;
  /** False when this visitor was already recorded. */
  addVisitor(slug: string, visitor: string, at: string): Promise<boolean>;
  saveSummary(slug: string, summary: string): Promise<void>;
}

export type Summary = {
  firstOpened: string; lastOpened: string; visitors: number; visits: number;
  furthest: string; longestMinutes: number;
};

export interface Outbox {
  updateNotion(company: Company, summary: Summary): Promise<void>;
  alert(company: Company, visitors: number): Promise<void>;
}

export type TrackDeps = {
  companies: Record<string, Company>; store: Store; outbox: Outbox;
  now?: () => Date; log?: (message: string, error: unknown) => void;
};

// The endpoint is public, so these cap what a flood could cost.
const MAX_VISITS_PER_COMPANY = 2000;
const MAX_ALERTS_PER_COMPANY = 10;
const MAX_ACTIVE_MS = 6 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9-]{1,80}$/;
const SLIDE = /^(intro|fit|plan|questions|note|evidence-[1-9][0-9]?)$/;
const count = (v: unknown, max: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;

export function parseUpdate(input: unknown): VisitUpdate | null {
  if (typeof input !== 'object' || input === null) return null;
  const b = input as Record<string, unknown>;
  const text = (v: unknown, re: RegExp) => typeof v === 'string' && re.test(v);
  if (!text(b.slug, SLUG) || !text(b.visitor, UUID) || !text(b.visit, UUID) || !text(b.slide, SLIDE)) return null;
  if (!count(b.reached, 40) || !count(b.seen, 41) || !count(b.total, 41) || !count(b.activeMs, Number.MAX_SAFE_INTEGER)) return null;
  if ((b.total as number) < 1 || (b.reached as number) >= (b.total as number)) return null;
  if (b.device !== 'touch' && b.device !== 'mouse') return null;
  return {
    slug: b.slug as string, visitor: b.visitor as string, visit: b.visit as string, slide: b.slide as string,
    reached: b.reached as number, seen: b.seen as number, total: b.total as number,
    activeMs: Math.min(b.activeMs as number, MAX_ACTIVE_MS), device: b.device,
  };
}

export function slideName(id: string) {
  const exhibit = /^evidence-(\d+)$/.exec(id);
  if (exhibit) return `Exhibit ${String.fromCharCode(64 + Number(exhibit[1]))}`;
  return ({ intro: 'Intro', fit: 'Wishlist', plan: 'First 90 days', questions: 'My questions', note: 'Locked note' } as Record<string, string>)[id] ?? id;
}

// A visit reports several times, and a late report can arrive out of order: progress only moves forward.
function merge(old: VisitRow | undefined, u: VisitUpdate, at: string): VisitRow {
  const further = !old || u.reached > old.reached;
  return {
    visitor: old?.visitor ?? u.visitor, device: old?.device ?? u.device,
    startedAt: old?.startedAt ?? at, lastAt: at,
    slide: further ? u.slide : old.slide, reached: further ? u.reached : old.reached,
    seen: Math.max(old?.seen ?? 0, u.seen), total: u.total,
    activeMs: Math.max(old?.activeMs ?? 0, u.activeMs),
  };
}

export function summarize(rows: CompanyRows): Summary {
  const visits = [...rows.visits.values()];
  const starts = visits.map((v) => v.startedAt).sort();
  const best = visits.reduce((a, b) => (b.reached > a.reached ? b : a));
  return {
    firstOpened: starts[0], lastOpened: starts[starts.length - 1],
    visitors: rows.visitors.size, visits: visits.length,
    furthest: `${best.reached + 1} of ${best.total} · ${slideName(best.slide)}`,
    longestMinutes: Math.round(Math.max(...visits.map((v) => v.activeMs)) / 6000) / 10,
  };
}

export async function recordVisit(u: VisitUpdate, deps: TrackDeps): Promise<'recorded' | 'ignored'> {
  const company = deps.companies[u.slug];
  if (!company) return 'ignored';
  const rows = await deps.store.read(u.slug);
  if (rows.visits.size >= MAX_VISITS_PER_COMPANY && !rows.visits.has(u.visit)) return 'ignored';

  const at = (deps.now?.() ?? new Date()).toISOString();
  const row = merge(rows.visits.get(u.visit), u, at);
  await deps.store.saveVisit(u.slug, u.visit, row);
  rows.visits.set(u.visit, row);

  const newVisitor = !rows.visitors.has(row.visitor) && await deps.store.addVisitor(u.slug, row.visitor, at);
  rows.visitors.add(row.visitor);

  // The visit is safely stored by now. Notion and the alert are best effort, and a failed
  // Notion update is retried on the next report because the saved summary won't match.
  const summary = summarize(rows);
  const key = JSON.stringify(summary);
  const jobs: Promise<void>[] = [];
  if (key !== rows.summary) jobs.push(deps.outbox.updateNotion(company, summary).then(() => deps.store.saveSummary(u.slug, key)));
  if (newVisitor && rows.visitors.size <= MAX_ALERTS_PER_COMPANY) jobs.push(deps.outbox.alert(company, rows.visitors.size));
  for (const r of await Promise.allSettled(jobs)) if (r.status === 'rejected') deps.log?.(`[track] ${u.slug}`, r.reason);
  return 'recorded';
}
