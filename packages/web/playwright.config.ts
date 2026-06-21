import { defineConfig } from '@playwright/test';

// Ports/DB are env-overridable so the same config works on a clean machine
// (defaults) and in constrained environments (override MONGODB_URI etc.).
const API_PORT = process.env.E2E_API_PORT ?? '8088';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '5174';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB ?? 'caribe_trips_e2e';

const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
const API_BASE = `http://127.0.0.1:${API_PORT}/api`;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: WEB_ORIGIN },
  webServer: [
    {
      // The API binary must be built first (`cargo build -p caribe-api`).
      command: `cd ../.. && MONGODB_URI=${MONGODB_URI} MONGODB_DB=${MONGODB_DB} API_BIND=127.0.0.1:${API_PORT} WEB_ORIGIN=${WEB_ORIGIN} ./target/debug/caribe-api`,
      url: `${API_BASE}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `VITE_API_BASE_URL=${API_BASE} pnpm exec vite --port ${WEB_PORT} --strictPort`,
      url: WEB_ORIGIN,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
