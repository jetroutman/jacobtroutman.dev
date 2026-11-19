// Tells Jacob's tracking API that a real person opened this company page and how far they got.
// Sends: this page, a random browser id, a random visit id, slides reached, active time, touch or mouse.
// Never sends what's typed here, the game score, or anything that names the reader.
// Nothing is sent until someone actually scrolls, taps, types or moves a mouse (presence.ts).
import { beacon, onHuman, read, trackingAllowed, write } from './presence';

const VISIT_GAP = 30 * 60 * 1000; // a new visit after this long away
const DWELL = 700;

export function initDeckTrack(deck: HTMLElement) {
  if (!trackingAllowed()) return;

  const slides = [...deck.querySelectorAll<HTMLElement>('[data-slide]')];
  const visitor = read(localStorage, 'jt-visitor') ?? crypto.randomUUID();
  write(localStorage, 'jt-visitor', visitor);
  let visit = crypto.randomUUID();
  try {
    const last = JSON.parse(read(sessionStorage, 'jt-visit') ?? 'null');
    if (last && Date.now() - last.at < VISIT_GAP) visit = last.id;
  } catch {}

  const seen = new Set<number>();
  let human = false, reached = 0, timer = 0, sent = '';
  let activeMs = 0, since = document.hidden ? 0 : performance.now();
  const active = () => Math.round(activeMs + (since ? performance.now() - since : 0));

  const send = () => {
    clearTimeout(timer);
    if (!human) return;
    const body = JSON.stringify({
      slug: deck.dataset.deck, visitor, visit, slide: slides[reached].id, reached, seen: seen.size, total: slides.length,
      activeMs: active(), device: matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse',
    });
    if (body === sent) return;
    sent = body;
    write(sessionStorage, 'jt-visit', JSON.stringify({ id: visit, at: Date.now() }));
    beacon('/api/track', JSON.parse(body));
  };
  const soon = () => { clearTimeout(timer); timer = window.setTimeout(send, 1000); };

  onHuman(() => { human = true; send(); });

  // ---------- how far? A slide counts once it has held the middle of the screen. ----------
  const dwell = new Map<Element, number>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) { clearTimeout(dwell.get(e.target)); continue; }
      dwell.set(e.target, window.setTimeout(() => {
        const i = slides.indexOf(e.target as HTMLElement);
        seen.add(i); reached = Math.max(reached, i);
        soon();
      }, DWELL));
    }
  }, { rootMargin: '-49% -49% -49% -49%' });
  slides.forEach((s) => io.observe(s));

  // ---------- leaving: report the time on the page ----------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { activeMs = active(); since = 0; send(); }
    else since = performance.now();
  });
  addEventListener('pagehide', send);
}
