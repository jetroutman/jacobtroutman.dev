// Entry point ("main" in package.json). Static Web Apps only runs what this file registers,
// and a broken import takes the whole API down, so keep it small.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from './functions/track';
import { createOutbox } from './lib/outbox';
import { TableStore } from './lib/table-store';
import type { Company, TrackDeps } from './lib/track';

// Written during the build by scripts/write-api-companies.mjs: the live pages, by slug.
function loadCompanies(): Record<string, Company> {
  const file = join(__dirname, '..', '..', 'companies.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

let deps: TrackDeps | null = null;

register(() => {
  const storage = process.env.TRACKING_STORAGE;
  if (!storage) return null;
  return (deps ??= {
    companies: loadCompanies(),
    store: new TableStore(storage),
    outbox: createOutbox({ notionToken: process.env.TRACKING_NOTION_TOKEN, ntfyTopic: process.env.TRACKING_NTFY_TOPIC }),
  });
});
