import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, 'src');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.spec.ts'],
    globals: true,
  },
});
