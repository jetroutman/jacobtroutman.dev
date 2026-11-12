/**
 * Ink: the site currency. Stored only in this browser (localStorage 'jt-ink').
 *
 * Earn, by effort (amounts in src/lib/posts.ts INK):
 *   - reading: any [data-read] block you can see (a slide's prose, a free note, a note you opened) pays
 *     about one ink per dozen words once you've been on it long enough to read it; blocks inside a sealed
 *     layer only count once the layer is open
 *   - reaching a claim in a post ([data-claim]): a few ink, shown on the claim's badge
 *   - following a link to a parent, branch or related note ([data-trail]) the first time
 *   - the first visit to a post, thread or book page; finishing a post
 *   - a starter gift on the first visit anywhere (on a post, once the reader leaves the landing);
 *     a welcome gift when arriving from a company page
 *   - every Nth time you earn, a bonus of a random size (the meter under the counter shows how close)
 * Spend: sealed layers ([data-layer]). data-after names the layer that must be open first.
 *   Unlocks are per item and site-wide; each records when it happened (for "recently unlocked").
 * Level: lifetime ink earned (Adler's four levels). Spending never lowers it.
 */
import { fromCompany } from './from-company';

type Level = { name: string; at: number; desc: string };
type Cfg = {
  wordsPerInk: number; readMin: number; readMax: number; trail: number; visit: number; postFinished: number;
  welcome: number; starter: number; bonusEvery: number; bonusMin: number; bonusMax: number; levels: Level[];
};
export type InkState = {
  wallet: number; lifetime: number; earned: string[]; unlocked: string[]; at: Record<string, number>;
  welcomed: string | null; started: boolean; told: string[]; events: number; byPage: Record<string, number>;
};

export const INK_KEY = 'jt-ink';
const DROP = 'M12 2.5C12 2.5 5.2 10.4 5.2 15.2a6.8 6.8 0 0 0 13.6 0C18.8 10.4 12 2.5 12 2.5Z';
const fresh = (): InkState => ({ wallet: 0, lifetime: 0, earned: [], unlocked: [], at: {}, welcomed: null, started: false, told: [], events: 0, byPage: {} });
export const readInk = (): InkState => { try { return { ...fresh(), ...JSON.parse(localStorage.getItem(INK_KEY) || '{}') }; } catch { return fresh(); } };

