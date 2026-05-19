// vite.config.js — Kairo extension build configuration
import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function getManifest() {
  const base = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));

  if (process.env.BROWSER === 'firefox') {
    const ff = JSON.parse(readFileSync(resolve(__dirname, 'manifest.firefox.json'), 'utf-8'));
    // Deep merge: overlay Firefox-specific fields
    return {
      ...base,
      ...ff,
      background: ff.background || base.background,
    };
  }

  return base;
}

export default defineConfig({
  plugins: [
    webExtension({
      manifest: getManifest,
      watchFilePaths: [
        'manifest.json',
        'manifest.firefox.json',
      ],
    }),
  ],
  build: {
    outDir: process.env.BROWSER === 'firefox' ? 'dist-firefox' : 'dist-chrome',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: process.env.NODE_ENV === 'production',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
});
