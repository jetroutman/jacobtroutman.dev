// Slip Box (permanent notes) as threads of branching trees.
// Jacob's IDs are Luhmann-style: 1 → 1A → 1Ai → 1Aia → 1Aia1 → 1Aia1A …
// (number, CAPITAL, roman numeral, lowercase letter, then the cycle repeats).
import data from '../data/notes.json';
import { books } from './library';

export type Block = { k: 'h' | 'p' | 'li' | 'ol' | 'q'; d: number; t: string };
export type RawNote = {
  id: string; title: string; type: string | null; tags: string[];
  previous: string[]; next: string[]; related: string[]; sources: string[];
  created: string | null; edited: string | null; body: Block[];
};
export type Note = RawNote & {
  fid: string | null; label: string; parent: string | null; children: string[];
  thread: string; depth: number; books: { title: string; href: string }[];
};
export type Thread = { slug: string; root: Note; notes: Note[]; tags: string[] };

// Tokenize an ID into its levels. Runs of digits and single capitals are one level each; a lowercase run
// right after a capital starts with a roman numeral (i, ii, iii…), then single letters (1Bia → 1, B, i, a).
// Both 1Aia1A and 12A1 (digit straight after a capital) parse.
const ROMAN = /^(viii|vii|vi|iv|ix|iii|ii|i|v|x)/;
function tokens(fid: string): string[] | null {
  if (!/^\d/.test(fid)) return null;
  const out: string[] = [];
  for (const run of fid.match(/\d+|[A-Z]|[a-z]+/g) || []) {
    if (!/^[a-z]/.test(run)) { out.push(run); continue; }
    let rest = run;
    if (/^[A-Z]$/.test(out.at(-1) || '')) { const m = rest.match(ROMAN); if (m) { out.push(m[0]); rest = rest.slice(m[0].length); } }
    out.push(...rest.split(''));
  }
  return out.join('') === fid ? out : null;
}

const raw = ((data as { notes?: RawNote[] }).notes || []);
const byId = new Map(raw.map((n) => [n.id, n]));

// Reference Box note id → the Published book it came from (only books on the site).
const refToBook = new Map<string, { title: string; href: string }>();
for (const b of books) for (const r of b.refNotes) refToBook.set(r.id, { title: b.short, href: `/library/${b.slug}/` });

const notes = new Map<string, Note>();
const fidIndex = new Map<string, string>();
for (const n of raw) {
  const m = n.title.match(/^(\d+[A-Za-z0-9]*)\s+(.*)$/);
  const fid = m && tokens(m[1]) ? m[1] : null;
  const label = fid ? m![2] : n.title;
  if (fid) fidIndex.set(fid, n.id);
  const bookList = [...new Map(n.sources.map((s) => refToBook.get(s)).filter(Boolean).map((b) => [b!.href, b!])).values()];
  notes.set(n.id, { ...n, fid, label, parent: null, children: [], thread: '', depth: 0, books: bookList });
}

// Parent: the ID one level up (1Aia → 1Ai); otherwise the first "Previous" note; Start notes are roots.
for (const n of notes.values()) {
  if (n.fid) {
    const t = tokens(n.fid)!;
    for (let k = t.length - 1; k >= 1 && !n.parent; k--) n.parent = fidIndex.get(t.slice(0, k).join('')) || null;
  }
  if (!n.parent && !(n.fid && tokens(n.fid)!.length === 1) && n.type !== 'Start') n.parent = n.previous.find((p) => notes.has(p) && p !== n.id) || null;
}
// Break any cycles from hand-made links.
for (const n of notes.values()) {
  const seen = new Set<string>([n.id]); let p = n.parent;
  while (p) { if (seen.has(p)) { n.parent = null; break; } seen.add(p); p = notes.get(p)?.parent || null; }
}
for (const n of notes.values()) if (n.parent) notes.get(n.parent)!.children.push(n.id);

const order = (a: Note, b: Note) => {
  if (a.fid && b.fid) {
    const ta = tokens(a.fid)!, tb = tokens(b.fid)!;
    for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
      if (ta[i] === tb[i]) continue;
      const na = Number(ta[i]), nb = Number(tb[i]);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      const ra = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
      if (ra.includes(ta[i]) && ra.includes(tb[i])) return ra.indexOf(ta[i]) - ra.indexOf(tb[i]);
      return ta[i].localeCompare(tb[i]);
    }
    return ta.length - tb.length;
  }
  if (a.fid) return -1; if (b.fid) return 1;
  return (a.created || '').localeCompare(b.created || '') || a.label.localeCompare(b.label);
};
for (const n of notes.values()) n.children.sort((x, y) => order(notes.get(x)!, notes.get(y)!));

const slugify = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-$/, '');

const roots = [...notes.values()].filter((n) => !n.parent);
// Roots that are lone notes (no children, not a Start) are gathered into one "Loose notes" thread.
const loose = roots.filter((r) => !r.children.length && r.type !== 'Start' && !(r.fid && tokens(r.fid)!.length === 1));
const realRoots = roots.filter((r) => !loose.includes(r)).sort(order);

export const threads: Thread[] = realRoots.map((root) => {
  const slug = `${root.fid ? `${root.fid}-` : ''}${slugify(root.label)}`;
  const list: Note[] = [];
  const walk = (id: string, depth: number) => {
    const n = notes.get(id)!; n.thread = slug; n.depth = depth; list.push(n);
    for (const c of n.children) walk(c, depth + 1);
  };
  walk(root.id, 0);
  const tags = [...new Set(list.flatMap((n) => n.tags))];
  return { slug, root, notes: list, tags };
});
if (loose.length) {
  const root: Note = { id: 'loose', title: 'Loose notes', label: 'Loose notes', fid: null, type: 'Start', tags: [], previous: [], next: [], related: [], sources: [], created: null, edited: null, body: [{ k: 'p', d: 0, t: 'Notes that aren’t filed under a thread yet.' }], parent: null, children: loose.sort(order).map((n) => n.id), thread: 'loose-notes', depth: 0, books: [] };
  for (const n of loose) { n.thread = 'loose-notes'; n.depth = 1; n.parent = 'loose'; }
  threads.push({ slug: 'loose-notes', root, notes: [root, ...loose], tags: [...new Set(loose.flatMap((n) => n.tags))] });
}

export const allNotes = threads.flatMap((t) => t.notes).filter((n) => n.id !== 'loose');
export const noteById = new Map(allNotes.map((n) => [n.id, n]));
export const noteHref = (n: Note) => `/notes/${n.thread}/#n-${n.fid || n.id.slice(0, 8)}`;
export const anchor = (n: Note) => `n-${n.fid || n.id.slice(0, 8)}`;
export const syncedAt = (data as { syncedAt?: string }).syncedAt || null;

// Reference Box note → the permanent notes it fed ("Where this went" on book pages).
export const fedBy = new Map<string, Note[]>();
for (const n of allNotes) for (const s of n.sources) fedBy.set(s, [...(fedBy.get(s) || []), n]);
