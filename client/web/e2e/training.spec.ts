import { BuildingType, TROOP_ID_BY_KEY } from '@marchlands/core';

import { expectAccessible } from './support/axe.ts';
import { ensureBuilding } from './support/city.ts';
import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

const WORKER = text(`data-troops:${TROOP_ID_BY_KEY.peasants}`);

test('a player trains workers on the Military page, sees them in progress, and cancels the batch', async ({ account, loggedIn: page }) => {
  await ensureBuilding(account, BuildingType.BARRACKS);
  await page.goto(`/cities/${account.city.id}/military`);

  // each troop's card is a group named after it, so its Max says what it's for; the sidebar names troops at home too
  await expect(page.getByRole('group', { name: WORKER }).getByRole('button', { name: text('common:actions.max') })).toBeVisible();
  await expect(page.getByRole('complementary').getByRole('button', { name: `${WORKER} 0` })).toBeVisible();

  // 40 workers take 40 × 50 game seconds, long enough to see in progress at any GAME_SPEED up to 60
  await page.getByRole('textbox', { name: text('military-panel:production.toTrain', { unit: WORKER }) }).fill('40');
  await page.getByRole('button', { name: text('military-panel:production.train'), exact: true }).click();

  const inProgress = page.getByRole('region', { name: text('activity-dock:title') });
  await expect(inProgress.getByText(text('activity-dock:job.troops', { troop: WORKER, amount: 40 }))).toBeVisible();
  // the page with a batch training: its timer bar is named
  await expectAccessible(page, 'military');

  await page
    .getByRole('group', { name: `40 × ${WORKER}` })
    .getByRole('button', { name: text('common:actions.cancel') })
    .click();
  await expect(page.getByText(text('military-panel:production.batchCancelled'))).toBeVisible();
  await expect(inProgress.getByText(text('activity-dock:nothing'))).toBeVisible();
});
