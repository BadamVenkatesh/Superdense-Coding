import { defineConfig } from 'vitest/config';

// `base: './'` lets the built game run from any sub-path: GitHub Pages project
// sites, Netlify, Vercel, Cloudflare Pages, or a plain folder on a USB stick.
export default defineConfig({
  base: './',
  build: { target: 'es2020', sourcemap: false, assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
