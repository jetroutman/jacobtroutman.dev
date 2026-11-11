import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const pdo = z.object({ problem: z.string(), decision: z.string(), outcome: z.string() });

// Both collections come from Notion (Life HQ → jacobtroutman.dev): scripts/sync-site-pages.mjs writes
// src/data/cases.json and companies.json before each build. The committed files are the fallback.
const synced = (name: string) => file(`src/data/${name}.json`, {
  parser: (text) => Object.fromEntries(JSON.parse(text)[name].map((e: { slug: string }) => [e.slug, e])),
});

// Case-file body: one entry per `##` section in Notion. `html` fields are escaped inline HTML from the sync.
const block = z.discriminatedUnion('k', [
  z.object({ k: z.literal('p'), html: z.string() }),
  z.object({ k: z.literal('q'), html: z.string() }),
  z.object({ k: z.literal('h3'), text: z.string() }),
  z.object({ k: z.enum(['ol', 'ul']), items: z.array(z.string()) }),
  z.object({ k: z.literal('parts'), rows: z.array(z.tuple([z.string(), z.string()])) }),
  z.object({ k: z.literal('points'), rows: z.array(z.tuple([z.string(), z.string()])) }),
  z.object({ k: z.literal('options'), items: z.array(z.object({ label: z.string(), verdict: z.string(), chosen: z.boolean(), title: z.string(), body: z.string() })) }),
  z.object({ k: z.literal('callout'), label: z.string(), title: z.string(), body: z.array(z.string()) }),
]);
const section = z.object({ id: z.string(), n: z.string(), title: z.string(), lede: z.string().optional(), blocks: z.array(block) });

const cases = defineCollection({
  loader: synced('cases'),
  schema: z.object({
    id: z.string(),                       // "DR-02"
    title: z.string(),                    // the Home proof line, verbatim
    status: z.enum(['Adopted', 'Piloted', 'Shipped', 'Live', 'In progress']),
    stack: z.array(z.string()),
    readMinutes: z.number(),
    role: z.string(),
    tldr: pdo,
    order: z.number(),
    app: z.string().optional(),           // link for "Try the app"
    published: z.boolean().default(true), // false = listed on Home, no case page yet
    teaser: z.string().optional(),        // one playful, true line shown on company-page evidence slides
    /** "What would you have done?" prompt on company pages. Options must be ones Jacob actually weighed. */
    quiz: z.object({
      question: z.string(),
      options: z.array(z.object({ label: z.string(), reply: z.string(), chosen: z.boolean().default(false) })).min(2),
    }).optional(),
    /** Claims to confirm before launch. Shown only in `npm run dev`. */
    todo: z.array(z.string()).default([]),
    body: z.array(section).default([]),
  }),
});

const companies = defineCollection({
  loader: synced('companies'),
  schema: z.object({
    company: z.string(),
    role: z.string(),
    date: z.string(),
    summary: z.string(),
    /** Optional opening line, e.g. "Hey SeatGeek." Replaces the default heading and hides the role line. */
    greeting: z.string().optional(),
    requirements: z.array(z.object({ need: z.string(), cases: z.array(z.string()) })),
    evidence: z.array(z.object({ case: z.string(), relevance: z.string() })),
    plan: z.array(z.object({ days: z.string(), title: z.string(), items: z.array(z.string()) })),
    questions: z.array(z.string()),
    draft: z.boolean().default(false),    // drafts are not built in production
    /** Optional phone shown only on this page, e.g. "708-555-0100". */
    phone: z.string().optional(),
    /** Final slide; unlocks once the reader has seen every other slide. Must be true, specific to this company, and worth finding. */
    bonus: z.object({ label: z.string(), title: z.string(), body: z.string() }).optional(),
  }),
});

export const collections = { cases, companies };
