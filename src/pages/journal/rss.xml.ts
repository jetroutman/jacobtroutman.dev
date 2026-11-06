// RSS for the Journal: the 50 newest entries, linking to their full pages.
import type { APIRoute } from 'astro';
import { entries, KIND_LABEL } from '../../lib/journal';
import { site } from '../../site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = ({ site: base }) => {
  const origin = (base?.toString() || 'https://jacobtroutman.dev/').replace(/\/$/, '');
  const items = entries.slice(0, 50).map((e) => {
    const url = `${origin}${e.href}`;
    const body = e.excerpt.length ? e.excerpt.join('\n\n') : (e.items || []).map((i) => `${i.type}: ${i.title}`).join('\n');
    return `<item><title>${esc(`${KIND_LABEL[e.kind]}: ${e.fid ? `${e.fid} ` : ''}${e.title}`)}</title><link>${esc(url)}</link><guid isPermaLink="false">${esc(e.id)}</guid><pubDate>${new Date(`${e.date}T12:00:00Z`).toUTCString()}</pubDate><category>${KIND_LABEL[e.kind]}</category><description>${esc(body)}</description></item>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(`${site.name} · Journal`)}</title>
<link>${origin}/journal/</link>
<description>Book reviews, reading notes and the ideas they grow into.</description>
<language>en-us</language>
${items}
</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
