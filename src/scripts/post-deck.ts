// Post deck: slides side by side, one at a time. Swipe, the bar's arrows and segments, Next buttons, or ← →.
// The deck pins under the bar on first move; content rises in as each slide arrives.
export function initPostDeck() {
  document.documentElement.classList.add('deck-js');
  const track = document.querySelector<HTMLElement>('[data-track]');
  if (!track) return;
  const slides = [...track.querySelectorAll<HTMLElement>('[data-slide]')];
  const segs = [...document.querySelectorAll<HTMLAnchorElement>('[data-seg]')];
  const pos = document.querySelector('[data-pos]'), label = document.querySelector('[data-label]');
  const prev = document.querySelector<HTMLButtonElement>('[data-prev]'), nextBar = document.querySelector<HTMLButtonElement>('[data-nextbar]');
  const bar = document.querySelector<HTMLElement>('.deckbar')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = new Set<number>();
  let cur = -1;

  const update = (i: number) => {
    if (i === cur) return;
    cur = i; seen.add(i);
    slides[i].classList.add('shown');
    segs.forEach((a, k) => {
      a.classList.toggle('current', k === i);
      a.classList.toggle('done', seen.has(k) && k !== i);
      if (k === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    if (pos) pos.textContent = String(i + 1).padStart(2, '0');
    if (label) label.textContent = slides[i].dataset.title || '';
    if (prev) prev.disabled = i === 0;
    if (nextBar) nextBar.disabled = i === slides.length - 1;
    history.replaceState(null, '', i === 0 ? location.pathname + location.search : `#${slides[i].id}`);
  };

  let pinned = false;
  const pin = () => {
    if (pinned) return; pinned = true;
    const top = scrollY + bar.getBoundingClientRect().top;
    if (top > scrollY + 1) scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  };
  const go = (i: number) => {
    i = Math.max(0, Math.min(slides.length - 1, i));
    pin();
    slides[i].scrollTop = 0;
    track.scrollTo({ left: i * track.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  };

  track.addEventListener('scroll', () => { pin(); update(Math.round(track.scrollLeft / track.clientWidth)); }, { passive: true });
  segs.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); go(i); }));
  prev?.addEventListener('click', () => go(cur - 1));
  nextBar?.addEventListener('click', () => go(cur + 1));
  for (const b of track.querySelectorAll<HTMLButtonElement>('[data-next]')) b.addEventListener('click', () => go(cur + 1));
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable], [role=dialog]')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
  });
  addEventListener('resize', () => track.scrollTo({ left: cur * track.clientWidth }));

  // Open on the slide in the URL, if any.
  const start = Math.max(0, slides.findIndex((s) => `#${s.id}` === location.hash));
  update(start);
  if (start > 0) requestAnimationFrame(() => track.scrollTo({ left: start * track.clientWidth }));
}
