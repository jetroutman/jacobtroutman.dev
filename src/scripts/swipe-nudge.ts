// Swipe decks go sideways, but a reader at the bottom of a slide pushes up for more. When they do,
// say where the rest is and, until they've swiped once, slide the next page into view for a moment.
import '../styles/components/swipe-nudge.css';

const PULL = 32; // px of push past the bottom that counts as asking for more
const SHOW_MS = 3200;

type Options = {
  track: HTMLElement;
  slides: HTMLElement[];
  index: () => number;
  go: (i: number) => void;
  name: (i: number) => string;
};

export function initSwipeNudge({ track, slides, index, go, name }: Options) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'swipe-nudge';
  el.hidden = true;
  el.innerHTML = '<span class="sn-arrow" aria-hidden="true">←</span><span class="sn-text"><strong>Swipe left to continue</strong><span class="sn-next"></span></span>';
  document.body.append(el);
  const next = el.querySelector('.sn-next')!;

  let timer = 0, hasSwiped = false, stopPeek = () => {};
  const hide = () => { clearTimeout(timer); el.hidden = true; };

  const peek = (i: number) => {
    if (reduced || hasSwiped) return;
    const to = slides[i + 1];
    track.classList.add('sn-peeking'); // snap points follow transforms, so snapping sits this out
    to.classList.add('sn-peek', 'shown');
    const moves = [slides[i], to].map((s) => s.animate(
      [{ transform: 'none' }, { transform: 'translateX(-56px)', offset: 0.4 }, { transform: 'none' }],
      { duration: 760, easing: 'cubic-bezier(.3, 0, .2, 1)' },
    ));
    moves[1].onfinish = moves[1].oncancel = () => { track.classList.remove('sn-peeking'); to.classList.remove('sn-peek'); };
    stopPeek = () => moves.forEach((m) => m.cancel());
  };

  const show = () => {
    const i = index();
    if (i >= slides.length - 1) return;
    const wasHidden = el.hidden;
    next.textContent = `Next: ${name(i + 1)}`;
    el.hidden = false;
    if (wasHidden) peek(i);
    clearTimeout(timer);
    timer = window.setTimeout(hide, SHOW_MS);
  };

  el.addEventListener('click', () => { hide(); go(index() + 1); });

  // ---------- the gesture ----------
  let slide: HTMLElement | null = null, startX = 0, baseY = 0, touching = false;
  const atBottom = (s: HTMLElement) =>
    s.scrollTop + s.clientHeight >= s.scrollHeight - 2 && track.getBoundingClientRect().bottom <= innerHeight + 2;
  const check = (t: Touch) => {
    if (!slide) return;
    if (!atBottom(slide)) { baseY = t.clientY; return; } // still reading: count from where the bottom was reached
    const up = baseY - t.clientY;
    if (up >= PULL && up > Math.abs(t.clientX - startX) * 1.5) { slide = null; show(); }
  };

  track.addEventListener('touchstart', (e) => {
    touching = true;
    stopPeek();
    const target = e.target as Element, t = e.touches[0];
    const typing = target.closest('input, textarea, select') || document.activeElement?.matches('input, textarea, select');
    slide = e.touches.length === 1 && !typing ? target.closest<HTMLElement>('[data-slide]') : null;
    startX = t.clientX; baseY = t.clientY;
  }, { passive: true });
  track.addEventListener('touchmove', (e) => { if (e.touches.length > 1) slide = null; else check(e.touches[0]); }, { passive: true });
  track.addEventListener('touchend', (e) => { check(e.changedTouches[0]); slide = null; touching = e.touches.length > 0; }, { passive: true });
  track.addEventListener('touchcancel', () => { slide = null; touching = false; }, { passive: true });

  // Moving sideways means the message landed.
  track.addEventListener('scroll', () => {
    if (Math.abs(track.scrollLeft - index() * track.clientWidth) < 12) return;
    if (touching) hasSwiped = true;
    hide();
  }, { passive: true });
}
