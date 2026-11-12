// Idea map layout, shared by /notes/ and the small map that advertises it (IdeaMapMini).
import { threads, allNotes, noteById } from './notes';

// Idea map: each thread is a radial cluster around its starting question; branches fan out by depth.
// Dashed arcs are "Related" links, often between threads. Laid out at build time, no client library.
const RING = 30, PAD = 46;
type P = { x: number; y: number };
export const pos = new Map<string, P>();
const clusters = threads.map((t) => {
  const leaves = (id: string): number => { const n = t.notes.find((x) => x.id === id)!; return n.children.length ? n.children.reduce((s, c) => s + leaves(c), 0) : 1; };
  const maxDepth = Math.max(...t.notes.map((n) => n.depth));
  // Spread rings out when a thread has many tips, so dots don't pile up (~11 units of arc per tip).
  const ring = Math.max(RING, (leaves(t.root.id) * 11) / (2 * Math.PI * Math.max(maxDepth, 1)));
  const local = new Map<string, P>();
  const place = (id: string, a0: number, a1: number, depth: number) => {
    const n = t.notes.find((x) => x.id === id)!;
    const mid = (a0 + a1) / 2, r = depth * ring;
    local.set(id, { x: Math.cos(mid) * r, y: Math.sin(mid) * r });
    let at = a0;
    for (const c of n.children) { const span = ((a1 - a0) * leaves(c)) / leaves(id); place(c, at, at + span, depth + 1); at += span; }
  };
  place(t.root.id, -Math.PI / 2, (3 * Math.PI) / 2, 0);
  return { t, local, radius: Math.max(maxDepth, 1) * ring + PAD };
});
// Pack clusters into rows, biggest first; each row is centred horizontally and its clusters vertically.
export const W = 1100;
const rows: (typeof clusters)[] = [[]]; let rowW = 0;
for (const c of [...clusters].sort((a, b) => b.radius - a.radius)) {
  if (rowW + c.radius * 2 > W && rows.at(-1)!.length) { rows.push([]); rowW = 0; }
  rows.at(-1)!.push(c); rowW += c.radius * 2;
}
let y = 0;
export const placed = rows.flatMap((row) => {
  const h = Math.max(...row.map((c) => c.radius * 2));
  let x = (W - row.reduce((s, c) => s + c.radius * 2, 0)) / 2;
  const out = row.map((c) => {
    const cx = x + c.radius, cy = y + h / 2; x += c.radius * 2;
    for (const [id, p] of c.local) pos.set(id, { x: cx + p.x, y: cy + p.y });
    return { ...c, cx, cy };
  });
  y += h; return out;
});
export const H = y;
export const edges = allNotes.filter((n) => n.parent && pos.has(n.parent)).map((n) => ({ a: pos.get(n.parent!)!, b: pos.get(n.id)! }))
  .concat(placed.filter((c) => c.t.slug === 'loose-notes').flatMap((c) => c.t.notes.slice(1).map((n) => ({ a: { x: c.cx, y: c.cy }, b: pos.get(n.id)! }))));
export const related = new Set<string>();
export const arcs = allNotes.flatMap((n) => n.related.filter((r) => noteById.has(r)).map((r) => {
  const key = [n.id, r].sort().join('|'); if (related.has(key)) return null; related.add(key);
  const a = pos.get(n.id)!, b = pos.get(r)!; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.25;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}).filter(Boolean)) as string[];
export const books = new Set(allNotes.flatMap((n) => n.books.map((b) => b.href))).size;

// A post as a path through the map: its cards in reading order. Consecutive cards are joined by a
// gentle curve; a post that crosses threads jumps between clusters, and that jump is the link.
export type Trail = { ids: string[]; pts: P[]; d: string; threads: number; box: { x: number; y: number; w: number; h: number } };
export function trailFor(cardIds: string[]): Trail | null {
  const ids = [...new Set(cardIds.filter((id) => pos.has(id)))];
  if (!ids.length) return null;
  const pts = ids.map((id) => pos.get(id)!);
  const d = pts.map((q, i) => {
    if (!i) return `M${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    const a = pts[i - 1], len = Math.hypot(q.x - a.x, q.y - a.y), bend = Math.min(60, len * 0.18);
    const mx = (a.x + q.x) / 2 + ((a.y - q.y) / (len || 1)) * bend, my = (a.y + q.y) / 2 + ((q.x - a.x) / (len || 1)) * bend;
    return `Q${mx.toFixed(1)},${my.toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join(' ');
  const threads = new Set(ids.map((id) => noteById.get(id)!.thread)).size;
  // Crop for small maps: the path's extent plus room for the clusters around it, at least 2:1 wide.
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), pad = 70;
  let x = Math.min(...xs) - pad, y = Math.min(...ys) - pad, w = Math.max(...xs) - x + pad, h = Math.max(...ys) - y + pad;
  if (w < h * 2) { x -= (h * 2 - w) / 2; w = h * 2; } else { y -= (w / 2 - h) / 2; h = w / 2; }
  if (w < 420) { x -= (420 - w) / 2; y -= (210 - h) / 2; w = 420; h = 210; }
  return { ids, pts, d, threads, box: { x, y, w, h } };
}
