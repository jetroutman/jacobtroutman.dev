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
| Case files (Home rows + case pages) | `src/content/cases/*.mdx` |
| Company pages (unlisted) | `src/content/companies/*.md` → `/for/<slug>/` |
| Email, links, "Updated" date | `src/site.ts` |
| Design tokens | `src/styles/global.css` |

- A case file with `published: false` shows on Home but has no page yet.
- `todo:` lists claims to confirm. They show only in `npm run dev`.
- Company pages with `draft: true` build in dev only. Give real ones an unguessable slug. They're `noindex`, left out of the sitemap, and blocked in `robots.txt`.
- Put the résumé at `public/resume.pdf`.

## Deploy

1. Azure Static Web App `PersonalSite` (Free) is linked to this repo.
2. Azure added the secret `AZURE_STATIC_WEB_APPS_API_TOKEN_WHITE_SKY_0DFC3C010` itself.
3. Push to `main`: Actions builds with Node 22 (`.nvmrc`) and uploads `dist/`. Azure does not build.
4. Static Web App → **Custom domains** → `jacobtroutman.dev` (done).
