import { defineConfig } from "@playwright/test";

const PORT = 3301;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The Chrome already installed on the machine, so no browser download is needed.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    // The production build; run `npm run build` first.
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
