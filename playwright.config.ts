import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke test config.
 *
 * BASE_URL defaults to the published preview URL so this works in CI without
 * a local dev server. Override with PLAYWRIGHT_BASE_URL to point at a
 * different deployment (e.g. preview branch).
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://power-grid-auditor.lovable.app";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
