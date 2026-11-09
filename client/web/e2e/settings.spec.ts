// The player's own choices, through the switchers they use: the language in Player settings and the theme in the top
// bar, each kept in this browser (localStorage) so a reload keeps them. The other tests set both from the browser.
import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

test('a player chooses Spanish in Player settings, and a reload keeps it', async ({ loggedIn: page }) => {
  await page.getByRole('button', { name: text('game:account.label') }).click();
  await page.getByRole('menuitem', { name: text('game:account.playerSettings') }).click();
  await page.getByRole('combobox', { name: text('common:language.label') }).click();
  await page.getByRole('option', { name: text('common:language.names.es') }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  // the app is drawn again from its root in the new language (LocaleRoot), which closes the dialog (docs/backlog.md)
  await expect(page.getByRole('navigation', { name: text('game:viewSwitch', {}, 'es') })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('navigation', { name: text('game:viewSwitch', {}, 'es') })).toBeVisible();
});

test('a player chooses the dark theme and then the light one, and a reload keeps it', async ({ loggedIn: page }) => {
  const html = page.locator('html');
  const choose = async (theme: 'dark' | 'light') => {
    await page.getByRole('button', { name: text('theme-toggle:label') }).click();
    await page.getByRole('menuitemradio', { name: text(`theme-toggle:${theme}`) }).click();
  };
  await choose('dark');
  await expect(html).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await choose('light');
  await expect(html).not.toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);
});
