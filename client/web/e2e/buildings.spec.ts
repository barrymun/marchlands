import { BuildingType } from '@marchlands/core';

import { expectAccessible } from './support/axe.ts';
import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

const COTTAGE = text(`data-buildings:${BuildingType.COTTAGE}`);
const TOWN_HALL = text(`data-buildings:${BuildingType.TOWN_HALL}`);

test('a player upgrades the Town Hall, sees it in progress, and cancels it', async ({ loggedIn: page }) => {
  // the Scene's buildings are buttons for the keyboard, drawn over by the canvas: reached as a keyboard user does
  const townHall = page.getByRole('button', { name: `${TOWN_HALL}, level 1`, exact: true });
  await townHall.press('Enter');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: text('buildings-panel:detail.upgrade') })
    .click();

  const inProgress = page.getByRole('region', { name: text('activity-dock:title') });
  await expect(inProgress.getByText(text('activity-dock:job.level', { name: TOWN_HALL, level: 2 }))).toBeVisible();
  // the town with work in progress: the sidebar's progress bars are named
  await expectAccessible(page, 'town');

  await townHall.press('Enter');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: text('common:actions.cancel') })
    .click();
  await expect(inProgress.getByText(text('activity-dock:nothing'))).toBeVisible();
});

test('a player builds a cottage', async ({ loggedIn: page }) => {
  const slot = page.getByRole('button', { name: /^Build at slot \d+$/ }).first();
  await slot.press('Enter');
  const dialog = page.getByRole('dialog', { name: text('buildings-panel:buildList.title') });
  await expect(dialog.getByRole('group', { name: COTTAGE })).toBeVisible();
  await expectAccessible(page, 'build dialog');
  await dialog
    .getByRole('group', { name: COTTAGE })
    .getByRole('button', { name: text('buildings-panel:buildList.build') })
    .click();

  await expect(page.getByText(text('buildings-panel:buildList.started'))).toBeVisible();
  // level 0 while it's built, 1 once done (in a moment at a fast GAME_SPEED)
  await expect(page.getByRole('application').getByRole('button', { name: new RegExp(`^${COTTAGE}, level [01]$`) })).toBeAttached();
});
