// Pulls the Decision Log (case files) and Company Pages from Notion into src/data/cases.json and
// src/data/companies.json. Formats are in scripts/site-content.mjs and on the "jacobtroutman.dev"
// page in Notion. Only fields the site renders are written (never Posting, Cover letter or comments).
// Without NOTION_TOKEN, or if a database can't be read, its committed file stays. A page that
// doesn't parse keeps its committed version if there is one, so a half-edited page can't take a
// live one down.
import { readFile, writeFile } from 'node:fs/promises';
import { TOKEN, queryAll, blockTree } from './notion.mjs';
import { parseCase, parseCompany } from './site-content.mjs';

const SOURCES = [
  { tag: 'cases', db: process.env.NOTION_CASES_DB || '6a6c7b3df8a941f293d6a31f5c460c9b', parse: parseCase,
    sort: (a, b) => a.order - b.order, describe: (e) => `${e.id} ${e.published ? 'case page' : 'Home only'}, ${e.body.length} sections${e.quiz ? ', quiz' : ''}` },
  { tag: 'companies', db: process.env.NOTION_COMPANIES_DB || 'ade72a4d728444f19fc5197d900af202', parse: parseCompany,
    sort: (a, b) => a.slug.localeCompare(b.slug), describe: (e) => `${e.draft ? 'Draft' : 'Live '} /for/${e.slug}/ (${e.evidence.length} exhibits)` },
];

if (!TOKEN) { console.log('[cases] [companies] NOTION_TOKEN not set; keeping the committed files.'); process.exit(0); }

for (const { tag, db, parse, sort, describe } of SOURCES) {
  const out = new URL(`../src/data/${tag}.json`, import.meta.url);
  try {
    const committed = JSON.parse(await readFile(out, 'utf8'))[tag] ?? [];
    const entries = [], seen = new Set();
    for (const page of await queryAll(db)) {
      if (page.archived || page.in_trash) continue;
      const warn = (m) => console.warn(`[${tag}] ${page.url}: ${m}`);
      let { entry, error } = parse(page, await blockTree(page.id), warn);
      if (entry === null) continue; // Archived company page
      if (error) {
        const old = committed.find((c) => c.notion === page.id);
        warn(`${error}. ${old ? 'Keeping the committed version.' : 'Skipping it.'}`);
        if (!old) continue;
        entry = old;
      }
      if (seen.has(entry.slug)) { warn(`slug "${entry.slug}" is already used; skipping this page`); continue; }
      seen.add(entry.slug);
      entries.push({ notion: page.id, ...entry });
      console.log(`[${tag}] ${describe(entry)}`);
    }
    entries.sort(sort);
    await writeFile(out, JSON.stringify({ source: 'notion', syncedAt: new Date().toISOString(), [tag]: entries }, null, 1) + '\n');
    console.log(`[${tag}] Synced ${entries.length}.`);
  } catch (e) {
    console.warn(`[${tag}] Notion sync failed; keeping the committed file. ${e.message}`);
    if (/404|object_not_found/.test(e.message)) console.warn(`[${tag}] Share the "jacobtroutman.dev" page in Notion with the integration (••• → Connections).`);
  }
}
