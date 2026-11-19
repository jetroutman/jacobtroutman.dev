// Build step, after `npm run build`: tells the API which pages are real, so it ignores reports for anything else.
//   api/companies.json  live company pages, by slug (for /api/track)
//   api/pages.json      every other public page, by path, with its title (for /api/view)
// Both are deployed with the API, never with the public site, and stay out of git.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const { companies } = JSON.parse(await readFile('src/data/companies.json', 'utf8'));
const live = Object.fromEntries(companies.filter((c) => !c.draft).map((c) => [c.slug, { company: c.company, notion: c.notion ?? '' }]));
await writeFile('api/companies.json', JSON.stringify(live));
console.log(`[api] ${Object.keys(live).length} company pages`);

const SKIP = /^\/(for|admin|drafts|signin-again)(\/|$)/;
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" };
const pages = {};
for (const file of await readdir('dist', { recursive: true })) {
  if (!file.endsWith('index.html')) continue;
  const path = `/${file.slice(0, -'index.html'.length).replaceAll('\\', '/')}`;
  if (SKIP.test(path)) continue;
  const html = await readFile(join('dist', file), 'utf8');
  const title = (/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '').replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, e) => entities[e]);
  pages[path] = { title: path === '/' ? 'Home' : title.replace(/( · Jacob Troutman)+$/, '') };
}
await writeFile('api/pages.json', JSON.stringify(pages));
console.log(`[api] ${Object.keys(pages).length} other pages`);
