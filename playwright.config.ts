import path from "node:path";
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
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1200, height: 1700 },
        deviceScaleFactor: 1,
        storageState: "e2e/.auth/user.json",
      },
    },
  ],
  webServer: {
    command: "npm run dev -w apps/web -- --port 3000",
    url: "http://localhost:3000/dev/card?fixture=portrait",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { ...(process.env as Record<string, string>), DEV_PHOTOS_DIR: path.resolve("apps/web/public/dev") },
  },
});
