// The game's automation, as a player sets it up: a flow made, saved and run, its report showing what it did in each
// city; and a wave added to a plan, which lands armies on one target in one second, in order (docs/features/camp-times.md).
import { TROOP_ID_BY_KEY } from '@marchlands/core';

import { ensureHero, ensureMilitia, freeValleyNear } from './support/city.ts';
import { expect, test } from './support/fixtures.ts';
import { screenName } from './support/screens.ts';
import { text } from './support/text.ts';

test('a player makes a flow, runs it, and its report shows what it did', async ({ account, loggedIn: page }) => {
  // the default action sets the city's mayor to its best hero by Attack: the city needs a hero
  const hero = await ensureHero(account);
  await page.goto(`/cities/${account.city.id}/flows`);
  await page.getByRole('button', { name: text('flows-panel:list.new') }).click();
  await page.getByRole('textbox', { name: text('flows-panel:flowEditor.name') }).fill('E2E flow');
  await page.getByRole('button', { name: text('common:actions.save'), exact: true }).click();
  await page.getByRole('button', { name: text('flows-panel:runFlow.run_one', { count: 1 }) }).click();

  const row = page.getByRole('row', { name: new RegExp(`^${account.city.name} `) });
  await expect(row).toContainText(text('flows-panel:runFlow.report.ok'));
  await expect(row).toContainText(hero.name);
});

test('a player makes a plan and adds a wave to it', async ({ account, loggedIn: page }) => {
  await ensureHero(account);
  await ensureMilitia(account, 1);
  const target = await freeValleyNear(account);
  await page.goto(`/cities/${account.city.id}/town?panel=plans`);
  const panel = page.getByRole('dialog', { name: screenName('plans') });
  // the form offers a landing time about an hour ahead, which is kept
  await panel.getByRole('textbox', { name: text('plans-panel:form.name') }).fill('E2E plan');
  await panel.getByRole('textbox', { name: text('plans-panel:form.x') }).fill(String(target.x));
  await panel.getByRole('textbox', { name: text('plans-panel:form.y') }).fill(String(target.y));
  await panel.getByRole('button', { name: text('plans-panel:form.create') }).click();

  await panel.getByRole('button', { name: text('plans-panel:addWave') }).click();
  const wave = page.getByRole('dialog', { name: text('send-army-dialog:form.planTitle') });
  await wave.getByRole('textbox', { name: text(`data-troops:${TROOP_ID_BY_KEY.militia}`), exact: true }).fill('1');
  await wave.getByRole('button', { name: text('send-army-dialog:form.addToPlan') }).click();
  await expect(page.getByText(text('send-army-dialog:form.added'))).toBeVisible();
});
