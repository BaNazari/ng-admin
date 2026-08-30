// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Baseline: legacy AngularJS app on http://localhost:8000
 * Later, point PW_BASE_URL at the React app to prove the same specs hold.
 */
module.exports = defineConfig({
  //testDir: './tests',
  testDir:'./',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:8000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
