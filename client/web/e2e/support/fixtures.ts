// The browser tests' `test`: every spec imports it from here, not from @playwright/test.
//   account    a temporary account per worker (support/accounts.ts), deleted by the global teardown
//   loggedIn   the page, logged in as `account` (logIn), at the town
//   pageErrors (automatic) fails a test on a console error, an uncaught page error or a 5xx answer; a test that causes
//              5xx answers on purpose sets test.use({ allowServerErrors: true })
import { test as base, expect, type Page } from '@playwright/test';
import { type Account, createAccount } from './accounts.ts';

/**
 * Firefox's error for a font download it cancelled (NS_BINDING_ABORTED), as when a test moves to another page while
 * fonts are loading: not a fault. A font that's missing logs another status, and still fails the test.
 */
const FONT_ABORTED = 'status=2152398850';

/** Where the client keeps its token (client/web/src/lib/api.ts, TOKEN_KEY). */
const TOKEN_KEY = 'marchlands.token';

/**
 * Log the page in as `account`, at its town: its token put in localStorage once, as logging in through the form does,
 * so logging out (which removes it) sticks across reloads.
 */
export async function logIn(page: Page, account: Account) {
  await page.goto('/login');
  await page.evaluate(([key, token]) => localStorage.setItem(key, token), [TOKEN_KEY, account.token] as const);
  await page.goto(`/cities/${account.city.id}/town`);
  await expect(page.getByRole('button', { name: new RegExp(`^${account.city.name}`) }).first()).toBeVisible();
}

export const test = base.extend<{ loggedIn: Page; pageErrors: void; allowServerErrors: boolean }, { account: Account }>({
  allowServerErrors: [false, { option: true }],
  account: [
    // eslint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern, and this one has none
    async ({}, use, workerInfo) => {
      await use(await createAccount(workerInfo.workerIndex));
    },
    { scope: 'worker' },
  ],
  loggedIn: async ({ page, account }, use) => {
    await logIn(page, account);
    await use(page);
  },
  pageErrors: [
    async ({ page, allowServerErrors }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        // the browser logs every 4xx answer too, and those are the game saying no (GET /player before the player
        // exists): answers are judged by their status below instead
        if (m.type() === 'error' && !m.text().startsWith('Failed to load resource') && !m.text().includes(FONT_ABORTED)) errors.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
      page.on('response', (r) => {
        if (r.status() >= 500 && !allowServerErrors) errors.push(`${r.status()} from ${r.request().method()} ${r.url()}`);
      });
      await use();
      expect(errors, 'errors in the page').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
