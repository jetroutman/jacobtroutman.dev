// Counts a view of this page: sends only its path, once per tab session, after a real person shows up.
// Company pages have their own tracker (deck-track.ts); admin, drafts and sign-in pages aren't counted.
import { beacon, onHuman, read, trackingAllowed, write } from './presence';

const SKIP = /^\/(for|admin|drafts|signin-again)(\/|$)/;

export function initPageViews() {
  const path = location.pathname;
  if (!trackingAllowed() || SKIP.test(path)) return;
  let viewed: string[] = [];
  try { viewed = JSON.parse(read(sessionStorage, 'jt-viewed') ?? '[]'); } catch {}
  if (viewed.includes(path)) return;
  onHuman(() => {
    write(sessionStorage, 'jt-viewed', JSON.stringify([...viewed, path].slice(-200)));
    beacon('/api/view', { path });
  });
}
