// Slide nav for posts: progress segments, position label, and content that rises in as each slide arrives.
export function initPostDeck() {
  document.documentElement.classList.add('deck-js');
  const slides = [...document.querySelectorAll<HTMLElement>('[data-slide]')];
  const segs = new Map([...document.querySelectorAll<HTMLAnchorElement>('[data-seg]')].map((a) => [a.dataset.seg!, a]));
  const pos = document.querySelector('[data-pos]'), label = document.querySelector('[data-label]');
  const seen = new Set<number>();
  const update = (cur: number) => {
    seen.add(cur);
    slides.forEach((s, i) => {
      const seg = segs.get(s.id)!;
      seg.classList.toggle('current', i === cur);
      seg.classList.toggle('done', seen.has(i) && i !== cur);
      if (i === cur) seg.setAttribute('aria-current', 'step'); else seg.removeAttribute('aria-current');
    });
    if (pos) pos.textContent = String(cur + 1).padStart(2, '0');
    if (label) label.textContent = slides[cur].dataset.title || '';
  };
  const track = document.querySelector<HTMLElement>('[data-track]')!;
  const phone = matchMedia('(max-width: 700px)');
  const sideways = () => phone.matches && track.scrollWidth > track.clientWidth + 1;
  // Phones: swipe between slides. The bar's segments jump sideways, and the deck pins under the bar on first swipe.
  let pinned = false;
  const pin = () => { if (pinned || !sideways()) return; pinned = true; const bar = document.querySelector('.deckbar') as HTMLElement; scrollTo({ top: scrollY + bar.getBoundingClientRect().top, behavior: 'smooth' }); };
  track.addEventListener('scroll', () => {
    if (!sideways()) return;
    pin();
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (slides[i]) { slides[i].classList.add('shown'); update(i); }
  }, { passive: true });
  for (const [id, a] of segs) a.addEventListener('click', (e) => {
    if (!sideways()) return;
    e.preventDefault();
    const i = slides.findIndex((s) => s.id === id);
    pin();
    track.scrollTo({ left: i * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  const io = new IntersectionObserver((entries) => {
    if (sideways()) return;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const s = e.target as HTMLElement;
      s.classList.add('shown');
      update(slides.indexOf(s));
    }
  }, { rootMargin: '-45% 0px -45% 0px' }); // the slide crossing the middle of the screen is current
  slides.forEach((s) => io.observe(s));
  if (sideways()) { slides[0].classList.add('shown'); update(0); }
  // Anything already above the fold shows at once.
  requestAnimationFrame(() => { for (const s of slides) if (s.getBoundingClientRect().top < innerHeight * 0.9) s.classList.add('shown'); });
  // Slides further down reveal as soon as they start to enter.
  const pre = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) (e.target as HTMLElement).classList.add('shown'); }, { rootMargin: '0px 0px -15% 0px' });
  slides.forEach((s) => pre.observe(s));
}
