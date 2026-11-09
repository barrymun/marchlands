// The game in the full translations whose words run longest (the languages project): Spanish and Japanese, each picked
// by the browser's language as a player's would be (lib/i18n.ts). Arabic, right to left, has rtl.spec.ts.
import { expectAccessible } from './support/axe.ts';
import { expect, test } from './support/fixtures.ts';
import { openScreen, SCREENS, sidewaysScroll } from './support/screens.ts';

for (const locale of ['es', 'ja-JP']) {
  test.describe(locale, () => {
    test.use({ locale });

    for (const [size, viewport] of [
      ['a desktop', { width: 1280, height: 800 }],
      ['a phone', { width: 375, height: 812 }],
    ] as const) {
      test(`every screen fits ${size} and passes axe`, async ({ account, loggedIn: page }) => {
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await page.setViewportSize(viewport);
        for (const id of SCREENS) {
          await openScreen(page, account, id, locale);
          expect(await sidewaysScroll(page), id).toEqual([]);
          await expectAccessible(page, id);
        }
      });
    }
  });
}
