// Entry point ("main" in package.json). Static Web Apps only runs what this file registers,
// and a broken import takes the whole API down, so keep it small.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { register as registerTrack } from './functions/track';
import { register as registerViews } from './functions/views';
import { createOutbox } from './lib/outbox';
import { TableStore } from './lib/table-store';
import type { TrackDeps } from './lib/track';
import { ViewTableStore } from './lib/view-table-store';
import type { ViewDeps } from './lib/views';

// Written during the build by scripts/write-api-data.mjs: the live company pages and the site's other pages.
function load(name: string) {
  const file = join(__dirname, '..', '..', name);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

let track: TrackDeps | null = null, views: ViewDeps | null = null;

registerTrack(() => {
  const storage = process.env.TRACKING_STORAGE;
  if (!storage) return null;
  return (track ??= {
    companies: load('companies.json'),
    store: new TableStore(storage),
    outbox: createOutbox({ notionToken: process.env.TRACKING_NOTION_TOKEN, ntfyTopic: process.env.TRACKING_NTFY_TOPIC }),
  });
});

registerViews(() => {
  const storage = process.env.TRACKING_STORAGE;
  if (!storage) return null;
  return (views ??= { pages: load('pages.json'), store: new ViewTableStore(storage) });
});
