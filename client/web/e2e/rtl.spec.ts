// The game in Arabic (the rtl project: the browser's language is Arabic, which picks the locale): the page runs right
// to left, the layout mirrors (start and end classes, AGENTS.md, Translations) and nothing ends up wider than the screen.
import { expectAccessible } from './support/axe.ts';
import { expect, test } from './support/fixtures.ts';
import { openScreen, screenName, SCREENS, sidewaysScroll } from './support/screens.ts';
import { text } from './support/text.ts';

const AR = 'ar';

test('Arabic turns the game right to left, the sidebar on the left', async ({ account, loggedIn: page }) => {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', AR);
  const views = page.getByRole('navigation', { name: text('game:viewSwitch', {}, AR) });
  await expect(views.getByRole('button')).toHaveText(['town', 'fields', 'map'].map((id) => screenName(id, AR)));

  await openScreen(page, account, 'military', AR);
  // the sidebar comes after the screen in its row (game.tsx): on the right in English, on the left in Arabic
  const sidebar = await page.getByRole('complementary', { name: text('game:sidebar', {}, AR) }).boundingBox();
  const main = await page.getByRole('main').boundingBox();
  expect(sidebar?.x).toBeLessThan(main?.x ?? -Infinity);
});

for (const [size, viewport] of [
  ['a desktop', { width: 1280, height: 800 }],
  ['a phone', { width: 375, height: 812 }],
] as const) {
  test(`every screen fits ${size} and passes axe`, async ({ account, loggedIn: page }) => {
    await page.setViewportSize(viewport);
    for (const id of SCREENS) {
      await openScreen(page, account, id, AR);
      expect(await sidewaysScroll(page), id).toEqual([]);
      await expectAccessible(page, id);
    }
  });
}
