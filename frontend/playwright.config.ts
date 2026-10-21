import { defineConfig, devices } from "@playwright/test";

const PORT = 4174;

// Responsive regression suite (`npm run test:e2e`). Runs the real app in
// Chromium at phone width against mocked Clerk + API — see e2e/support/.
// It serves a production build (vite build + vite preview), not the dev server:
// the dev server compiles ~125 modules on first request, which made the first
// batch of parallel tests time out on slower machines.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      "npx vite build --config e2e/vite.e2e.config.ts --outDir dist-e2e --emptyOutDir && " +
      `npx vite preview --config e2e/vite.e2e.config.ts --outDir dist-e2e --port ${PORT} --strictPort --host localhost`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_e2e",
      VITE_BACKEND_URL: "http://api.e2e.test",
      VITE_BACKEND_WS_URL: "ws://api.e2e.test",
    },
  },
});
