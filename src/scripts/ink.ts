/**
 * Ink: the site currency. Stored only in this browser (localStorage 'jt-ink').
 * Earn:  every claim (card) you reach in a post, +10, shown as a badge on the card; drops fly from it to the counter.
 *        Finishing a post, +25. A starter gift the first time you open a post or a book page, +20.
 *        Arriving from a company page, +100 once (with a gift card).
 * Spend: sealed layers ([data-layer]). On a card they open in order (note → source → branches);
 *        on book pages each Reference note is one layer. Unlocks are kept per item, site-wide.
 * Level: lifetime ink earned, Adler's four levels; spending never lowers it.
 */
import { fromCompany } from './from-company';

type Level = { name: string; at: number; desc: string };
type Cfg = { cardReached: number; postFinished: number; welcome: number; starter: number; levels: Level[] };
type State = { wallet: number; lifetime: number; earned: string[]; unlocked: string[]; welcomed: string | null; started: boolean; told: string[] };

const KEY = 'jt-ink';
const DROP = 'M12 2.5C12 2.5 5.2 10.4 5.2 15.2a6.8 6.8 0 0 0 13.6 0C18.8 10.4 12 2.5 12 2.5Z';
const fresh = (): State => ({ wallet: 0, lifetime: 0, earned: [], unlocked: [], welcomed: null, started: false, told: [] });

