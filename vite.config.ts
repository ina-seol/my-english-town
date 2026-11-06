/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    {
      // The 16 MB source sheets are only needed for asset extraction, never at runtime.
      name: 'strip-original-art',
      apply: 'build',
      closeBundle() { fs.rmSync(path.resolve('dist/assets/original'), { recursive: true, force: true }); },
    },
  ],
  base: './',
  // Windows can lock node_modules/.vite during dep optimisation (EPERM on rename); keep the cache outside the project.
  cacheDir: path.join(os.tmpdir(), 'my-english-town-vite'),
  // Phaser is loaded with a dynamic import, so it already becomes its own chunk (loaded after the title screen).
  build: {
    chunkSizeWarningLimit: 1800,
    // two pages: the student game (index.html) and the separate teacher content page (teacher.html)
    rollupOptions: { input: { main: path.resolve(__dirname, 'index.html'), teacher: path.resolve(__dirname, 'teacher.html') } },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
