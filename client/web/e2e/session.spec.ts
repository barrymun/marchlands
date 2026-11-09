// Leaving the game: logging out from the account menu, and a login the server no longer accepts (expired or revoked),
// which sends the player back to the login page rather than leaving them on a broken screen (lib/api.ts, onUnauthorized).
import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

test('a player logs out from the account menu, and stays logged out', async ({ account, loggedIn: page }) => {
  await page.getByRole('button', { name: text('game:account.label') }).click();
  await page.getByRole('menuitem', { name: text('common:actions.logOut') }).click();
  await expect(page).toHaveURL(/\/login/);

  // the token is gone: the game's pages send them back to log in
  await page.goto(`/cities/${account.city.id}/town`);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: text('login:form.logIn') })).toBeVisible();
});

test('a login the server no longer accepts sends the player to the login page', async ({ account, page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('marchlands.token', 'expired.or.revoked'));
  await page.goto(`/cities/${account.city.id}/town`);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: text('login:form.logIn') })).toBeVisible();
});
