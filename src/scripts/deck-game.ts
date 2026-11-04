/**
 * Company-page deck + game. Everything stays in the reader's browser (localStorage).
 *
 * Deck: tracks the current slide, marks slides seen after a short dwell, drives the
 * progress bar, and unlocks the final note once every slide has been seen.
 * Game (on by default, obvious off switch): game-style achievement pops, cursor
 * distance in bowling lanes, hidden achievements, "What would you do?" prompts,
 * and a run summary the reader can email to Jacob.
 */

type Ach = { id: string; title: string; desc: string; hidden?: boolean };

const ACHIEVEMENTS: Ach[] = [
  { id: 'start', title: 'Press play', desc: 'You scrolled. Bold opening move.' },
  { id: 'evidence', title: 'Evidence locker', desc: 'Every exhibit, examined.' },
  { id: 'call', title: 'Made a call', desc: 'You weighed in on a real decision I made.' },
  { id: 'deep', title: 'Deep diver', desc: 'You opened a full case file. Respect.' },
  { id: 'complete', title: 'Run complete', desc: 'You saw every slide. Thanks for sticking around.' },
  { id: 'strike', title: 'Strike', desc: 'Your cursor just bowled a full 60 ft lane.' },
  { id: 'same', title: 'Great minds', desc: 'You picked what I actually shipped.', hidden: true },
  { id: 'back', title: 'Second look', desc: 'You went back for another look. I do that too.', hidden: true },
  { id: 'theme', title: 'Night vision', desc: 'You found the light switch.', hidden: true },
  { id: 'console', title: 'Under the hood', desc: 'You opened the console. Of course you did.', hidden: true },
  { id: 'konami', title: 'Old school', desc: '↑ ↑ ↓ ↓ ← → ← → B A. You remembered.', hidden: true },
  { id: 'return', title: 'Back again', desc: 'You came back. I\'ll take it.', hidden: true },
];

const LANE_M = 18.288; // 60 ft
const PX_TO_M = 0.0254 / 96; // CSS px are 1/96 in
const DWELL = 700;

type State = { seen: string[]; ach: string[]; dist: number; ms: number; visits: number; answers: Record<string, number> };

