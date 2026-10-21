import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1200, height: 1700 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "npm run dev -w apps/web -- --port 3000",
    url: "http://localhost:3000/board",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
