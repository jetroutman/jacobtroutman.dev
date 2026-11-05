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
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-back]')) { a.href = from; a.textContent = '← Back to your page'; a.hidden = false; }
  return from;
}
