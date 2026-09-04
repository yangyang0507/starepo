import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    coverage: {
      include: ['src/**'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 75,
        lines: 75,
      },
    },
  },
});
