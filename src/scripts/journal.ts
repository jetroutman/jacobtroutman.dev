/**
 * Journal reader layer. Everything stays in this browser (localStorage 'jt-journal').
 * - An entry counts as read when it has been mostly on screen for ~2.5s, or its link was opened.
 * - "New" marks entries dated after your last visit (on a later day).
 * - Connection chips jump to the linked entry; following three is an achievement.
 * - Achievements pop as a toast unless the site-wide game switch ('jt-game') is off.
 * No streaks and nothing to lose: the game rewards reading and exploring, not showing up on schedule.
 */
type Ach = { id: string; title: string; desc: string; hidden?: boolean };
type State = { read: string[]; ach: string[]; trail: number; last: string | null; seen: string | null };

const KEY = 'jt-journal';
const DWELL = 2500;

export function initJournal() {
  const cfgEl = document.querySelector('[data-ach-json]');
  if (!cfgEl) return;
  const { ach: ACH, threadsTotal } = JSON.parse(cfgEl.textContent || '{}') as { ach: Ach[]; threadsTotal: number };
  const root = document.documentElement;
  const today = new Date().toISOString().slice(0, 10);

  let st: State = { read: [], ach: [], trail: 0, last: null, seen: null };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  const read = new Set(st.read);
  const got = new Set(st.ach);

  let gameOn = true;
  try { gameOn = localStorage.getItem('jt-game') !== 'off'; } catch {}

  const arts = [...document.querySelectorAll<HTMLElement>('[data-entry]')];
  const byId = new Map(arts.map((a) => [a.dataset.entry!, a]));
  const total = arts.length;
  const nEl = document.querySelector('[data-read-n]')!;
  const bar = document.querySelector<HTMLElement>('[data-read-bar]')!;
  const hint = document.querySelector<HTMLElement>('[data-run-hint]')!;
  const endgame = document.querySelector<HTMLElement>('[data-endgame]')!;
  const unreadBtn = document.querySelector<HTMLButtonElement>('[data-unread]')!;
  const toasts = document.querySelector<HTMLElement>('[data-toasts]')!;
  const achN = document.querySelector<HTMLElement>('[data-ach-n]')!;
  const achWrap = document.querySelector<HTMLDetailsElement>('[data-ach-wrap]')!;
  if (matchMedia('(min-width: 960px)').matches) achWrap.open = true;

  // ---------- "New since your last visit" ----------
  // `seen` is the day of the previous visit; it only moves forward once per day, so "New" survives reloads today.
  const prevVisit = st.last && st.last < today ? st.last : st.seen;
  if (st.last && st.last < today) st.seen = st.last;
  if (prevVisit) for (const a of arts) if (a.dataset.date! > prevVisit && !read.has(a.dataset.entry!)) a.querySelector<HTMLElement>('[data-new]')!.hidden = false;
  const returning = !!st.last && st.last < today;
  st.last = today; save();

  // ---------- rendering ----------
  const render = () => {
    for (const a of arts) {
      const r = read.has(a.dataset.entry!);
      a.classList.toggle('is-read', r);
      a.querySelector<HTMLElement>('[data-read-mark]')!.hidden = !r;
      if (r) a.querySelector<HTMLElement>('[data-new]')!.hidden = true;
    }
    for (const c of document.querySelectorAll<HTMLElement>('[data-trail]')) c.classList.toggle('done', read.has(c.dataset.trail!));
    nEl.textContent = String(read.size);
    bar.style.width = `${Math.round((read.size / Math.max(total, 1)) * 100)}%`;
    unreadBtn.hidden = read.size === 0;
    if (read.size > 0) hint.textContent = read.size === total ? 'You have read every entry. Impressive.' : `${total - read.size} left. Connections between entries are the fastest way through.`;
    for (const li of document.querySelectorAll<HTMLElement>('[data-ach-id]')) {
      const a = ACH.find((x) => x.id === li.dataset.achId)!;
      const has = got.has(a.id);
      li.classList.toggle('got', has);
      if (a.hidden && has) { li.querySelector('.ach-title')!.textContent = a.title; li.querySelector('.ach-desc')!.textContent = a.desc; }
    }
    endgame.hidden = !got.has('caught');
    achN.textContent = String(got.size);
  };

  // ---------- achievements ----------
  const queue: Ach[] = [];
  let showing = false;
  const next = () => {
    const a = queue.shift();
    if (!a) { showing = false; return; }
    showing = true;
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span class="t-badge"></span><span><span class="t-tag"></span><span class="t-title"></span><span class="t-desc"></span></span>';
    t.querySelector('.t-badge')!.textContent = a.hidden ? '?' : '✓';
    t.querySelector('.t-tag')!.textContent = `${a.hidden ? 'Secret found' : 'Achievement'} · ${got.size} of ${ACH.length}`;
    t.querySelector('.t-title')!.textContent = a.title;
    t.querySelector('.t-desc')!.textContent = a.desc;
    toasts.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); next(); }, 320); }, 3600);
  };
  const unlock = (id: string) => {
    if (got.has(id)) return;
    got.add(id); st.ach = [...got]; save();
    const a = ACH.find((x) => x.id === id);
    if (a && gameOn) { queue.push(a); if (!showing) next(); }
    render();
  };
  const check = () => {
    const kinds = new Set([...read].map((id) => byId.get(id)?.dataset.kind));
    const threads = new Set([...read].map((id) => byId.get(id)?.dataset.thread).filter(Boolean));
    const latest = arts.filter((a) => a.dataset.latest);
    if (read.size >= 1) unlock('first');
    if (kinds.has('review') && kinds.has('notes') && kinds.has('idea')) unlock('trio');
    if (threads.size >= Math.min(3, threadsTotal) && threadsTotal > 0) unlock('threads');
    if (read.size >= Math.min(10, total)) unlock('ten');
    if (latest.length && latest.every((a) => read.has(a.dataset.entry!))) unlock('caught');
    if (st.trail >= 3) unlock('trail');
  };

  const markRead = (id: string) => {
    if (read.has(id) || !byId.has(id)) return;
    read.add(id); st.read = [...read]; save();
    render(); check();
  };

  // ---------- reading detection ----------
  const timers = new Map<Element, number>();
  const io = new IntersectionObserver((list) => {
    for (const e of list) {
      const id = (e.target as HTMLElement).dataset.entry!;
      // "Mostly on screen": 60% of the entry, or most of the viewport for long ones.
      const visible = e.isIntersecting && (e.intersectionRatio >= 0.6 || e.intersectionRect.height >= innerHeight * 0.5);
      if (visible && !timers.has(e.target) && !read.has(id)) timers.set(e.target, window.setTimeout(() => { timers.delete(e.target); markRead(id); }, DWELL));
      if (!visible && timers.has(e.target)) { clearTimeout(timers.get(e.target)); timers.delete(e.target); }
    }
  }, { threshold: [0, 0.3, 0.6, 1] });
  for (const a of arts) io.observe(a);
  for (const a of arts) for (const l of a.querySelectorAll('[data-open]')) l.addEventListener('click', () => markRead(a.dataset.entry!));

  // ---------- the trail ----------
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = (id: string, from?: string) => {
    let el = byId.get(id); if (!el) return;
    if (el.hidden) { setKind('all'); setUnread(false); reveal(id); el = byId.get(id)!; }
    if (from) markRead(from);
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  };
  for (const c of document.querySelectorAll<HTMLAnchorElement>('[data-trail]')) c.addEventListener('click', (e) => {
    e.preventDefault();
    const id = c.dataset.trail!;
    history.replaceState(null, '', `#${id}`);
    st.trail++; save();
    go(id, c.closest<HTMLElement>('[data-entry]')?.dataset.entry);
    check();
  });
  if (location.hash && byId.has(location.hash.slice(1))) requestAnimationFrame(() => go(location.hash.slice(1)));

  // ---------- filters ----------
  const kinds = [...document.querySelectorAll<HTMLButtonElement>('[data-kind]')].filter((b) => b.tagName === 'BUTTON');
  const empty = document.querySelector<HTMLElement>('[data-empty]')!;
  const PAGE = 30;
  const olderBtn = document.querySelector<HTMLButtonElement>('[data-older]')!;
  let kind = 'all', unreadOnly = false, limit = PAGE;
  const apply = () => {
    let shown = 0, more = false;
    for (const a of arts) {
      const match = !((kind !== 'all' && a.dataset.kind !== kind) || (unreadOnly && read.has(a.dataset.entry!)));
      a.hidden = !match || shown >= limit;
      if (match) { if (shown >= limit) more = true; shown++; }
    }
    olderBtn.hidden = !more;
    let any = false;
    for (const m of document.querySelectorAll<HTMLElement>('[data-month]')) {
      const n = [...m.querySelectorAll<HTMLElement>('[data-entry]')].filter((a) => !a.hidden).length;
      m.hidden = n === 0; any ||= n > 0;
      m.querySelector('[data-month-n]')!.textContent = String(n);
    }
    empty.hidden = any;
  };
  olderBtn.addEventListener('click', () => { limit += PAGE; apply(); });
  const reveal = (id: string) => { const i = arts.findIndex((a) => a.dataset.entry === id); if (i >= limit) { limit = i + 1; apply(); } };
  const setKind = (k: string) => { kind = k; limit = PAGE; for (const b of kinds) b.setAttribute('aria-pressed', String(b.dataset.kind === k)); apply(); };
  const setUnread = (v: boolean) => { unreadOnly = v; unreadBtn.setAttribute('aria-pressed', String(v)); apply(); };
  for (const b of kinds) b.addEventListener('click', () => setKind(b.dataset.kind!));
  unreadBtn.addEventListener('click', () => setUnread(!unreadOnly));

  // ---------- game switch (shared with the company pages) ----------
  const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-game-toggle]')];
  const applyGame = () => {
    root.classList.toggle('game-off', !gameOn);
    for (const b of toggles) { b.setAttribute('aria-pressed', String(gameOn)); b.querySelector('[data-game-state]')!.textContent = gameOn ? 'on' : 'off'; }
    if (!gameOn) { queue.length = 0; toasts.replaceChildren(); }
  };
  for (const b of toggles) b.addEventListener('click', () => {
    gameOn = !gameOn;
    try { localStorage.setItem('jt-game', gameOn ? 'on' : 'off'); } catch {}
    applyGame();
  });

  // ---------- secrets ----------
  for (const r of document.querySelectorAll('[data-rss]')) r.addEventListener('click', () => unlock('rss'));

  applyGame();
  render();
  apply();
  check();
  if (returning) unlock('back');
}
