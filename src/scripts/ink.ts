/**
 * Ink: the site currency. Stored only in this browser (localStorage 'jt-ink').
 * Earn: a card's claim stays on screen ~1.2s (once per post and card), the end of a post (once per post),
 *       and a one-time welcome grant for readers arriving from a company page.
 * Spend: unseal a card's source or branches. Unlocks are per card, so they stay open in every post.
 * Level: from lifetime ink earned (Adler's four levels); spending never lowers it.
 */
import { fromCompany } from './from-company';

type Level = { name: string; at: number; desc: string };
type Cfg = { cardReached: number; postFinished: number; welcome: number; levels: Level[] };
type State = { wallet: number; lifetime: number; earned: string[]; unlocked: string[]; welcomed: string | null };

const KEY = 'jt-ink';
const fresh = (): State => ({ wallet: 0, lifetime: 0, earned: [], unlocked: [], welcomed: null });

export function initInk() {
  const cfgEl = document.querySelector('[data-ink-config]');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent || '{}') as Cfg;
  const post = document.querySelector<HTMLElement>('[data-post]')!;
  const postId = post.dataset.post!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let st: State = fresh();
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

  const pill = document.querySelector<HTMLElement>('[data-hud-pill]')!;
  const walletEl = document.querySelector<HTMLElement>('[data-wallet]')!;
  const levelEl = document.querySelector<HTMLElement>('[data-level]')!;
  const gainEl = document.querySelector<HTMLElement>('[data-gain]')!;
  const toasts = document.querySelector<HTMLElement>('[data-ink-toasts]')!;
  const layers = [...document.querySelectorAll<HTMLElement>('[data-layer]')];

  const levelOf = (n: number) => cfg.levels.reduce((i, l, k) => (n >= l.at ? k : i), 0);

  // ---------- counter ----------
  let shown = st.wallet, tween = 0, bump = 0;
  const paint = () => {
    walletEl.textContent = String(shown);
    const here = document.querySelector('[data-earned-here]');
    if (here) here.textContent = String(st.earned.filter((k) => k.startsWith(`${postId}:`)).reduce((n, k) => n + (k.endsWith(':end') ? cfg.postFinished : cfg.cardReached), 0));
    levelEl.textContent = cfg.levels[levelOf(st.lifetime)].name;
    for (const l of layers) {
      const open = st.unlocked.includes(l.dataset.layer!);
      l.classList.toggle('open', open);
      const btn = l.querySelector<HTMLButtonElement>('[data-unseal]')!;
      const cost = Number(l.dataset.cost);
      btn.disabled = !open && st.wallet < cost;
      l.querySelector('[data-seal-label]')!.textContent = st.wallet < cost ? `Need ${cost} · keep reading` : `Unseal · ${cost}`;
      for (const a of l.querySelectorAll<HTMLAnchorElement>('a')) a.tabIndex = open ? 0 : -1;
    }
  };
  const countTo = (target: number) => {
    cancelAnimationFrame(tween);
    const from = shown, t0 = performance.now(), dur = reduced ? 0 : 500;
    const step = (t: number) => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      shown = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      walletEl.textContent = String(shown);
      if (k < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
    bump++; pill.classList.remove('bumpA', 'bumpB'); void pill.offsetWidth; pill.classList.add(bump % 2 ? 'bumpA' : 'bumpB');
  };

  // ---------- toasts ----------
  const queue: { tag: string; title: string; desc: string; badge: string }[] = [];
  let busy = false;
  const next = () => {
    const t = queue.shift(); if (!t) { busy = false; return; }
    busy = true;
    const el = document.createElement('div');
    el.className = 'it'; el.setAttribute('role', 'status');
    el.innerHTML = '<span class="it-badge"></span><span><span class="it-tag"></span><span class="it-title"></span><span class="it-desc"></span></span>';
    el.querySelector('.it-badge')!.textContent = t.badge;
    el.querySelector('.it-tag')!.textContent = t.tag;
    el.querySelector('.it-title')!.textContent = t.title;
    el.querySelector('.it-desc')!.textContent = t.desc;
    toasts.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); next(); }, 300); }, 4200);
  };
  const toast = (t: (typeof queue)[number]) => { queue.push(t); if (!busy) next(); };

  // ---------- earning ----------
  const earn = (key: string | null, n: number, why?: string) => {
    if (key && st.earned.includes(key)) return;
    const before = levelOf(st.lifetime);
    if (key) st.earned.push(key);
    st.wallet += n; st.lifetime += n; save();
    gainEl.textContent = `+${n}${why ? ` ${why}` : ''}`;
    gainEl.classList.remove('show'); void gainEl.offsetWidth; gainEl.classList.add('show');
    countTo(st.wallet); paint();
    const after = levelOf(st.lifetime);
    if (after > before) { const l = cfg.levels[after]; toast({ tag: 'Level up', title: `${l.name} reader`, desc: l.desc, badge: String(after + 1) }); }
  };

  const timers = new Map<Element, number>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      const key = el.dataset.card ? `${postId}:${el.dataset.card}` : `${postId}:end`;
      if (st.earned.includes(key)) { io.unobserve(el); continue; }
      if (e.isIntersecting && !timers.has(el)) {
        timers.set(el, window.setTimeout(() => {
          timers.delete(el); io.unobserve(el);
          if (el.dataset.card) { el.classList.add('reached'); earn(key, cfg.cardReached); }
          else earn(key, cfg.postFinished, 'post finished');
        }, el.dataset.card ? 1200 : 600));
      } else if (!e.isIntersecting && timers.has(el)) { clearTimeout(timers.get(el)); timers.delete(el); }
    }
  }, { threshold: 0.6 });
  for (const c of document.querySelectorAll<HTMLElement>('[data-card]')) {
    if (st.earned.includes(`${postId}:${c.dataset.card}`)) c.classList.add('reached'); else io.observe(c);
  }
  const end = document.querySelector<HTMLElement>('[data-post-end]');
  if (end) io.observe(end);

  // ---------- spending ----------
  for (const l of layers) l.querySelector<HTMLButtonElement>('[data-unseal]')!.addEventListener('click', () => {
    const key = l.dataset.layer!, cost = Number(l.dataset.cost);
    if (st.unlocked.includes(key) || st.wallet < cost) return;
    st.wallet -= cost; st.unlocked.push(key); save();
    countTo(st.wallet);
    l.classList.add('flooding');
    paint(); // opens this layer (its blur clears under the ink) and updates what the rest can afford
    setTimeout(() => l.classList.remove('flooding'), reduced ? 0 : 1000);
  });

  // ---------- welcome grant (company pages) ----------
  const grant = (from: string) => {
    if (st.welcomed) return;
    st.welcomed = from; save();
    toast({ tag: 'Welcome gift', title: `${cfg.welcome} ink to spend`, desc: 'You came from a page I made for you. Open whatever grabs you: each card\'s source and where the idea went are behind the seals.', badge: '+' });
    earn(null, cfg.welcome, 'welcome gift');
  };
  const from = fromCompany('jt-notes');
  if (from) grant(from);

  // ---------- admin test controls ----------
  document.querySelector('[data-ink-reset]')?.addEventListener('click', () => { st = fresh(); save(); shown = 0; paint(); location.reload(); });
  document.querySelector('[data-ink-recruiter]')?.addEventListener('click', () => { st.welcomed = null; grant('/for/test/'); });

  paint();
}
