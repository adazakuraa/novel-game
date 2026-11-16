import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

// パズルゲームは RPG とは別のアプリとして dist/puzzle/ に出力し、GitHub Pages の /puzzle/ で公開する
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [preact()],
  build: {
    outDir: fileURLToPath(new URL('../dist/puzzle', import.meta.url)),
    emptyOutDir: true,
  },
});
