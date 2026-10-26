import { defineConfig, devices } from "@playwright/test";

// Started by run.mjs, which serves the app and passes its URL in.
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.mjs",
  outputDir: "test-results",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    // The mock OpenID provider's certificate comes from run.mjs's throwaway
    // CA. The browser only passes through its redirect; the app server and
    // Convex, which check its tokens, trust that CA.
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
