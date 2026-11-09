import { TROOP_ID_BY_KEY } from '@marchlands/core';

import { expectAccessible } from './support/axe.ts';
import { ensureHero, ensureMilitia, freeValleyNear } from './support/city.ts';
import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

const WARRIOR = text(`data-troops:${TROOP_ID_BY_KEY.militia}`);

test('a player sends an army from the map to attack a free valley, sees it on its way, and recalls it', async ({ account, loggedIn: page }) => {
  const hero = await ensureHero(account);
  await ensureMilitia(account, 1);
  const valley = await freeValleyNear(account);
  // the map opens on a place given in the address, with its tile selected
  await page.goto(`/cities/${account.city.id}/map?at=${valley.x},${valley.y}`);
  await page.getByRole('button', { name: text('map-panel:info.sendArmy') }).click();

  const dialog = page.getByRole('dialog', { name: text('send-army-dialog:form.title') });
  await expect(dialog).toBeVisible();
  await expectAccessible(page, 'send army');
  await dialog.getByRole('combobox', { name: text('send-army-dialog:form.hero') }).click();
  await page.getByRole('option', { name: new RegExp(`^${hero.name} `) }).click();
  await dialog.getByRole('textbox', { name: WARRIOR, exact: true }).fill('1');
  await dialog.getByRole('button', { name: text('common:actions.send'), exact: true }).click();
  await expect(page.getByText(text('send-army-dialog:form.dispatched'))).toBeVisible();

  await page.goto(`/cities/${account.city.id}/town?panel=armies`);
  const armies = page.getByRole('dialog', { name: text('game:nav.armies') });
  await expect(armies.getByText(hero.name)).toBeVisible();
  await expect(armies.getByText(text('armies-panel:row.marching'))).toBeVisible();

  // called back before it lands, so the valley it was sent to is left as it was
  await armies.getByRole('button', { name: text('armies-panel:row.recall') }).click();
  await expect(page.getByText(text('armies-panel:recalled'))).toBeVisible();
  await expect(armies.getByText(text('armies-panel:row.returning'))).toBeVisible();
});
