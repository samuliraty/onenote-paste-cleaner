import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://paste-cleaner.com',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'always' },
});
