import { BuildingType } from '@marchlands/core';

import { ensureBuilding } from './support/city.ts';
import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

test('a player places a sell order at their own price, sees it waiting, and cancels it', async ({ account, loggedIn: page }) => {
  await ensureBuilding(account, BuildingType.MARKETPLACE);
  await page.goto(`/cities/${account.city.id}/market`);
  // the chart library's credit is a link named by its words
  await expect(page.getByRole('link', { name: 'TradingView Lightweight Charts™' })).toBeVisible();

  const sell = page.getByRole('button', { name: text('market-panel:side.sell'), exact: true });
  await sell.click();
  await expect(sell).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: text('market-panel:tradeForm.limit') }).click();
  await page.getByRole('textbox', { name: text('market-panel:tradeForm.amount') }).fill('1000');
  // just under the merchant's price (BALANCE.merchant, 1.15), above what buyers pay: it waits on the book
  await page.getByRole('textbox', { name: text('market-panel:tradeForm.lowestPrice') }).fill('1.14');
  await page.getByRole('button', { name: text('market-panel:tradeForm.placeSell') }).click();

  const waiting = page.getByRole('tab', { name: new RegExp(`^${text('market-panel:myOrders.title')}`) });
  await expect(waiting).toHaveAccessibleName(`${text('market-panel:myOrders.title')} 1`);

  await page.getByRole('button', { name: text('market-panel:myOrders.cancel') }).click();
  await expect(page.getByText(text('market-panel:myOrders.cancelled'))).toBeVisible();
  await expect(waiting).toHaveAccessibleName(`${text('market-panel:myOrders.title')} 0`);
});
