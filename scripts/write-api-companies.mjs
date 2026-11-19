// Build step: gives the tracking API the live company pages, so it only accepts reports for real ones.
// Runs in CI after sync-site-pages.mjs. The file is deployed with the API, never with the public site.
import { readFile, writeFile } from 'node:fs/promises';

const { companies } = JSON.parse(await readFile('src/data/companies.json', 'utf8'));
const live = Object.fromEntries(companies.filter((c) => !c.draft).map((c) => [c.slug, { company: c.company, notion: c.notion ?? '' }]));
await writeFile('api/companies.json', JSON.stringify(live));
console.log(`[api] ${Object.keys(live).length} company pages`);
