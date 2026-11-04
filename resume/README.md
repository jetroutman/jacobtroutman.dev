# Résumé source

`resume.html` is the source for `public/resume.pdf`. Edit the HTML, then rebuild:

```sh
node resume/build-pdf.cjs "$PWD/resume/resume.html" public/resume.pdf
```

Requires Playwright (`npm i -D playwright && npx playwright install chromium`).
