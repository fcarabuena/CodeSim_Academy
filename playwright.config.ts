import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke test (tests/e2e). Run after a production build:
 *
 *   npm run build
 *   npm run test:e2e
 *
 * Starts `next start` on E2E_PORT (default 3100) unless E2E_BASE_URL points at
 * an already running app. Uses the database from .env (or E2E_DATABASE_URL)
 * and deletes every account it creates when it finishes.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 10 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
        // Auth redirects must point at the port the test uses.
        env: { AUTH_URL: baseURL, AUTH_ROLE_REFRESH_MS: "2000" },
      },
});
