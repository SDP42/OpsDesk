import { defineConfig, devices } from "@playwright/test";

/** Demo journeys. Run `make seed` and `make dev` first. */
export default defineConfig({
  testDir: "./journeys",
  globalSetup: "./global-setup.ts",
  workers: 1,
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
