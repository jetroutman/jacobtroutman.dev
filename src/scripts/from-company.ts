// A reader who came from a company page (/for/<slug>/) keeps a way back while browsing the site.
// The link carries ?from=/for/<slug>/#<slide>; it's remembered for this tab so library sub-pages can use it too.
const OK = /^\/for\/[a-z0-9-]+\/(#[a-z0-9-]+)?$/;

export function fromCompany(visitKey?: string): string | null {
  let from = new URLSearchParams(location.search).get('from');
  try {
    if (from && OK.test(from)) sessionStorage.setItem('jt-from', from);
    else from = sessionStorage.getItem('jt-from');
  } catch { from = from && OK.test(from) ? from : null; }
  if (!from || !OK.test(from)) return null;
  if (visitKey) try { localStorage.setItem(`${visitKey}-${from.split('/')[2]}`, '1'); } catch {}
  const backs = [...document.querySelectorAll<HTMLAnchorElement>('[data-back]')];
  // Pages without their own back link (home, journal) get the one in the site header.
  if (!backs.length) backs.push(...document.querySelectorAll<HTMLAnchorElement>('[data-back-global]'));
  for (const a of backs) { a.href = from; a.textContent = '← Back to your page'; a.hidden = false; }
  return from;
}

/**
 * On a company page: remember it for this tab, so every page the reader opens from here can lead back,
 * however they got there (a header link, the browser's address bar, a page several clicks away).
 * Outbound links also carry ?from= up front, so "open in new tab", which gets a fresh tab, keeps it too.
 */
export function rememberCompanyPage() {
  const slideOf = (el: Element | null) => el?.closest<HTMLElement>('[data-slide]')?.id;
  const here = (slide?: string | null) => location.pathname + (slide ? `#${slide}` : '');
  const current = () => location.hash.slice(1) || null; // the deck keeps the current slide in the hash
  const save = (from: string) => { try { sessionStorage.setItem('jt-from', from); } catch {} };
  save(here(current()));

  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')]
    .filter((a) => !/^\/(for|api|admin)\/|\.[a-z0-9]+$/i.test(a.pathname)); // not company pages, the API or files
  const point = (a: HTMLAnchorElement, from: string) => { a.href = `${a.pathname}?from=${encodeURIComponent(from)}${a.hash}`; };
  for (const a of links) {
    point(a, here(slideOf(a)));
    a.addEventListener('click', () => { const from = here(slideOf(a) ?? current()); point(a, from); save(from); });
  }
  addEventListener('pagehide', () => save(here(current())));
}
