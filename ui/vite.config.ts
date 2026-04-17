import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [sveltekit(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3450', changeOrigin: true },
    },
  },
};
