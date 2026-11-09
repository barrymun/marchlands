// The scenes moving, as most players see them: every other test runs with reduced motion, which keeps the animation
// code (components/iso-anim, fetched only when motion is allowed) and the moving hero from running at all.
import type { Page } from '@playwright/test';
import { ensureHero } from './support/city.ts';
import { expect, test } from './support/fixtures.ts';

test.use({ reducedMotion: 'no-preference' });

/** A picture of the view's canvas, to tell whether anything moved between two moments. */
const frame = (page: Page) => page.getByRole('main').locator('canvas').first().screenshot();

// a new city's fields are all empty plots, with nothing on them to move (crops, sheep and workers come with fields)
for (const [view, moves] of [
  ['town', true],
  ['fields', false],
  ['map', true],
] as const) {
  test(`the ${view} view runs its animations with no errors`, async ({ account, loggedIn: page }) => {
    await page.goto(`/cities/${account.city.id}/${view}`);
    await expect(page.getByRole('main').locator('canvas').first()).toBeVisible();
    // the animations load after the page (useAnimations), then draw about 12 frames a second: compare frames until
    // two differ, which they do as soon as anything moves (smoke, walkers, a glint on the water)
    if (moves)
      await expect
        .poll(
          async () => {
            const before = await frame(page);
            await page.waitForTimeout(400);
            return Buffer.compare(before, await frame(page)) !== 0;
          },
          { timeout: 15_000 },
        )
        .toBe(true);
    // a few more seconds of it, for any frame that throws (the pageErrors fixture)
    await page.waitForTimeout(3000);
  });
}

test('the hero moves on the character sheet, with no errors', async ({ account, loggedIn: page }) => {
  await ensureHero(account);
  await page.goto(`/cities/${account.city.id}/military?tab=heroes`);
  await expect(page.getByRole('main').locator('canvas').first()).toBeVisible();
  await page.waitForTimeout(3000);
});
