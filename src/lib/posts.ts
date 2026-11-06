// Posts: story-led essays from the Notion Posts database, with Slip Box cards woven in.
// A card's claim and note are free; its source (the Reference note and book it grew from) and its
// branches (where the idea went next) are sealed and cost ink. See src/scripts/ink.ts.
import data from '../data/posts.json';
import { books } from './library';
import { noteById, noteHref, type Note } from './notes';

export const INK = {
  cardReached: 10,   // a card's claim scrolls into view
  postFinished: 25,  // the end of a post scrolls into view
  welcome: 100,      // arriving from a company page
  sourceCost: 15,
  branchesCost: 10,
  levels: [
    { name: 'Elementary', at: 0, desc: 'You read what the page says.' },
    { name: 'Inspectional', at: 60, desc: 'You skim for the shape of an argument before committing.' },
    { name: 'Analytical', at: 180, desc: 'You trace claims back to their source and judge them.' },
    { name: 'Syntopical', at: 400, desc: 'You connect ideas across books into something new.' },
  ],
};

type Raw = { id: string; title: string; status: string; hook: string | null; published: string | null; cards: string[]; books: string[]; edited: string | null; body: { k: string; t?: string; id?: string }[] };
const slugify = (s: string) => s.toLowerCase().replace(/['’$]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');

// Every Reference note that made it out of Notion (only those on Published books), with its book.
const refById = new Map<string, { title: string; type: string | null; quote: string | null; interpretation: string | null; book: string; bookHref: string }>();
for (const b of books) for (const r of b.refNotes) refById.set(r.id, { ...r, book: b.short, bookHref: `/library/${b.slug}/` });
const bookById = new Map(books.map((b) => [b.id, b]));

export type CardView = {
  id: string; fid: string | null; label: string; href: string; body: string[];
  sources: { title: string; quote: string | null; interpretation: string | null; book: string; bookHref: string }[];
  branches: { fid: string | null; label: string; href: string }[];
};
const cardView = (n: Note): CardView => ({
  id: n.id, fid: n.fid, label: n.label, href: noteHref(n),
  body: n.body.filter((b) => b.k !== 'h').map((b) => b.t),
  sources: n.sources.map((s) => refById.get(s)).filter(Boolean) as CardView['sources'],
  branches: [...n.children, ...n.related].map((id) => noteById.get(id)).filter(Boolean)
    .map((c) => ({ fid: c!.fid, label: c!.label, href: noteHref(c!) })),
});

export type Block = { k: 'h' | 'p' | 'q' | 'li'; t: string } | { k: 'card'; card: CardView | null; id: string };
export type Post = Omit<Raw, 'body'> & { slug: string; body: Block[]; bookLinks: { title: string; href: string }[]; cardCount: number; minutes: number };

export const posts: Post[] = (data.posts as Raw[]).map((p) => {
  const body = p.body.map((b) => (b.k === 'card'
    ? { k: 'card' as const, id: b.id!, card: noteById.has(b.id!) ? cardView(noteById.get(b.id!)!) : null }
    : { k: b.k as 'h' | 'p' | 'q' | 'li', t: b.t || '' }));
  const words = body.reduce((s, b) => s + (b.k === 'card' ? (b.card ? b.card.body.join(' ').split(/\s+/).length + 10 : 0) : b.t.split(/\s+/).length), 0);
  return {
    ...p, body, slug: `${slugify(p.title)}-${p.id.slice(-4)}`,
    bookLinks: p.books.map((id) => bookById.get(id)).filter(Boolean).map((b) => ({ title: b!.short, href: b!.hasPage ? `/library/${b!.slug}/` : '/library/' })),
    cardCount: body.filter((b) => b.k === 'card' && b.card).length,
    minutes: Math.max(1, Math.round(words / 220)),
  };
}).sort((a, b) => (b.published || b.edited || '').localeCompare(a.published || a.edited || ''));

export const published = posts.filter((p) => p.status === 'Published');
export const syncedAt = (data as { syncedAt?: string | null }).syncedAt || null;

// Inline markup from the sync: *italic* and **bold**. Escapes everything else.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
