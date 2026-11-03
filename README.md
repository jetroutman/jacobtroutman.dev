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

## Deploy (one time)

1. Azure portal → Create **Static Web App**, plan **Free**, source **Other**.
2. Copy its deployment token into the repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. Push to `main`. `.github/workflows/azure-static-web-apps.yml` builds and deploys.
4. Static Web App → **Custom domains** → add `jacobtroutman.dev` and follow the DNS records it gives you.
