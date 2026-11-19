import { app } from '@azure/functions';
import { requestAllowed } from './track';
import { parseView, recordView, viewStats, type ViewDeps } from '../lib/views';

const MAX_BODY = 512;

type Request = { headers: { get(name: string): string | null }; text(): Promise<string> };
type Context = { error(...args: unknown[]): void };

/** Like /api/track: always 204, so the page has nothing to wait on and probes learn nothing. */
export function viewHandler(deps: () => ViewDeps | null) {
  return async (req: Request, ctx: Context) => {
    const done = { status: 204, headers: { 'Cache-Control': 'no-store' } };
    try {
      const d = deps();
      if (!d || !requestAllowed(req)) return done;
      const body = await req.text();
      if (body.length > MAX_BODY) return done;
      const path = parseView(JSON.parse(body), d.pages);
      if (path) await recordView(path, d);
    } catch (e) {
      if (!(e instanceof SyntaxError)) ctx.error('[views]', e);
    }
    return done;
  };
}

// staticwebapp.config.json already limits this route to the admin role; this checks again in case that rule moves.
export function isAdmin(req: Request) {
  try {
    const p = JSON.parse(Buffer.from(req.headers.get('x-ms-client-principal') ?? '', 'base64').toString('utf8'));
    return Array.isArray(p?.userRoles) && p.userRoles.includes('admin');
  } catch { return false; }
}

export function statsHandler(deps: () => ViewDeps | null) {
  return async (req: Request, ctx: Context) => {
    if (!isAdmin(req)) return { status: 403 };
    const d = deps();
    if (!d) return { status: 503, jsonBody: { error: 'TRACKING_STORAGE is not set' } };
    try {
      return { status: 200, headers: { 'Cache-Control': 'no-store' }, jsonBody: await viewStats(d) };
    } catch (e) {
      ctx.error('[view-stats]', e);
      return { status: 500 };
    }
  };
}

export function register(deps: () => ViewDeps | null) {
  app.http('view', { methods: ['POST'], authLevel: 'anonymous', route: 'view', handler: viewHandler(deps) });
  app.http('viewStats', { methods: ['GET'], authLevel: 'anonymous', route: 'view-stats', handler: statsHandler(deps) });
}
