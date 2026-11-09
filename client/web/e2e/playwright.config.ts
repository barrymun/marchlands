// Browser tests: headless Chromium against the running stack (docs/features/browser-tests.md). `npm run e2e` from the
// repo root; WEB is the stack's web container (nginx, WEB_PORT in .env), which serves the built client and proxies the API.
import { defineConfig, devices } from '@playwright/test';
import { WEB } from './support/stack.ts';

export default defineConfig({
  testDir: '.',
  // a test.only left in fails the run
  forbidOnly: true,
  // a flaky test is fixed, not retried
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: WEB,
    locale: 'en-GB',
    // the scenes and figures stand still (useMotion), so nothing moves under a click or a screenshot
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // every flow, on a desktop in English
    { name: 'desktop', testIgnore: /(phone|rtl|languages)\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    // the same in the dark theme, which the game follows from the system (next-themes, main.tsx)
    {
      name: 'dark',
      testIgnore: /(phone|rtl|languages)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, colorScheme: 'dark' },
    },
    // a phone (touch, Android's user agent) at the narrowest common width: the cards, the tab bar and the menu sheet
    { name: 'mobile', testMatch: /phone\.spec\.ts$/, use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
    // other languages, as the browser's language picks them (lib/i18n.ts): Arabic, right to left, and the longest
    // words (Spanish, Japanese, which languages.spec.ts sets itself)
    { name: 'languages', testMatch: /(rtl|languages)\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, locale: 'ar' } },
    // Firefox and WebKit (Safari's engine) on request only: E2E_BROWSERS=all npm run e2e (npx playwright install firefox webkit once)
    ...(process.env.E2E_BROWSERS === 'all'
      ? [
          { name: 'firefox', testIgnore: /(phone|rtl|languages)\.spec\.ts$/, use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
          { name: 'webkit', testIgnore: /(phone|rtl|languages)\.spec\.ts$/, use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
        ]
      : []),
  ],
});
