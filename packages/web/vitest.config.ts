import { defineConfig } from 'vitest/config';

// Keep vitest scoped to unit tests under src/; the Playwright E2E specs in
// e2e/ are run by `@playwright/test`, not vitest.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
