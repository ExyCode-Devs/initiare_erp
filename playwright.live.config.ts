import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["live-*.spec.ts"],
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8081",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run test:e2e:live:api",
      url: "http://127.0.0.1:4010/api/health",
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "npm run test:e2e:live:web",
      url: "http://127.0.0.1:8081/login",
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
