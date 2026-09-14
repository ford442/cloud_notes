import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// `npm test` runs the smokes against the Vite dev server. Set E2E_USE_PREVIEW=1 to
// run them against the production build instead (`npm run build && npm run preview`).
const usePreview = process.env.E2E_USE_PREVIEW === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    // The header packs ten editor-mode buttons in a row; a narrow viewport
    // overflows it across the sidebar and swallows clicks there.
    viewport: { width: 1680, height: 1000 },
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    // Web Crypto (used by src/utils/encryption.ts) requires a secure context;
    // 127.0.0.1 counts as one, so no extra flags are needed here.
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Escape hatch for sandboxes/CI images that ship their own Chromium
        // instead of the exact build `npx playwright install` would fetch.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
          : {}),
      },
    },
  ],
  webServer: {
    command: usePreview
      ? `npm run preview -- --port ${PORT} --strictPort`
      : `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
