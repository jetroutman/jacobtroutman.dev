import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://jacobtroutman.dev',
  integrations: [
    mdx(),
    // Company pages are unlisted: keep them out of the sitemap.
    sitemap({ filter: (page) => !page.includes('/for/') }),
  ],
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