export function initInk() {
  const cfgEl = document.querySelector('[data-ink-config]');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent || '{}') as Cfg;
  const postId = document.querySelector<HTMLElement>('[data-post]')?.dataset.post || null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let st: State = fresh();
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

  const pill = document.querySelector<HTMLElement>('[data-hud-pill]')!;
  const hudDrop = document.querySelector<SVGElement>('[data-hud-drop]')!;
  const walletEl = document.querySelector<HTMLElement>('[data-wallet]')!;
  const levelEl = document.querySelector<HTMLElement>('[data-level]')!;
  const gainEl = document.querySelector<HTMLElement>('[data-gain]')!;
  const toasts = document.querySelector<HTMLElement>('[data-ink-toasts]')!;
  const layers = [...document.querySelectorAll<HTMLElement>('[data-layer]')];
  const levelOf = (n: number) => cfg.levels.reduce((i, l, k) => (n >= l.at ? k : i), 0);
  const isOpen = (k?: string) => !k || st.unlocked.includes(k) || !layers.some((l) => l.dataset.layer === k);

  // ---------- counter ----------
  let shown = st.wallet, tween = 0, bumps = 0;
  const paint = () => {
    walletEl.textContent = String(shown);
    levelEl.textContent = cfg.levels[levelOf(st.lifetime)].name;
    const here = document.querySelector('[data-earned-here]');
    if (here && postId) here.textContent = String(st.earned.filter((k) => k.startsWith(`${postId}:`)).reduce((n, k) => n + (k.endsWith(':end') ? cfg.postFinished : cfg.cardReached), 0));
    for (const l of layers) {
      const open = st.unlocked.includes(l.dataset.layer!);
      const ready = isOpen(l.dataset.after);
      const cost = Number(l.dataset.cost);
      l.classList.toggle('open', open);
      l.classList.toggle('locked', !open && !ready);
      const btn = l.querySelector<HTMLButtonElement>('[data-unseal]')!;
      btn.disabled = !open && (!ready || st.wallet < cost);
      l.querySelector('[data-seal-label]')!.textContent = !ready ? 'Open the layer above first' : st.wallet < cost ? `Need ${cost} · keep reading` : `Unseal · ${cost}`;
      for (const a of l.querySelectorAll<HTMLAnchorElement>('a')) a.tabIndex = open ? 0 : -1;
    }
    for (const c of document.querySelectorAll<HTMLElement>('[data-card]')) if (postId && st.earned.includes(`${postId}:${c.dataset.card}`)) c.classList.add('reached');
  };
  const pulse = (cls: 'bump' | 'drain') => { bumps++; pill.classList.remove('bumpA', 'bumpB', 'drainA', 'drainB'); void pill.offsetWidth; pill.classList.add(cls + (bumps % 2 ? 'A' : 'B')); };
  const countTo = (target: number, kind: 'bump' | 'drain' = 'bump') => {
    cancelAnimationFrame(tween);
    const from = shown, t0 = performance.now(), dur = reduced ? 0 : 600;
    const step = (t: number) => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      shown = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      walletEl.textContent = String(shown);
      if (k < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
    pulse(kind);
  };
  const showGain = (text: string) => { gainEl.textContent = text; gainEl.classList.remove('show'); void gainEl.offsetWidth; gainEl.classList.add('show'); };

  // ---------- drops flying to the counter ----------
  const fly = (from: DOMRect, n: number, done: () => void) => {
    const to = hudDrop.getBoundingClientRect();
    if (reduced || !to.width) { done(); return; }
    const tx = to.left + to.width / 2 - 7, ty = to.top + to.height / 2 - 7;
    let left = n;
    for (let i = 0; i < n; i++) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('class', 'ink-fly'); el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `<path d="${DROP}"></path>`;
      document.body.append(el);
      const sx = from.left + from.width * (0.25 + 0.5 * Math.random()) - 7, sy = from.top + from.height * 0.5 - 7;
      const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 80, my = Math.min(sy, ty) - 40 - Math.random() * 60;
      const a = el.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 10}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${mx}px, ${my}px) scale(.9)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${tx}px, ${ty}px) scale(.45)`, opacity: 0.9 },
      ], { duration: 720 + i * 30, delay: i * 70, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
      a.onfinish = () => { el.remove(); if (--left === 0) done(); };
    }
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
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); next(); }, 300); }, 4600);
  };
  const toast = (t: (typeof queue)[number]) => { queue.push(t); if (!busy) next(); };
  const tellOnce = (id: string, t: (typeof queue)[number]) => { if (st.told.includes(id)) return; st.told.push(id); save(); toast(t); };

  // ---------- earning ----------
  const credit = (n: number, why: string) => {
    const before = levelOf(st.lifetime);
    st.wallet += n; st.lifetime += n; save();
    showGain(`+${n} ${why}`);
    countTo(st.wallet); paint();
    const after = levelOf(st.lifetime);
    if (after > before) { const l = cfg.levels[after]; toast({ tag: `Level ${after + 1} of ${cfg.levels.length}`, title: `${l.name} reader`, desc: l.desc, badge: String(after + 1) }); }
  };
  const earnCard = (card: HTMLElement) => {
    const key = `${postId}:${card.dataset.card}`;
    if (st.earned.includes(key)) return;
    st.earned.push(key); save();
    card.classList.add('reached');
    const badge = card.querySelector<HTMLElement>('[data-earn]');
    badge?.classList.add('pop');
    fly((badge || card).getBoundingClientRect(), 5, () => {
      credit(cfg.cardReached, 'claim reached');
      tellOnce('earn', { tag: 'How ink works', title: `+${cfg.cardReached} for every claim you reach`, desc: 'Spend it on the seals under each claim: my note first, then where the idea came from, then where it went.', badge: '+' + cfg.cardReached });
    });
  };
  const earnEnd = (el: HTMLElement) => {
    const key = `${postId}:end`;
    if (st.earned.includes(key)) return;
    st.earned.push(key); save();
    fly(el.getBoundingClientRect(), 8, () => credit(cfg.postFinished, 'post finished'));
  };

  if (postId) {
    const timers = new Map<Element, number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        const key = el.dataset.card ? `${postId}:${el.dataset.card}` : `${postId}:end`;
        if (st.earned.includes(key)) { io.unobserve(el); continue; }
        if (e.isIntersecting && !timers.has(el)) {
          timers.set(el, window.setTimeout(() => { timers.delete(el); io.unobserve(el); el.dataset.card ? earnCard(el) : earnEnd(el); }, el.dataset.card ? 900 : 500));
        } else if (!e.isIntersecting && timers.has(el)) { clearTimeout(timers.get(el)); timers.delete(el); }
      }
    }, { threshold: 0.5 });
    for (const c of document.querySelectorAll<HTMLElement>('[data-card]')) io.observe(c);
    const end = document.querySelector<HTMLElement>('[data-post-end]');
    if (end) io.observe(end);
  }

  // ---------- spending ----------
  for (const l of layers) l.querySelector<HTMLButtonElement>('[data-unseal]')!.addEventListener('click', () => {
    const key = l.dataset.layer!, cost = Number(l.dataset.cost);
    if (st.unlocked.includes(key) || st.wallet < cost || !isOpen(l.dataset.after)) return;
    st.wallet -= cost; st.unlocked.push(key); save();
    showGain(`−${cost}`);
    countTo(st.wallet, 'drain');
    l.classList.add('flooding');
    paint();
    setTimeout(() => l.classList.remove('flooding'), reduced ? 0 : 1100);
  });

  // ---------- gifts ----------
  const gift = (n: number, tag: string, title: string, desc: string, then?: () => void) => {
    const wrap = document.createElement('div');
    wrap.className = 'ink-gift'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', title);
    const falls = Array.from({ length: 12 }, (_, i) => `<svg class="g-fall" viewBox="0 0 24 24" style="left:${48 + ((i * 37) % 40)}px;animation-delay:${300 + i * 110}ms"><path d="${DROP}"></path></svg>`).join('');
    wrap.innerHTML = `<div class="g-card"><div class="g-well" aria-hidden="true">${falls}<span class="g-ripple"></span><svg class="g-big" viewBox="0 0 24 24"><path d="${DROP}"></path><path class="g-nib" d="M12 10.6V16.4"></path><circle class="g-hole" cx="12" cy="9.4" r="1.15"></circle></svg></div><p class="g-tag"></p><p class="g-n">+0</p><p class="g-title"></p><p class="g-desc"></p><button type="button" class="g-go">Start reading</button></div>`;
    wrap.querySelector('.g-tag')!.textContent = tag;
    wrap.querySelector('.g-title')!.textContent = title;
    wrap.querySelector('.g-desc')!.textContent = desc;
    document.body.append(wrap);
    const nEl = wrap.querySelector('.g-n')!, go = wrap.querySelector<HTMLButtonElement>('.g-go')!;
    const t0 = performance.now(), dur = reduced ? 0 : 1500;
    const tick = (t: number) => { const k = dur ? Math.max(0, Math.min(1, (t - t0 - 350) / dur)) : 1; nEl.textContent = `+${Math.round(n * (1 - (1 - k) ** 3))}`; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    go.focus();
    const close = () => {
      if (wrap.classList.contains('out')) return;
      const r = nEl.getBoundingClientRect();
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 300);
      fly(r, 10, () => { credit(n, tag.toLowerCase()); then?.(); });
    };
    go.addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  };
  const welcome = (from: string) => {
    if (st.welcomed) return false;
    st.welcomed = from; st.started = true; save();
    gift(cfg.welcome, 'Welcome gift', `${cfg.welcome} ink, because you came from your page`, "Ink opens what I wrote under each claim: my note, the book it came from, and where the idea went. Spend it on whatever grabs you.");
    return true;
  };
  const from = fromCompany();
  if (!(from && welcome(from)) && !st.started) {
    st.started = true; save();
    setTimeout(() => gift(cfg.starter, 'Starter ink', `${cfg.starter} ink to begin`, `Reading earns more: +${cfg.cardReached} for every claim you reach. Spend it to go deeper than the claim.`), 600);
  }

  // ---------- admin test controls ----------
  document.querySelector('[data-ink-reset]')?.addEventListener('click', () => { st = fresh(); save(); try { sessionStorage.removeItem('jt-from'); } catch {} history.scrollRestoration = 'manual'; location.replace(location.pathname); });
  document.querySelector('[data-ink-recruiter]')?.addEventListener('click', () => { st.welcomed = null; welcome('/for/test/'); });

  paint();
}
