// Axe on what the screens show beyond a new account's first look: every tab of every screen, and screens with
// something in them (a hero, a flow, a plan, a market trade, a building's details, the city's own tile, a battle report).
import type { PlayerState, PostCitiesArmiesData, ReportList } from '@marchlands/api-client';
import { BuildingType, Mission, ReportType } from '@marchlands/core';

import { api, until } from './support/api.ts';
import { expectAccessible } from './support/axe.ts';
import { ensureBuilding, ensureHero, ensureMilitia, freeValleyNear } from './support/city.ts';
import { expect, test } from './support/fixtures.ts';
import { loading, openScreen, PAGES, PANELS } from './support/screens.ts';
import { text } from './support/text.ts';

for (const id of [...PAGES, ...PANELS]) {
  test(`every tab of ${id} passes axe`, async ({ account, loggedIn: page }) => {
    await openScreen(page, account, id);
    const tabs = page.getByRole(PANELS.includes(id) ? 'dialog' : 'main').getByRole('tab');
    const count = await tabs.count();
    // a tab can open more tabs (the market's), so they're taken by position, counted again each time
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      if (await tab.isDisabled()) continue;
      await tab.click();
      await expectAccessible(page, `${id} tab ${i}`);
    }
  });
}

test('a hired hero on the Military page passes axe, in 2D and 3D', async ({ account, loggedIn: page }) => {
  const hero = await ensureHero(account);
  await page.goto(`/cities/${account.city.id}/military?tab=heroes`);
  // the character sheet draws the hero in 3D (three.js) by default, a 2D · 3D switch under it; without WebGL 2 (Firefox
  // in a container without a GPU) it falls back to the 2D figure by itself
  const webgl = await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
  if (webgl) {
    await expect(page.getByRole('application', { name: new RegExp(`^${hero.name} `) })).toBeVisible();
    await expectAccessible(page, 'heroes 3d');
    await page.getByRole('button', { name: '2D', exact: true }).click();
  }
  await expect(page.getByRole('application', { name: new RegExp(`^${hero.name} `) })).toHaveCount(0);
  await expectAccessible(page, 'heroes 2d');
});

test('a building, the city and the player settings pass axe', async ({ account, loggedIn: page }) => {
  await page.getByRole('button', { name: `${text(`data-buildings:${BuildingType.TOWN_HALL}`)}, level 1`, exact: true }).press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectAccessible(page, 'town hall');
  await page.keyboard.press('Escape');

  await page
    .getByRole('banner')
    .getByRole('button', { name: new RegExp(`^${account.city.name}`) })
    .click();
  await page.getByRole('menuitem', { name: text('game:citySettings') }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectAccessible(page, 'city settings');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: text('game:account.label') }).click();
  await page.getByRole('menuitem', { name: text('game:account.playerSettings') }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectAccessible(page, 'player settings');
});

test('a new flow and a new plan pass axe', async ({ account, loggedIn: page }) => {
  await page.goto(`/cities/${account.city.id}/flows`);
  await page.getByRole('button', { name: text('flows-panel:list.new') }).click();
  await expect(page.getByText(text('flows-panel:flowEditor.newTitle')).first()).toBeVisible();
  await expectAccessible(page, 'new flow');

  // the Plans panel opens on its new-plan form
  await page.goto(`/cities/${account.city.id}/town?panel=plans`);
  await expect(page.getByRole('button', { name: text('plans-panel:form.create') })).toBeVisible();
  await expectAccessible(page, 'new plan');
});

test('the market with an order waiting and a trade made passes axe', async ({ account, loggedIn: page }) => {
  await ensureBuilding(account, BuildingType.MARKETPLACE);
  await page.goto(`/cities/${account.city.id}/market`);
  await page.getByRole('textbox', { name: text('market-panel:tradeForm.amount') }).fill('100');
  await page.getByRole('button', { name: new RegExp(`^${text('market-panel:tradeForm.buyNow')}`) }).click();
  await page.getByRole('tab', { name: text('market-panel:myTrades.title') }).click();
  await expectAccessible(page, 'market trades');
});

test("the map with the city's own tile selected passes axe", async ({ account, loggedIn: page }) => {
  await page.goto(`/cities/${account.city.id}/map?at=${account.city.x},${account.city.y}`);
  await expect(page.getByRole('region', { name: account.city.name })).toBeVisible();
  await expectAccessible(page, 'map own city');
});

test('a battle report passes axe', async ({ account, loggedIn: page }) => {
  // the one test that waits for game time: an army has to land for there to be a report
  const { gameSpeed } = await api<PlayerState>('GET', '/player', undefined, account.token);
  test.skip(gameSpeed < 30, `GAME_SPEED is ${gameSpeed}: an army would take minutes to land (30 or more for this test)`);
  const hero = await ensureHero(account);
  await ensureMilitia(account, 1);
  const valley = await freeValleyNear(account);
  const body: PostCitiesArmiesData['body'] = { targetTileId: valley.id, mission: Mission.ATTACK, troops: { militia: 1 }, heroId: hero.id };
  await api('POST', `/cities/${account.city.id}/armies`, body, account.token);
  const report = await until(
    'a battle report',
    async () => (await api<ReportList>('GET', `/reports?type=${ReportType.ARMY}`, undefined, account.token)).reports[0],
    90_000,
  );

  await page.goto(`/cities/${account.city.id}/reports?report=${report.id}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(loading(page)).toHaveCount(0);
  await expectAccessible(page, 'report');
});
