import { app } from '@azure/functions';
import { parseUpdate, recordVisit, type TrackDeps } from '../lib/track';

const SITE = 'https://jacobtroutman.dev';
const MAX_BODY = 2048;
const BOT = /bot|crawl|spider|slurp|headless|phantom|lighthouse|preview|scanner|curl|wget|python|java\/|go-http/i;

type Request = { headers: { get(name: string): string | null }; text(): Promise<string> };
type Context = { error(...args: unknown[]): void };

/** Drops reports from other sites and from bots that say what they are. */
export function requestAllowed(req: Request) {
  const origin = req.headers.get('origin');
  return !(origin && origin !== SITE) && !BOT.test(req.headers.get('user-agent') ?? '');
}

/** Always answers 204: the page has nothing to do with the result, and probes learn nothing. */
export function trackHandler(deps: () => TrackDeps | null) {
  return async (req: Request, ctx: Context) => {
    const done = { status: 204, headers: { 'Cache-Control': 'no-store' } };
    try {
      if (!requestAllowed(req)) return done;
      const d = deps();
      if (!d) return done; // not configured here, e.g. a PR preview
      const body = await req.text();
      if (body.length > MAX_BODY) return done;
      const update = parseUpdate(JSON.parse(body));
      if (update) await recordVisit(update, { ...d, log: (m, e) => ctx.error(m, e) });
    } catch (e) {
      if (!(e instanceof SyntaxError)) ctx.error('[track]', e);
    }
    return done;
  };
}

export function register(deps: () => TrackDeps | null) {
  app.http('track', { methods: ['POST'], authLevel: 'anonymous', route: 'track', handler: trackHandler(deps) });
}
