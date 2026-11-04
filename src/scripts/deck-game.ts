/**
 * Company-page deck + game. Everything stays in the reader's browser (localStorage).
 *
 * Deck: tracks the current slide, marks slides seen after a short dwell, drives the
 * progress bar, and unlocks the final note once every slide has been seen.
 * Game (on by default, obvious off switch): log-style achievement toasts, cursor
 * distance in bowling lanes, hidden achievements, "What would you do?" prompts,
 * and a run summary the reader can email to Jacob.
 */

type Ach = { id: string; title: string; desc: string; hidden?: boolean };

const ACHIEVEMENTS: Ach[] = [
  { id: 'start', title: 'Press play', desc: 'Moved past the intro.' },
  { id: 'evidence', title: 'Evidence locker', desc: 'Saw every piece of evidence.' },
  { id: 'call', title: 'Made a call', desc: 'Answered a "What would you do?"' },
  { id: 'deep', title: 'Deep diver', desc: 'Opened a full case file.' },
  { id: 'complete', title: 'Run complete', desc: 'Saw every slide.' },
  { id: 'strike', title: 'Strike', desc: 'Moved the cursor one bowling lane (18.3 m).' },
  { id: 'same', title: 'Great minds', desc: 'Picked the same option Jacob did.', hidden: true },
  { id: 'back', title: 'Second look', desc: 'Scrolled back to an earlier slide.', hidden: true },
  { id: 'theme', title: 'Night vision', desc: 'Switched the theme.', hidden: true },
  { id: 'console', title: 'Under the hood', desc: 'Found the console and ran jacob.hire().', hidden: true },
  { id: 'konami', title: 'Old school', desc: '↑ ↑ ↓ ↓ ← → ← → B A', hidden: true },
  { id: 'return', title: 'Back again', desc: 'Came back for another visit.', hidden: true },
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
    if (!gameOn) { panel.hidden = true; unlockNote(false); for (const q of $$('[data-quiz]')) q.classList.add('answered'); }
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
  const toast = (tag: string, title: string, desc: string) => {
    if (!gameOn) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<p class="toast-tag"></p><p class="toast-title"></p><p class="toast-desc"></p>`;
    t.querySelector('.toast-tag')!.textContent = `[${tag}]`;
    t.querySelector('.toast-title')!.textContent = title;
    t.querySelector('.toast-desc')!.textContent = desc;
    t.addEventListener('click', () => t.remove());
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstElementChild!.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4200);
  };

  const unlock = (id: string) => {
    if (!gameOn || got.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id)!;
    got.add(id); st.ach = [...got]; save();
    toast(a.hidden ? 'SECRET FOUND' : 'ACHIEVEMENT', a.title, a.desc);
    renderHud(); renderPanel(); renderSummary();
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
    for (const el of $$('[data-ach-count]')) el.textContent = `${got.size}/${ACHIEVEMENTS.length}`;
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
    if (left) left.textContent = remaining ? `${remaining} to go.` : '';
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
    hire() { unlock('console'); return gameOn ? 'Achievement unlocked: Under the hood. The email button is on the last slide.' : 'Turn the game back on first.'; },
  };
  console.log('%cHey, engineer.%c Looking under the hood? Type jacob.hire() for an achievement.',
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
