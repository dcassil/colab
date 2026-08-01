import { defineConfig, devices } from "@playwright/test";

import { APP_URL } from "./src/shared/ports.mjs";

/**
 * Playwright config for the two-tab example e2e (PROJ-T-0050 / REQ-006).
 *
 * The app + relay are launched by the ONE-COMMAND startup (`pnpm example`,
 * PROJ-T-0049) via `webServer`, so the e2e exercises exactly the documented
 * bring-up. Single Chromium project; two participants are modeled as two browser
 * CONTEXTS inside the spec (not two projects). Web-first assertions + generous
 * timeouts keep the timing-sensitive cursor/lock paths deterministic without
 * arbitrary sleeps.
 *
 * ENVIRONMENT NOTE: if Chromium is unavailable or the relay cannot bind in a
 * sandbox, the spec probe-SKIPS (see `collab.spec.ts`) rather than hard-failing,
 * and the demo/e2e is run locally instead.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Launch the demo via the documented ONE command (root `pnpm example`).
    command: "pnpm --dir .. example",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
