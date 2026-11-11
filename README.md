# jacobtroutman.dev

Personal site, built with Astro and hosted on Azure Static Web Apps. Built from the "Decision log" design handoff.

## Run it

```sh
npm install
npm run dev      # http://localhost:4321 — shows "Before launch" TODO boxes
npm run build    # production build into dist/
```

## Where things live

| What | Where |
|---|---|
| Case files (Home rows + case pages) | Notion: Life HQ → jacobtroutman.dev → **Decision Log** → `src/data/cases.json` |
| Company pages (unlisted) | Notion: Life HQ → jacobtroutman.dev → **Company Pages** → `src/data/companies.json` → `/for/<slug>/` |
| Email, links, "Updated" date | `src/site.ts` |
| Design tokens | `src/styles/global.css` |

- Edit case files and company pages in Notion; the formats are on the jacobtroutman.dev page there. `scripts/sync-site-pages.mjs` pulls them before every CI build (and daily). Without `NOTION_TOKEN` the committed JSON is used, so `npm run dev` works offline.
- A case file with **Case page** unticked shows on Home but has no page yet. Its `## Before launch` bullets show only in `npm run dev`.
- Company pages with Status **Draft** build in dev and PR previews only; **Archived** ones aren't built. Give real ones an unguessable slug. They're `noindex`, left out of the sitemap, and blocked in `robots.txt`.
- The résumé PDF is `public/resume.pdf`, built from `resume/resume.html` (see `resume/README.md`).

## Deploy

1. Azure Static Web App `PersonalSite` (Free) is linked to this repo.
2. Azure added the secret `AZURE_STATIC_WEB_APPS_API_TOKEN_WHITE_SKY_0DFC3C010` itself.
3. Push to `main`: Actions builds with Node 22 (`.nvmrc`) and uploads `dist/`. Azure does not build.
4. Static Web App → **Custom domains** → `jacobtroutman.dev` (done).