export function initInk() {
  const cfgEl = document.querySelector('[data-ink-config]');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent || '{}') as Cfg;
  const postId = document.querySelector<HTMLElement>('[data-post]')?.dataset.post || null;
  const page = location.pathname;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let st = readInk();
  const save = () => { try { localStorage.setItem(INK_KEY, JSON.stringify(st)); } catch {} };

  const pill = document.querySelector<HTMLElement>('[data-hud-pill]')!;
  const hudDrop = document.querySelector<SVGElement>('[data-hud-drop]')!;
  const walletEl = document.querySelector<HTMLElement>('[data-wallet]')!;
  const levelEl = document.querySelector<HTMLElement>('[data-level]')!;
  const gainEl = document.querySelector<HTMLElement>('[data-gain]')!;
  const meter = document.querySelector<HTMLElement>('[data-bonus-meter]');
  const toasts = document.querySelector<HTMLElement>('[data-ink-toasts]')!;
  const layers = [...document.querySelectorAll<HTMLElement>('[data-layer]')];
  const levelOf = (n: number) => cfg.levels.reduce((i, l, k) => (n >= l.at ? k : i), 0);
  const alsoOf = (l: HTMLElement) => (l.dataset.also || '').split(' ').filter(Boolean);
  // Open if bought, or if everything it covers was bought elsewhere (e.g. all of a card's Reference notes).
  const opened = (l: HTMLElement) => st.unlocked.includes(l.dataset.layer!) || (alsoOf(l).length > 0 && alsoOf(l).every((k) => st.unlocked.includes(k)));
  const isOpen = (k?: string) => { if (!k) return true; const l = layers.find((x) => x.dataset.layer === k); return l ? opened(l) : true; };
  const readInkFor = (words: number) => Math.max(cfg.readMin, Math.min(cfg.readMax, Math.round(words / cfg.wordsPerInk)));

  // ---------- counter ----------
  let shown = st.wallet, tween = 0, bumps = 0;
  const paint = () => {
    walletEl.textContent = String(shown);
    levelEl.textContent = cfg.levels[levelOf(st.lifetime)].name;
    if (meter) meter.style.setProperty('--bonus', String((st.events % cfg.bonusEvery) / cfg.bonusEvery));
    const here = document.querySelector('[data-earned-here]');
    if (here) here.textContent = String(st.byPage[page] || 0);
    for (const l of layers) {
      const open = opened(l);
      const ready = isOpen(l.dataset.after);
      const cost = Number(l.dataset.cost);
      l.classList.toggle('open', open);
      l.classList.toggle('locked', !open && !ready);
      const btn = l.querySelector<HTMLButtonElement>('[data-unseal]')!;
      btn.disabled = !open && (!ready || st.wallet < cost);
      l.querySelector('[data-seal-label]')!.textContent = !ready ? 'Open the layer above first' : st.wallet < cost ? `Need ${cost} · keep reading` : `Unseal · ${cost}`;
      for (const a of l.querySelectorAll<HTMLAnchorElement>('a')) a.tabIndex = open ? 0 : -1;
    }
    for (const c of document.querySelectorAll<HTMLElement>('[data-claim]')) if (st.earned.includes(`claim:${c.dataset.claim}`)) c.closest('[data-card]')?.classList.add('reached');
    document.dispatchEvent(new CustomEvent('ink:change', { detail: st }));
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
    if (reduced || !to.width || !from.width) { done(); return; }
    const tx = to.left + to.width / 2 - 7, ty = to.top + to.height / 2 - 7;
    let left = n;
    for (let i = 0; i < n; i++) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('class', 'ink-fly'); el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `<path d="${DROP}"></path>`;
      document.body.append(el);
      const sx = from.left + from.width * (0.2 + 0.6 * Math.random()) - 7, sy = from.top + Math.min(from.height, 60) * 0.5 - 7;
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
  type Toast = { tag: string; title: string; desc: string; badge: string; bonus?: boolean };
  const queue: Toast[] = [];
  let busy = false;
  const next = () => {
    const t = queue.shift(); if (!t) { busy = false; return; }
    busy = true;
    const el = document.createElement('div');
    el.className = t.bonus ? 'it bonus' : 'it'; el.setAttribute('role', 'status');
    el.innerHTML = '<span class="it-badge"></span><span><span class="it-tag"></span><span class="it-title"></span><span class="it-desc"></span></span>';
    el.querySelector('.it-badge')!.textContent = t.badge;
    el.querySelector('.it-tag')!.textContent = t.tag;
    el.querySelector('.it-title')!.textContent = t.title;
    el.querySelector('.it-desc')!.textContent = t.desc;
    toasts.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); next(); }, 300); }, 4200);
  };
  const toast = (t: Toast) => { queue.push(t); if (!busy) next(); };
  const tellOnce = (id: string, t: Toast) => { if (st.told.includes(id)) return; st.told.push(id); save(); toast(t); };

  // ---------- earning ----------
  const credit = (n: number, why: string, countsTowardBonus = true) => {
    const before = levelOf(st.lifetime);
    st.wallet += n; st.lifetime += n; st.byPage[page] = (st.byPage[page] || 0) + n;
    if (countsTowardBonus) st.events++;
    save();
    showGain(`+${n} ${why}`);
    countTo(st.wallet); paint();
    const after = levelOf(st.lifetime);
    if (after > before) { const l = cfg.levels[after]; toast({ tag: `Level ${after + 1} of ${cfg.levels.length}`, title: `${l.name} reader`, desc: l.desc, badge: String(after + 1) }); }
    if (countsTowardBonus && st.events % cfg.bonusEvery === 0) {
      const b = cfg.bonusMin + Math.floor(Math.random() * (cfg.bonusMax - cfg.bonusMin + 1));
      setTimeout(() => {
        toast({ tag: 'Bonus ink', title: `+${b}`, desc: `Every ${cfg.bonusEvery} times you earn, a bonus. How much is a surprise.`, badge: '★', bonus: true });
        fly(toasts.getBoundingClientRect(), 8, () => credit(b, 'bonus', false));
      }, 700);
    }
  };
  // Earn once per key; drops fly from `from` to the counter first.
  const earn = (key: string, n: number, why: string, from?: Element | null) => {
    if (st.earned.includes(key) || n <= 0) return false;
    st.earned.push(key); save();
    const r = from?.getBoundingClientRect();
    fly(r || hudDrop.getBoundingClientRect(), Math.max(2, Math.min(8, Math.round(n / 2))), () => credit(n, why));
    return true;
  };

  // Reading: a block counts once it has been on screen long enough to read (about 4 words a second, 1.5–8s).
  const readable = [...document.querySelectorAll<HTMLElement>('[data-read]')];
  const blocked = (el: HTMLElement) => { const l = el.closest<HTMLElement>('[data-layer]'); return !!l && !opened(l); };
  const timers = new Map<Element, number>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      const key = `read:${el.dataset.read}`;
      if (st.earned.includes(key)) { io.unobserve(el); continue; }
      const seen = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= innerHeight * 0.45);
      if (seen && !timers.has(el) && !blocked(el)) {
        const words = Number(el.dataset.words || 0);
        timers.set(el, window.setTimeout(() => {
          timers.delete(el);
          if (blocked(el)) return;
          io.unobserve(el);
          if (earn(key, readInkFor(words), 'read', el)) tellOnce('earn', { tag: 'How ink works', title: 'Reading earns ink', desc: 'The more you read, the more you get. Spend it to open the notes under each claim.', badge: '+' });
        }, Math.max(1500, Math.min(8000, words * 250))));
      } else if (!seen && timers.has(el)) { clearTimeout(timers.get(el)); timers.delete(el); }
    }
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  for (const el of readable) io.observe(el);

  // Claims: reaching one pays its badge's amount.
  const claimTimers = new Map<Element, number>();
  const cio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      const key = `claim:${el.dataset.claim}`;
      if (st.earned.includes(key)) { cio.unobserve(el); continue; }
      if (e.isIntersecting && !claimTimers.has(el)) {
        claimTimers.set(el, window.setTimeout(() => {
          claimTimers.delete(el); cio.unobserve(el);
          el.closest('[data-card]')?.classList.add('reached'); el.classList.add('pop');
          earn(key, Number(el.dataset.ink || 3), 'claim', el);
        }, 900));
      } else if (!e.isIntersecting && claimTimers.has(el)) { clearTimeout(claimTimers.get(el)); claimTimers.delete(el); }
    }
  }, { threshold: 1 });
  for (const c of document.querySelectorAll<HTMLElement>('[data-claim]')) cio.observe(c);

  // Following a trail link: credit now (the page may be about to change).
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-trail]')) a.addEventListener('click', () => {
    const key = `trail:${a.dataset.trail}`;
    if (st.earned.includes(key)) return;
    st.earned.push(key); credit(cfg.trail, 'followed a link');
  });

  // The end of a post.
  const end = document.querySelector<HTMLElement>('[data-post-end]');
  if (end && postId) {
    const eio = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { eio.disconnect(); setTimeout(() => earn(`${postId}:end`, cfg.postFinished, 'post finished', end), 500); } }, { threshold: 0.5 });
    eio.observe(end);
  }

  // ---------- spending ----------
  for (const l of layers) l.querySelector<HTMLButtonElement>('[data-unseal]')!.addEventListener('click', () => {
    const key = l.dataset.layer!, cost = Number(l.dataset.cost);
    if (opened(l) || st.wallet < cost || !isOpen(l.dataset.after)) return;
    const now = Date.now();
    st.wallet -= cost;
    for (const k of [key, ...alsoOf(l)]) if (!st.unlocked.includes(k)) { st.unlocked.push(k); st.at[k] = now; }
    save();
    showGain(`−${cost}`);
    countTo(st.wallet, 'drain');
    l.classList.add('flooding');
    paint();
    setTimeout(() => l.classList.remove('flooding'), reduced ? 0 : 1100);
    // what's inside now counts as reading
    for (const r of l.querySelectorAll<HTMLElement>('[data-read]')) { io.unobserve(r); io.observe(r); }
  });

  // ---------- gifts ----------
  const gift = (n: number, tag: string, title: string, desc: string, cta = 'Start reading') => {
    const wrap = document.createElement('div');
    wrap.className = 'ink-gift'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', title);
    const falls = Array.from({ length: 12 }, (_, i) => `<svg class="g-fall" viewBox="0 0 24 24" style="left:${48 + ((i * 37) % 40)}px;animation-delay:${300 + i * 110}ms"><path d="${DROP}"></path></svg>`).join('');
    wrap.innerHTML = `<div class="g-card"><div class="g-well" aria-hidden="true">${falls}<span class="g-ripple"></span><svg class="g-big" viewBox="0 0 24 24"><path d="${DROP}"></path><path class="g-nib" d="M12 10.6V16.4"></path><circle class="g-hole" cx="12" cy="9.4" r="1.15"></circle></svg></div><p class="g-tag"></p><p class="g-n">+0</p><p class="g-title"></p><p class="g-desc"></p><button type="button" class="g-go"></button></div>`;
    wrap.querySelector('.g-tag')!.textContent = tag;
    wrap.querySelector('.g-title')!.textContent = title;
    wrap.querySelector('.g-desc')!.textContent = desc;
    wrap.querySelector('.g-go')!.textContent = cta;
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
      fly(r, 10, () => credit(n, tag.toLowerCase(), false));
    };
    go.addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  };
  const welcome = (from: string) => {
    if (st.welcomed) return false;
    st.welcomed = from; st.started = true; save();
    gift(cfg.welcome, 'Welcome gift', `${cfg.welcome} ink, because you came from your page`, 'Ink opens what I wrote under each claim: my note and the book it came from. Spend it on whatever grabs you; reading earns more.');
    return true;
  };
  const from = fromCompany();
  if (!(from && welcome(from)) && !st.started) {
    const starter = (cta: string) => {
      if (st.started || readInk().started) return; // another tab may have handed it out already
      st.started = true; save();
      gift(cfg.starter, 'Starter ink', `${cfg.starter} ink to begin`, 'Reading earns more: the more you read, the more you get. Spend it to go deeper than the claim.', cta);
    };
    // On a post's landing, the title and contents make their pitch first: the starter ink arrives
    // as a surprise once the reader moves on to the first section (Slip Box 12G).
    const onLanding = !!document.querySelector('[data-track]') && (!location.hash || location.hash === '#intro');
    if (onLanding) {
      const wait = (e: Event) => {
        if ((e as CustomEvent<number>).detail < 1) return;
        document.removeEventListener('deck:slide', wait);
        setTimeout(() => starter('Keep reading'), reduced ? 0 : 500);
      };
      document.addEventListener('deck:slide', wait);
    } else setTimeout(() => starter('Start reading'), 600);
  } else if (!document.querySelector('[data-admin]') && !st.earned.includes(`visit:${page}`)) {
    setTimeout(() => earn(`visit:${page}`, cfg.visit, 'first visit', document.querySelector('h1')), 1200);
  }

  // ---------- admin test controls ----------
  document.querySelector('[data-ink-reset]')?.addEventListener('click', () => { st = fresh(); save(); try { sessionStorage.removeItem('jt-from'); } catch {} history.scrollRestoration = 'manual'; location.replace(location.pathname); });
  document.querySelector('[data-ink-recruiter]')?.addEventListener('click', () => { st.welcomed = null; welcome('/for/test/'); });

  paint();
}
