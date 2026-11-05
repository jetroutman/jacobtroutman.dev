// Library data: Jacob's Published books from Notion (src/data/library.json, refreshed by scripts/sync-library.mjs).
import data from '../data/library.json';

export type Book = {
  id: string; title: string; author: string | null; kind: string | null;
  genres: string[]; topics: string[]; score: number | null; rating: string | null;
  finished: string | null; notes: number | null; review: string | null; who: string[];
  impressions?: string | null; changed?: string | null; refNotes?: RefNote[];
};
export type RefNote = { id: string; title: string; type: string | null; page: number | null; quote: string | null; interpretation: string | null; created: string | null };

const slugify = (s: string) => s.toLowerCase().replace(/['’$]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');

export const books = (data.books as Book[]).map((b) => {
  const [short, ...rest] = b.title.split(/:\s+/);
  const fiction = (b.kind || '').toLowerCase().includes('fiction') && !(b.kind || '').toLowerCase().startsWith('non');
  const tags = [...new Set([...b.genres, ...b.topics])];
  const finishedLabel = b.finished ? new Date(`${b.finished.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  const refNotes = b.refNotes || [];
  const hasPage = !!(b.review || b.impressions || b.changed || refNotes.length);
  return { ...b, refNotes, hasPage, short: short.trim(), subtitle: rest.join(': ').trim() || null, fiction, tags, finishedLabel, slug: `${slugify(short)}-${b.id.slice(-4)}` };
}).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.finished || '').localeCompare(a.finished || ''));

// Ranking = Jacob's Rating Score, highest first. Ties share a rank (1, 2, 2, 4); unscored books are unranked.
let prev: number | null = null, prevRank = 0;
books.forEach((b, i) => {
  if (b.score == null) { (b as any).rank = null; return; }
  (b as any).rank = b.score === prev ? prevRank : i + 1;
  prev = b.score; prevRank = (b as any).rank;
});
export const rankedCount = books.filter((b) => b.score != null).length;

// Note types, most useful first (Key Ideas lead).
export const NOTE_ORDER = ['Key Idea', 'Guide', 'Exercises', 'Inspiration', 'Good Info', 'Impressions', 'Quotes', 'Vocab', 'References'];
export const NOTE_LABEL: Record<string, string> = {
  'Key Idea': 'Key ideas', Guide: 'How-tos', Exercises: 'Exercises', Inspiration: 'Inspiration', 'Good Info': 'Good to know',
  Impressions: 'Impressions', Quotes: 'Quotes', Vocab: 'Vocabulary', References: 'References', Other: 'Other notes',
};
export function groupNotes(notes: RefNote[]) {
  const by = new Map<string, RefNote[]>();
  for (const n of notes) { const k = n.type && NOTE_ORDER.includes(n.type) ? n.type : 'Other'; by.set(k, [...(by.get(k) || []), n]); }
  for (const list of by.values()) list.sort((a, b) => (a.page ?? 1e9) - (b.page ?? 1e9));
  return [...NOTE_ORDER, 'Other'].filter((k) => by.has(k)).map((k) => ({ type: k, label: NOTE_LABEL[k], notes: by.get(k)! }));
}

export type LibBook = (typeof books)[number] & { rank: number | null };
export const syncedAt = data.syncedAt;
export const favorite = (b: LibBook) => b.rating === 'Lifechanging' || b.rating === '5-Star';
