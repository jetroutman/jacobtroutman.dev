// Shared by the site's counters: is tracking allowed in this browser, and is a real person here?
// Link scanners and crawlers load pages too, so nothing counts until someone scrolls, taps, types or moves a mouse.
export const SITE = 'jacobtroutman.dev';
const SETTLE = 800; // input before this is the page loading, not a person

export const read = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
export const write = (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch {} };

/** Only on the live site, and never in Jacob's browsers (opening /admin/ sets jt-owner). */
export const trackingAllowed = () => location.hostname === SITE && !read(localStorage, 'jt-owner');

export function beacon(url: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  if (!navigator.sendBeacon?.(url, blob)) fetch(url, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
}

/** Calls back once, on the first sign of a real person. */
export function onHuman(callback: () => void) {
  const SIGNS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  let moved = 0, lastX: number | null = null, lastY = 0;
  const confirm = (e: Event) => {
    if (!e.isTrusted || document.hidden || performance.now() < SETTLE) return;
    for (const s of SIGNS) removeEventListener(s, confirm);
    removeEventListener('pointermove', onMove);
    callback();
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (lastX !== null) moved += Math.hypot(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    if (moved > 40) confirm(e);
  };
  for (const s of SIGNS) addEventListener(s, confirm, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
}
