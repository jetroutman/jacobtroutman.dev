// Company deck on touch screens: slides side by side, one at a time, like posts. Swipe, the bar's segments,
// Next buttons, or ← →. The layout is in pages/for.css (html.deck-swipe); deck-game.ts still tracks the slides.
import { initSwipeNudge } from './swipe-nudge';

export function initDeckSwipe(deck: HTMLElement) {
  if (!document.documentElement.classList.contains('deck-swipe')) return;
  const track = deck.querySelector<HTMLElement>('[data-track]')!;
  const slides = [...track.querySelectorAll<HTMLElement>('[data-slide]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const name = (i: number) => slides[i].querySelector('h2')?.textContent?.trim() ?? '';
  let cur = 0;

  const go = (i: number) => {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides[i].scrollTop = 0;
    track.scrollTo({ left: i * track.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  };

  // Every slide but the first and last ends with the way forward.
  slides.slice(1, -1).forEach((s, k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'next reveal'; b.dataset.next = '';
    const to = document.createElement('span');
    to.className = 'next-to'; to.textContent = name(k + 2);
    b.append('Next ', to, ' →');
    s.querySelector('.inner')!.append(b);
  });
  const footer = document.querySelector('.wrap > .site-footer');
  if (footer) slides.at(-1)!.querySelector('.inner')!.append(footer);

  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i === cur || !slides[i]) return;
    cur = i;
    history.replaceState(null, '', i === 0 ? location.pathname + location.search : `#${slides[i].id}`);
  }, { passive: true });

  deck.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-next]')) { go(cur + 1); return; }
    const href = t.closest('a')?.getAttribute('href');
    const i = href?.startsWith('#') ? slides.findIndex((s) => `#${s.id}` === href) : -1;
    if (i >= 0) { e.preventDefault(); go(i); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as Element).closest('input, textarea, select, [contenteditable], [role=dialog]')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
  });
  let width = track.clientWidth;
  addEventListener('resize', () => {
    if (track.clientWidth === width) return;
    width = track.clientWidth;
    track.scrollTo({ left: cur * width });
  });

  initSwipeNudge({ track, slides, index: () => cur, go, name });

  // Open on the slide in the URL (a shared link, or coming back from a case file).
  const start = slides.findIndex((s) => `#${s.id}` === location.hash);
  if (start > 0) { cur = start; track.scrollTo({ left: start * track.clientWidth }); }
}
