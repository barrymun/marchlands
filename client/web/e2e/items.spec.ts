// Items as a player gets and uses them, on an account of its own (its 100,000 gold untouched by other tests): the
// Founder's Gift every new player starts with, and an item bought with gold.
import { ItemId } from '@marchlands/core';

import { createAccount } from './support/accounts.ts';
import { expect, logIn, test } from './support/fixtures.ts';
import { screenName } from './support/screens.ts';
import { text } from './support/text.ts';

test("a player opens the Founder's Gift, then buys a Bow Saw with gold and uses it", async ({ page }) => {
  const account = await createAccount(`${test.info().workerIndex}i`);
  await logIn(page, account);
  await page.goto(`/cities/${account.city.id}/town?panel=items`);
  const panel = page.getByRole('dialog', { name: screenName('items') });
  // each item's card is a group named after it, so its Buy and Use say what they're for
  const card = (id: string) => panel.getByRole('group', { name: text(`data-items:${id}`), exact: true });
  const use = text('common:actions.use');

  await card(ItemId.FOUNDERS_GIFT).getByRole('button', { name: use }).click();
  // a chest gives what's in it
  await expect(card(ItemId.FOUNDERS_GIFT)).toContainText('×0');
  await expect(card(ItemId.NOVICES_NOTES)).toContainText('×5');

  // buying spends gold, so it asks first
  await card(ItemId.BOW_SAW).getByRole('button', { name: /gold/ }).click();
  await page
    .getByRole('dialog', { name: text('items-panel:buyConfirm.title', { item: text(`data-items:${ItemId.BOW_SAW}`) }) })
    .getByRole('button', { name: text('items-panel:buyConfirm.confirm') })
    .click();
  await expect(card(ItemId.BOW_SAW)).toContainText('×1');
  await card(ItemId.BOW_SAW).getByRole('button', { name: use }).click();
  // a running boost shows in its effect's row instead of "off"
  await expect(panel.getByRole('group', { name: text('common:resources.wood'), exact: true }).first()).not.toContainText(text('active-effects:slotCell.off'));
});
