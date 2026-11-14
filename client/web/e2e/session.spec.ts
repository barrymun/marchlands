// Leaving the game: logging out from the account menu, logging out everywhere from Player settings, and a login the
// server no longer accepts (expired or revoked), which sends the player back to the login page rather than leaving
// them on a broken screen (lib/api.ts, onUnauthorized).
import { createAccount } from './support/accounts.ts';
import { expectAccessible } from './support/axe.ts';
import { expect, logIn, test } from './support/fixtures.ts';
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

test('a player logs out everywhere from Player settings: the old login is refused, and a new one works', async ({ page }) => {
  // an account of its own: every login of it ends, the worker's shared one would too
  const account = await createAccount(`${test.info().workerIndex}o`);
  await logIn(page, account);
  await page.getByRole('button', { name: text('game:account.label') }).click();
  await page.getByRole('menuitem', { name: text('game:account.playerSettings') }).click();
  await page.getByRole('button', { name: text('lord-dialog:sessions.button') }).click();
  const confirm = page.getByRole('dialog', { name: text('lord-dialog:sessions.confirmTitle') });
  await expect(confirm).toBeVisible();
  await expectAccessible(page);
  await confirm.getByRole('button', { name: text('lord-dialog:sessions.button') }).click();
  await expect(page).toHaveURL(/\/login/);

  // the login from before, as another browser would still hold it, is no longer taken
  await page.evaluate((token) => localStorage.setItem('marchlands.token', token), account.token);
  await page.goto(`/cities/${account.city.id}/town`);
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel(text('login:form.username')).fill(account.username);
  await page.getByLabel(text('login:form.password')).fill(account.password);
  await page.getByRole('button', { name: text('login:form.logIn') }).click();
  await expect(page).toHaveURL(/\/cities\/\d+\/town/);
});
