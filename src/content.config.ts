import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const pdo = z.object({ problem: z.string(), decision: z.string(), outcome: z.string() });

const cases = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/cases' }),
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
  }),
});

const companies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/companies' }),
  schema: z.object({
    company: z.string(),
    role: z.string(),
    date: z.string(),
    summary: z.string(),
    requirements: z.array(z.object({ need: z.string(), cases: z.array(z.string()) })),
    evidence: z.array(z.object({ case: z.string(), relevance: z.string() })),
    plan: z.array(z.object({ days: z.string(), title: z.string(), items: z.array(z.string()) })),
    questions: z.array(z.string()),
    draft: z.boolean().default(false),    // drafts are not built in production
    /** Final slide; unlocks once the reader has seen every other slide. Must be true, specific to this company, and worth finding. */
    bonus: z.object({ label: z.string(), title: z.string(), body: z.string() }).optional(),
  }),
});

export const collections = { cases, companies };
