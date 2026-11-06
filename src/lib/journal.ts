// Journal: everything from the Library and the Slip Box as one dated feed, newest first.
// Nothing new is fetched: it reads the same synced data (library.json, notes.json), so it follows the same
// public-only rules. Three kinds of entry:
//   review  a book with a written review (dated by when I finished it)
//   notes   the Reference notes I took on one book in one week (dated by the week)
//   idea    one permanent Slip Box note (dated by when I wrote it)
import { books, NOTE_LABEL, syncedAt as libSynced } from './library';
import { allNotes, noteById, noteHref, anchor, threads, fedBy, syncedAt as notesSynced, type Note } from './notes';

export type Kind = 'review' | 'notes' | 'idea';
export type Entry = {
  id: string; kind: Kind; date: string; title: string; href: string;
  excerpt: string[]; more: boolean;           // excerpt paragraphs; more = there's more on the full page
  meta: string[];                             // small facts shown in the meta row
  pill?: string | null;                       // e.g. "Lifechanging" (status, so amber)
  fid?: string | null; thread?: string | null;
  items?: { title: string; type: string }[];  // notes: the note titles in this batch
  extra?: number;                             // notes: how many more beyond `items`
  links: string[];                            // ids of connected entries (the trail)
  bookSlug?: string; noteIds?: string[];
};

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clip = (paras: string[], max: number) => {
  const out: string[] = []; let n = 0;
  for (const p of paras) {
    if (n >= max) return { out, more: true };
    const w = words(p);
    if (n + w > max) { out.push(`${p.split(/\s+/).slice(0, max - n).join(' ')}…`); return { out, more: true }; }
    out.push(p); n += w;
  }
  return { out, more: false };
};
const lines = (t?: string | null) => (t || '').split('\n').map((l) => l.replace(/^• /, '')).filter(Boolean);
// Monday of the week, as YYYY-MM-DD.
const weekOf = (d: string) => { const x = new Date(`${d.slice(0, 10)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };

const entries: Entry[] = [];
const reviewByBook = new Map<string, string>();
const ideaId = (n: Note) => `i-${anchor(n).slice(2)}`;

for (const b of books) {
  if (b.review && b.finished) {
    const id = `r-${b.slug}`;
    reviewByBook.set(b.slug, id);
    const { out, more } = clip(lines(b.review), 70);
    entries.push({
      id, kind: 'review', date: b.finished.slice(0, 10), title: b.short, href: `/library/${b.slug}/`,
      excerpt: out, more: more || !!(b.impressions || b.changed || b.refNotes.length || b.who.length),
      meta: [b.author, (b as any).rank ? `#${(b as any).rank} in my library` : null].filter(Boolean) as string[],
      pill: b.rating === 'Lifechanging' || b.rating === '5-Star' ? b.rating : null,
      links: [], bookSlug: b.slug,
    });
  }
  const byWeek = new Map<string, typeof b.refNotes>();
  for (const r of b.refNotes) if (r.created) { const w = weekOf(r.created); byWeek.set(w, [...(byWeek.get(w) || []), r]); }
  for (const [w, list] of byWeek) {
    const last = list.map((r) => r.created!).sort().at(-1)!;
    const show = list.slice().sort((x, y) => (x.page ?? 1e9) - (y.page ?? 1e9));
    entries.push({
      id: `b-${b.slug}-${w}`, kind: 'notes', date: last, title: `${list.length} ${list.length === 1 ? 'note' : 'notes'} on ${b.short}`,
      href: `/library/${b.slug}/#notes`, excerpt: [], more: true,
      meta: [b.author].filter(Boolean) as string[],
      items: show.slice(0, 4).map((r) => ({ title: r.title, type: NOTE_LABEL[r.type || ''] || 'Note' })), extra: Math.max(0, list.length - 4),
      links: [], bookSlug: b.slug, noteIds: list.map((r) => r.id),
    });
  }
}

const threadName = new Map(threads.map((t) => [t.slug, t.root.label]));
for (const n of allNotes) {
  if (!n.created) continue;
  const paras = n.body.filter((x) => x.k !== 'h').map((x) => x.t);
  const { out, more } = clip(paras, 90);
  entries.push({
    id: ideaId(n), kind: 'idea', date: n.created, title: n.label, href: noteHref(n),
    excerpt: out, more, meta: [n.depth === 0 ? 'Starts a thread' : `In “${threadName.get(n.thread) || 'Loose notes'}”`],
    fid: n.fid, thread: n.thread, links: [],
  });
}

// The trail: how entries connect. Ideas ↔ parent, branches, related notes and the books they grew out of;
// book notes ↔ the ideas they fed; reviews ↔ the book's notes and ideas.
const byId = new Map(entries.map((e) => [e.id, e]));
const link = (a: string, b: string) => {
  const x = byId.get(a), y = byId.get(b);
  if (!x || !y || a === b) return;
  if (!x.links.includes(b)) x.links.push(b);
  if (!y.links.includes(a)) y.links.push(a);
};
for (const n of allNotes) {
  const me = ideaId(n);
  if (n.parent && noteById.has(n.parent)) link(me, ideaId(noteById.get(n.parent)!));
  for (const r of n.related) if (noteById.has(r)) link(me, ideaId(noteById.get(r)!));
}
for (const e of entries) {
  if (e.kind !== 'notes') continue;
  const rev = reviewByBook.get(e.bookSlug!); if (rev) link(e.id, rev);
  for (const rid of e.noteIds || []) for (const n of fedBy.get(rid) || []) link(e.id, ideaId(n));
}

entries.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
export { entries };
export const entryById = new Map(entries.map((e) => [e.id, e]));

export const KIND_LABEL: Record<Kind, string> = { review: 'Review', notes: 'Book notes', idea: 'Idea' };
export const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const monthKey = (d: string) => d.slice(0, 7);
export const monthLabel = (k: string) => new Date(`${k}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// My side of the game: a year of activity, counted per week (reviews, notes taken, ideas written).
const end = (notesSynced || libSynced || new Date().toISOString()).slice(0, 10);
const lastWeek = weekOf(end);
export const weeks: { start: string; n: number }[] = [];
for (let i = 51; i >= 0; i--) { const d = new Date(`${lastWeek}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - i * 7); weeks.push({ start: d.toISOString().slice(0, 10), n: 0 }); }
const weekIdx = new Map(weeks.map((w, i) => [w.start, i]));
const bump = (d: string | null | undefined, k = 1) => { if (!d) return; const i = weekIdx.get(weekOf(d)); if (i != null) weeks[i].n += k; };
for (const b of books) { if (b.review) bump(b.finished); for (const r of b.refNotes) bump(r.created); }
for (const n of allNotes) bump(n.created);

const year = end.slice(0, 4);
export const yearStats = {
  year,
  books: books.filter((b) => b.finished?.startsWith(year)).length,
  notes: books.reduce((s, b) => s + b.refNotes.filter((r) => r.created?.startsWith(year)).length, 0),
  ideas: allNotes.filter((n) => n.created?.startsWith(year)).length,
  activeWeeks: weeks.filter((w) => w.n > 0).length,
};
// Consecutive weeks with something written, counting back from the latest (this week may still be empty).
let streak = 0;
for (let i = weeks.length - 1; i >= 0; i--) { if (weeks[i].n > 0) streak++; else if (i !== weeks.length - 1) break; }
export const weekStreak = streak;
