import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: false,
    reporters: ['default'],
    testTimeout: 30000,
  },
});
