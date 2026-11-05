/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Windows can lock node_modules/.vite during dep optimisation (EPERM on rename); keep the cache outside the project.
  cacheDir: path.join(os.tmpdir(), 'my-english-town-vite'),
  // Phaser is loaded with a dynamic import, so it already becomes its own chunk (loaded after the title screen).
  build: { chunkSizeWarningLimit: 1800 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
