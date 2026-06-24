import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Keep vitest scoped to unit tests under src/; the Playwright E2E specs in
// e2e/ are run by `@playwright/test`, not vitest.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  // Mirror vite.config.ts's `@` alias so source files that import via `@/…`
  // resolve under vitest (which doesn't inherit the main vite config).
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
