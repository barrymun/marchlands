// Hiring a hero at the Inn, on the Military page beside the city's heroes, on an account of its own (a free hero slot,
// and gold): the set-up builds the Feasting Hall (and the Cottage and Inn it needs) through the API.
import type { TavernOffers } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';

import { createAccount } from './support/accounts.ts';
import { api } from './support/api.ts';
import { ensureBuilding } from './support/city.ts';
import { expect, logIn, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

test('a player hires a hero at the Inn, who joins the city', async ({ page }) => {
  const account = await createAccount(`${test.info().workerIndex}n`);
  await ensureBuilding(account, BuildingType.FEASTING_HALL);
  const [offer] = (await api<TavernOffers>('GET', `/cities/${account.city.id}/tavern`, undefined, account.token)).heros;
  if (!offer) throw new Error('the Inn offers no hero');

  await logIn(page, account);
  await page.goto(`/cities/${account.city.id}/military?tab=inn`);
  // each hero's card is a group named after them, so Hire says whom it hires
  await page
    .getByRole('group', { name: offer.name, exact: true })
    .getByRole('button', { name: text('heroes-panel:inn.hire') })
    .click();
  await expect(page.getByText(text('heroes-panel:toast.hired'))).toBeVisible();
  // the hero is in the city's roster now, beside the Inn
  await expect(page.getByRole('main').getByRole('list').getByRole('button', { name: offer.name, exact: true })).toBeVisible();
});
