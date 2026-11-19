// Tells Jacob's tracking API that a real person opened this company page and how far they got.
// Sends: this page, a random browser id, a random visit id, slides reached, active time, touch or mouse.
// Never sends what's typed here, the game score, or anything that names the reader.
// Link scanners load pages too, so nothing is sent until someone actually scrolls, taps, types or moves a mouse.
const SITE = 'jacobtroutman.dev';
const VISIT_GAP = 30 * 60 * 1000; // a new visit after this long away
const SETTLE = 800, DWELL = 700;

const read = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
const write = (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch {} };

export function initDeckTrack(deck: HTMLElement) {
  if (location.hostname !== SITE || read(localStorage, 'jt-owner')) return; // set by opening /admin/

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
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/track', blob))
      fetch('/api/track', { method: 'POST', body: blob, keepalive: true }).catch(() => {});
  };
  const soon = () => { clearTimeout(timer); timer = window.setTimeout(send, 1000); };

  // ---------- is someone there? ----------
  const SIGNS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  let moved = 0, lastX: number | null = null, lastY = 0;
  const confirm = (e: Event) => {
    if (!e.isTrusted || document.hidden || performance.now() < SETTLE) return;
    human = true;
    for (const s of SIGNS) removeEventListener(s, confirm);
    removeEventListener('pointermove', onMove);
    send();
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (lastX !== null) moved += Math.hypot(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    if (moved > 40) confirm(e);
  };
  for (const s of SIGNS) addEventListener(s, confirm, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });

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
