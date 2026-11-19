// Page views in Azure Table Storage: partition = month (YYYY-MM), row = the page's path.
import { TableClient } from '@azure/data-tables';
import type { CountRow, ViewStore } from './views';

const TRIES = 5;
const status = (e: unknown) => (e as { statusCode?: number }).statusCode;

export class ViewTableStore implements ViewStore {
  private client: TableClient;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string, table = 'PageViews') {
    this.client = TableClient.fromConnectionString(connectionString, table, {
      allowInsecureConnection: connectionString.includes('DefaultEndpointsProtocol=http;'), // the local emulator
    });
  }

  private table() {
    this.ready ??= this.client.createTable().catch((e) => { this.ready = null; throw e; });
    return this.ready;
  }

  // Read, add one, write back only if nobody else wrote in between; otherwise try again.
  async increment(month: string, path: string, at: string) {
    await this.table();
    const rowKey = encodeURIComponent(path); // row keys can't hold "/"
    for (let i = 0; i < TRIES; i++) {
      try {
        const e = await this.client.getEntity<{ views: number }>(month, rowKey);
        await this.client.updateEntity({ partitionKey: month, rowKey, views: e.views + 1, lastAt: at }, 'Replace', { etag: e.etag });
        return;
      } catch (e) {
        if (status(e) === 404) {
          try { await this.client.createEntity({ partitionKey: month, rowKey, views: 1, lastAt: at }); return; }
          catch (c) { if (status(c) !== 409) throw c; }
        } else if (status(e) !== 412) throw e;
      }
    }
    throw new Error(`[views] gave up counting ${path} after ${TRIES} conflicts`);
  }

  async all(): Promise<CountRow[]> {
    await this.table();
    const rows: CountRow[] = [];
    for await (const e of this.client.listEntities<{ views: number; lastAt: string }>())
      rows.push({ month: e.partitionKey!, path: decodeURIComponent(e.rowKey!), views: e.views, lastAt: e.lastAt });
    return rows;
  }
}
