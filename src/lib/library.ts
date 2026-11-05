// Library data: Jacob's Published books from Notion (src/data/library.json, refreshed by scripts/sync-library.mjs).
import data from '../data/library.json';

export type Book = {
  id: string; title: string; author: string | null; kind: string | null;
  genres: string[]; topics: string[]; score: number | null; rating: string | null;
  finished: string | null; notes: number | null; review: string | null; who: string[];
};

const slugify = (s: string) => s.toLowerCase().replace(/['’$]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');

export const books = (data.books as Book[]).map((b) => {
  const [short, ...rest] = b.title.split(/:\s+/);
  const fiction = (b.kind || '').toLowerCase().includes('fiction') && !(b.kind || '').toLowerCase().startsWith('non');
  const tags = [...new Set([...b.genres, ...b.topics])];
  const finishedLabel = b.finished ? new Date(`${b.finished.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  return { ...b, short: short.trim(), subtitle: rest.join(': ').trim() || null, fiction, tags, finishedLabel, slug: `${slugify(short)}-${b.id.slice(-4)}` };
}).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.finished || '').localeCompare(a.finished || ''));

export type LibBook = (typeof books)[number];
export const syncedAt = data.syncedAt;
export const favorite = (b: LibBook) => b.rating === 'Lifechanging' || b.rating === '5-Star';
