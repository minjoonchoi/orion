import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results-api",
  testDir: "./tests/api",
  testMatch: "*.spec.ts",
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3200",
    locale: "en-US",
  },
  webServer: {
    command: "node tests/api/server.mjs",
    url: "http://127.0.0.1:3200/login",
    timeout: 30000,
    reuseExistingServer: false,
  },
});
