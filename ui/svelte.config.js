import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: '../dist/ui',
      assets: '../dist/ui',
      fallback: 'index.html',
      precompress: false,
    }),
    paths: { base: '' },
  },
};
