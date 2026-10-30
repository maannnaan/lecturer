import { defineConfig } from "@playwright/test";

const PORT = 3124;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One shared demo database, so the flows run in order.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The Chrome already installed on the machine, so no browser download is needed.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    // A fresh demo database and a production server; run `npm run build` first.
    command: "node e2e/server.mjs",
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { PORT: String(PORT) },
  },
});
