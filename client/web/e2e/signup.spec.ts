import { randomBytes } from 'node:crypto';

import { noteAccount, runName } from './support/accounts.ts';
import { expectAccessible } from './support/axe.ts';
import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

test('a new player signs up, the puzzle solved in the browser, and founds a city', async ({ page }) => {
  const username = `fx_e2e_${runName()}_s${test.info().workerIndex}`;
  noteAccount(username);
  await page.goto('/login');
  await page.getByRole('tab', { name: text('login:tabs.register') }).click();
  await page.getByLabel(text('login:form.username')).fill(username);
  await page.getByLabel(text('login:form.email')).fill(`${username}@example.test`);
  await page.getByLabel(text('login:form.password')).fill(randomBytes(12).toString('base64url'));
  // the button waits for the puzzle, solved by a Web Worker while the form is filled in
  await page.getByRole('button', { name: text('login:form.createAccount') }).click();

  await expect(page.getByRole('heading', { level: 1, name: text('create-lord:title') })).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel(text('create-lord:playerName')).fill(username.replaceAll('_', ''));
  await page.getByLabel(text('create-lord:cityName')).fill('E2E Founding');
  await page.getByLabel(text('create-lord:flag')).fill('E2E');
  await page.getByRole('button', { name: text('create-lord:submit') }).click();

  await expect(page).toHaveURL(/\/cities\/\d+\/town/);
  await expect(page.getByRole('banner').getByRole('button', { name: /^E2E Founding/ })).toBeVisible();
});
