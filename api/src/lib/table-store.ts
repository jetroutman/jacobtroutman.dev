// Azure Table Storage: one partition per company, with a row per visit, a row per visitor and one summary.
import { odata, TableClient } from '@azure/data-tables';
import type { CompanyRows, Store, VisitRow } from './track';

const VISIT = 'v_', VISITOR = 'u_', SUMMARY = 'summary';
const FIELDS = ['visitor', 'startedAt', 'lastAt', 'slide', 'reached', 'seen', 'total', 'activeMs', 'device'] as const;

export class TableStore implements Store {
  private client: TableClient;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string, table = 'CompanyVisits') {
    this.client = TableClient.fromConnectionString(connectionString, table, {
      allowInsecureConnection: connectionString.includes('DefaultEndpointsProtocol=http;'), // the local emulator
    });
  }

  private table() {
    this.ready ??= this.client.createTable().catch((e) => { this.ready = null; throw e; });
    return this.ready;
  }

  async read(slug: string): Promise<CompanyRows> {
    await this.table();
    const rows: CompanyRows = { visits: new Map(), visitors: new Set(), summary: null };
    for await (const e of this.client.listEntities<Record<string, unknown>>({ queryOptions: { filter: odata`PartitionKey eq ${slug}` } })) {
      const key = e.rowKey as string;
      if (key === SUMMARY) rows.summary = e.value as string;
      else if (key.startsWith(VISITOR)) rows.visitors.add(key.slice(VISITOR.length));
      else if (key.startsWith(VISIT)) rows.visits.set(key.slice(VISIT.length), Object.fromEntries(FIELDS.map((f) => [f, e[f]])) as VisitRow);
    }
    return rows;
  }

  async saveVisit(slug: string, visit: string, row: VisitRow) {
    await this.client.upsertEntity({ partitionKey: slug, rowKey: VISIT + visit, ...row }, 'Replace');
  }

  async addVisitor(slug: string, visitor: string, at: string) {
    try {
      await this.client.createEntity({ partitionKey: slug, rowKey: VISITOR + visitor, firstAt: at });
      return true;
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 409) return false;
      throw e;
    }
  }

  async saveSummary(slug: string, summary: string) {
    await this.client.upsertEntity({ partitionKey: slug, rowKey: SUMMARY, value: summary }, 'Replace');
  }
}
