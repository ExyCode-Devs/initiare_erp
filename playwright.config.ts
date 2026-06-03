import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8080",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run vite -- --host 127.0.0.1 --port 8080",
    url: "http://127.0.0.1:8080/login",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
