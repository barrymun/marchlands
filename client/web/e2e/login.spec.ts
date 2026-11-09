import { expectAccessible } from './support/axe.ts';
import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

test('the login page is accessible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1, name: 'Marchlands' })).toBeVisible();
  await expect(page.getByRole('button', { name: text('login:form.logIn') })).toBeVisible();
  await expectAccessible(page);
});

test('a player logs in and sees their town', async ({ page, account }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel(text('login:form.username')).fill(account.username);
  await page.getByLabel(text('login:form.password')).fill(account.password);
  await page.getByRole('button', { name: text('login:form.logIn') }).click();

  await expect(page).toHaveURL(/\/cities\/\d+\/town/);
  await expect(page.getByText(account.city.name).first()).toBeVisible();
  await expectAccessible(page);
});
