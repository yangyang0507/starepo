import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    alias: {
      '@lancedb/lancedb-darwin-x64': resolve('./node_modules/@lancedb/lancedb-darwin-x64'),
    },
  },
});
