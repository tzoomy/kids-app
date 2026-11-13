import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { buildDefines } from './build/buildDefines';

export default defineConfig({
  define: buildDefines(),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