export function initDeck(deck: HTMLElement) {
  const slug = deck.dataset.deck!;
  const company = deck.dataset.company!;
  const key = `jt-deck-${slug}`;
  const root = document.documentElement;
  const $ = <T extends Element = HTMLElement>(sel: string) => deck.querySelector<T>(sel) as T | null;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

  // ---------- state ----------
  let st: State = { seen: [], ach: [], dist: 0, ms: 0, visits: 0, answers: {} };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch {}
  const save = () => { try { localStorage.setItem(key, JSON.stringify(st)); } catch {} };
  const seen = new Set(st.seen);
  const got = new Set(st.ach);

  let gameOn = true;
  try { gameOn = localStorage.getItem('jt-game') !== 'off'; } catch {}

  // ---------- elements ----------
  const slides = [...deck.querySelectorAll<HTMLElement>('[data-slide]')];
  const required = slides.filter((s) => !s.hasAttribute('data-note')).map((s) => s.id);
  const evidenceIds = slides.filter((s) => s.hasAttribute('data-evidence')).map((s) => s.id);
  const segs = new Map($$<HTMLAnchorElement>('[data-seg]').map((a) => [a.dataset.seg!, a]));
  const pos = $('[data-pos]');
  const label = $('[data-label]');
  const locked = $('[data-locked]');
  const bonus = $('[data-bonus]');
  const left = $('[data-left]');
  const toasts = document.querySelector<HTMLElement>('[data-toasts]')!;
  const panel = document.querySelector<HTMLElement>('[data-ach-panel]')!;
  const list = panel.querySelector<HTMLElement>('[data-ach-list]')!;

  // ---------- game on / off ----------
  const applyGame = () => {
    root.classList.toggle('game-off', !gameOn);
    for (const b of $$<HTMLButtonElement>('[data-game-toggle]')) {
      b.setAttribute('aria-pressed', String(gameOn));
      const state = b.querySelector('[data-game-state]');
      if (state) state.textContent = gameOn ? 'on' : 'off';
      const flip = b.querySelector('[data-game-flip]');
      if (flip) flip.textContent = gameOn ? 'off' : 'on';
    }
    if (!gameOn) { queue.length = 0; displayCount = got.size; panel.hidden = true; unlockNote(false); for (const q of $$('[data-quiz]')) q.classList.add('answered'); }
    else for (const q of $$<HTMLElement>('[data-quiz]')) q.classList.toggle('answered', q.dataset.quiz! in st.answers);
    renderHud();
  };
  for (const b of $$<HTMLButtonElement>('[data-game-toggle]')) b.addEventListener('click', () => {
    gameOn = !gameOn;
    try { localStorage.setItem('jt-game', gameOn ? 'on' : 'off'); } catch {}
    applyGame();
    if (gameOn) updateNoteLock();
  });

  // ---------- toasts + achievements ----------
  // Achievement pop: one at a time, top-center. It drops in, the badge pops with a
  // ring and a shine sweeps across, then it flies into the Achievements counter,
  // which bumps and ticks up. Reduced motion: a plain fade, same timing.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const queue: Ach[] = [];
  let showing = false;
  let displayCount = got.size; // what the HUD shows; ticks up when a pop lands
  let firstPop = got.size === 0;

  const hudTarget = () => {
    const b = document.querySelector<HTMLElement>('.deckbar [data-ach-open]');
    return b && b.offsetParent ? b : null;
  };
  const bumpHud = () => {
    displayCount = Math.min(displayCount + 1, got.size);
    renderHud();
    const b = hudTarget();
    if (b && !reduced) b.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.22)', borderColor: 'var(--amber)' }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    b?.classList.add('flash'); setTimeout(() => b?.classList.remove('flash'), 900);
  };

  const pop = (a: Ach) => {
    const n = ACHIEVEMENTS.indexOf(a) + 1;
    const t = document.createElement('button');
    t.type = 'button';
    t.className = `pop${a.hidden ? ' secret' : ''}`;
    t.setAttribute('aria-label', `${a.hidden ? 'Secret found' : 'Achievement unlocked'}: ${a.title}. ${a.desc}`);
    t.innerHTML = `<span class="pop-badge"><span></span></span><span class="pop-body"><span class="pop-tag"></span><span class="pop-title"></span><span class="pop-desc"></span><span class="pop-hint"></span></span><span class="pop-shine" aria-hidden="true"></span>`;
    t.querySelector('.pop-badge span')!.textContent = a.hidden ? '?' : String(n).padStart(2, '0');
    t.querySelector('.pop-tag')!.textContent = a.hidden ? 'Secret found' : 'Achievement unlocked';
    t.querySelector('.pop-title')!.textContent = a.title;
    t.querySelector('.pop-desc')!.textContent = a.desc;
    t.querySelector('.pop-hint')!.textContent = firstPop
      ? `${got.size} of ${ACHIEVEMENTS.length} found. Your trophies live up top ↗`
      : `${got.size - (queue.length)} of ${ACHIEVEMENTS.length} found`;
    firstPop = false;
    t.addEventListener('click', () => { panel.hidden = false; renderPanel(); finish(); });
    toasts.append(t);

    let done = false;
    const finish = () => {
      if (done) return; done = true;
      const target = hudTarget();
      if (!reduced && target) {
        const from = t.getBoundingClientRect(), to = target.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        t.animate(
          [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.2 }],
          { duration: 520, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' },
        ).finished.then(() => { t.remove(); bumpHud(); next(); });
      } else {
        t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' })
          .finished.then(() => { t.remove(); bumpHud(); next(); });
      }
    };
    if (reduced) t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    else {
      t.animate(
        [{ transform: 'translateY(48px) scale(0.85)', opacity: 0 }, { transform: 'translateY(-6px) scale(1.04)', opacity: 1, offset: 0.65 }, { transform: 'none', opacity: 1 }],
        { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1)' });
      t.querySelector('.pop-badge')!.animate(
        [{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'scale(1.3) rotate(8deg)', offset: 0.6 }, { transform: 'none' }],
        { duration: 640, delay: 140, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'backwards' });
    }
    setTimeout(finish, a.hidden ? 3600 : 3000);
  };
  const next = () => {
    const a = queue.shift();
    if (!a || !gameOn) { showing = false; return; }
    showing = true;
    pop(a);
  };

  const unlock = (id: string) => {
    if (!gameOn || got.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id)!;
    got.add(id); st.ach = [...got]; save();
    queue.push(a);
    if (!showing) next();
    renderPanel(); renderSummary();
  };

  const renderPanel = () => {
    const hiddenLeft = ACHIEVEMENTS.filter((a) => a.hidden && !got.has(a.id)).length;
    list.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const li = document.createElement('li');
      const has = got.has(a.id);
      li.className = has ? 'got' : 'todo';
      const t = document.createElement('p'); t.className = 'ach-title';
      const d = document.createElement('p'); d.className = 'ach-desc';
      t.textContent = has || !a.hidden ? a.title : '???';
      d.textContent = has || !a.hidden ? a.desc : 'Hidden. Keep poking around.';
      li.append(t, d); list.append(li);
    }
    panel.querySelector('[data-ach-hidden]')!.textContent = hiddenLeft ? `${hiddenLeft} hidden left` : 'All secrets found';
  };

  const fmtTime = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`; };
  const meters = () => st.dist * PX_TO_M;
  const lanes = () => meters() / LANE_M;

  const renderHud = () => {
    for (const el of $$('[data-ach-count]')) el.textContent = `${displayCount}/${ACHIEVEMENTS.length}`;
    const d = document.querySelector('[data-dist]');
    if (d) d.textContent = `${lanes().toFixed(2)} lanes`;
  };

  const summaryText = () => {
    const found = ACHIEVEMENTS.filter((a) => got.has(a.id)).map((a) => a.title);
    return {
      subject: `Played your ${company} page: ${got.size}/${ACHIEVEMENTS.length} achievements, ${lanes().toFixed(2)} lanes, ${fmtTime(st.ms)}`,
      body: `Hi Jacob,\n\nI made it through your ${company} page.\n\nAchievements: ${got.size} of ${ACHIEVEMENTS.length}${found.length ? ` (${found.join(', ')})` : ''}\nCursor distance: ${meters().toFixed(1)} m (${lanes().toFixed(2)} lanes)\nTime on page: ${fmtTime(st.ms)}\nSlides seen: ${seen.size} of ${slides.length}\n\n`,
    };
  };
  const renderSummary = () => {
    const s = document.querySelector('[data-summary]');
    if (!s) return;
    s.querySelector('[data-s-ach]')!.textContent = `${got.size} / ${ACHIEVEMENTS.length}`;
    s.querySelector('[data-s-dist]')!.textContent = `${meters().toFixed(1)} m`;
    s.querySelector('[data-s-lanes]')!.textContent = `${lanes().toFixed(2)} lanes`;
    s.querySelector('[data-s-time]')!.textContent = fmtTime(st.ms);
    s.querySelector('[data-s-slides]')!.textContent = `${seen.size} / ${slides.length}`;
    const { subject, body } = summaryText();
    const mail = s.querySelector<HTMLAnchorElement>('[data-mail]')!;
    mail.href = `mailto:${mail.dataset.mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  document.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    const { subject, body } = summaryText();
    try { await navigator.clipboard.writeText(`${subject}\n\n${body}`); b.textContent = 'Copied'; }
    catch { b.textContent = 'Copy failed'; }
    setTimeout(() => (b.textContent = 'Copy score'), 2000);
  });

  // Achievements panel
  for (const b of $$('[data-ach-open]')) b.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    b.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) renderPanel();
  });
  panel.querySelector('[data-ach-close]')?.addEventListener('click', () => { panel.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.hidden = true; });

  // ---------- slides ----------
  let current = slides[0];
  let maxIndex = 0;
  let unlocked = required.every((id) => seen.has(id));

  function unlockNote(animate: boolean) {
    if (!locked || !bonus) return;
    locked.hidden = true; bonus.hidden = false;
    if (animate) bonus.classList.add('fresh');
  }
  function updateNoteLock() {
    if (!locked || !bonus) return;
    if (!gameOn || unlocked) { unlockNote(false); return; }
    locked.hidden = false; bonus.hidden = true;
  }

  const update = () => {
    const i = slides.indexOf(current);
    if (pos) pos.textContent = String(i + 1).padStart(2, '0');
    if (label) label.textContent = segs.get(current.id)?.getAttribute('aria-label')?.replace(/^\d+: /, '') ?? '';
    for (const [id, a] of segs) {
      a.classList.toggle('done', seen.has(id));
      a.classList.toggle('current', id === current.id);
      id === current.id ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current');
    }
    const remaining = required.filter((id) => !seen.has(id)).length;
    if (left) left.textContent = remaining ? `${remaining} ${remaining === 1 ? 'slide' : 'slides'} to go.` : '';
    if (!unlocked && remaining === 0) {
      unlocked = true;
      if (gameOn) { unlockNote(true); unlock('complete'); }
    }
    if (evidenceIds.length && evidenceIds.every((id) => seen.has(id))) unlock('evidence');
    renderSummary();
  };

  const markSeen = (slide: HTMLElement) => {
    if (seen.has(slide.id)) return;
    seen.add(slide.id); st.seen = [...seen]; save();
    if (slides.indexOf(slide) >= 1) unlock('start');
    update();
  };

  for (const s of slides) if (seen.has(s.id)) s.classList.add('shown');
  const timers = new Map<HTMLElement, number>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const slide = e.target as HTMLElement;
      if (e.isIntersecting) {
        current = slide;
        slide.classList.add('shown');
        const i = slides.indexOf(slide);
        if (i < maxIndex) unlock('back');
        maxIndex = Math.max(maxIndex, i);
        update();
        timers.set(slide, window.setTimeout(() => markSeen(slide), DWELL));
      } else clearTimeout(timers.get(slide));
    }
  }, { threshold: 0.5 });
  slides.forEach((s) => io.observe(s));

  // ---------- "What would you do?" ----------
  for (const q of $$<HTMLElement>('[data-quiz]')) {
    const id = q.dataset.quiz!;
    const show = (i: number) => {
      q.classList.add('answered');
      for (const b of q.querySelectorAll<HTMLButtonElement>('[data-option]')) {
        const mine = Number(b.dataset.option) === i;
        b.classList.toggle('picked', mine);
        b.disabled = true;
      }
      for (const r of q.querySelectorAll<HTMLElement>('[data-reply]')) r.hidden = Number(r.dataset.reply) !== i;
    };
    if (id in st.answers) show(st.answers[id]);
    for (const b of q.querySelectorAll<HTMLButtonElement>('[data-option]')) b.addEventListener('click', () => {
      const i = Number(b.dataset.option);
      st.answers[id] = i; save();
      show(i);
      unlock('call');
      if (b.hasAttribute('data-chosen')) unlock('same');
    });
  }

  // ---------- other triggers ----------
  for (const a of $$('[data-case-link]')) a.addEventListener('click', () => unlock('deep'));
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => unlock('theme'));

  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let k = 0;
  document.addEventListener('keydown', (e) => {
    k = e.key.toLowerCase() === konami[k].toLowerCase() ? k + 1 : (e.key === konami[0] ? 1 : 0);
    if (k === konami.length) { k = 0; unlock('konami'); }
  });

  (window as unknown as { jacob: object }).jacob = {
    hire() { unlock('console'); return gameOn ? 'Achievement unlocked: Under the hood. My email button is on the last slide.' : 'Turn the game back on first.'; },
  };
  console.log('%cHey, you opened the console.%c Type jacob.hire() and I\'ll make it worth your while.',
    'font: 600 14px system-ui; color: #E18528', 'font: 13px system-ui');

  // Visits (once per browser session)
  try {
    if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); st.visits += 1; save(); }
  } catch {}
  if (st.visits >= 2) setTimeout(() => unlock('return'), 1200);

  // Distance: cursor on mouse/pen; scroll distance on touch screens.
  let lastX: number | null = null, lastY: number | null = null, lastScroll = scrollY, lastStrike = got.has('strike');
  const addDist = (px: number) => {
    st.dist += px;
    if (!lastStrike && lanes() >= 1) { lastStrike = true; unlock('strike'); }
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (lastX !== null && lastY !== null) addDist(Math.hypot(e.clientX - lastX, e.clientY - lastY));
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });
  if (matchMedia('(pointer: coarse)').matches) {
    for (const el of $$('[data-dist-label]')) el.textContent = 'Scroll';
    addEventListener('scroll', () => { addDist(Math.abs(scrollY - lastScroll)); lastScroll = scrollY; }, { passive: true });
  }

  // Time on page (visible tab only) + periodic save/render
  let tick = performance.now();
  setInterval(() => {
    const now = performance.now();
    if (document.visibilityState === 'visible') st.ms += now - tick;
    tick = now;
    save(); renderHud(); renderSummary();
  }, 1000);
  addEventListener('pagehide', save);

  // ---------- go ----------
  applyGame();
  updateNoteLock();
  renderPanel();
  update();
}
