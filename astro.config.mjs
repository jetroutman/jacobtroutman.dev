import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://jacobtroutman.dev',
  integrations: [
    // Company pages are unlisted, and admin/drafts/sign-in pages are private: keep them out of the sitemap.
    sitemap({ filter: (page) => !/\/(for|admin|drafts|signin-again)\//.test(page) }),
  ],
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
