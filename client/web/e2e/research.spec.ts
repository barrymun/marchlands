// Research in the Academy, on an account of its own: an Academy needs a level 2 Town Hall, an hour's build bought with
// 85,000 of its 100,000 gold, then the Academy's free speed-up after a 3-game-minute wait (support/city.ts).
import type { PlayerState } from '@marchlands/api-client';
import { BuildingType, TechType } from '@marchlands/core';

import { createAccount } from './support/accounts.ts';
import { api } from './support/api.ts';
import { ensureBuilding } from './support/city.ts';
import { expect, logIn, test } from './support/fixtures.ts';
import { screenName } from './support/screens.ts';
import { text } from './support/text.ts';

const HERO_ENHANCEMENT = text(`data-techs:${TechType.HERO_ENHANCEMENT}`);

test('a player starts a research in the Academy, sees it running, and cancels it', async ({ page }) => {
  const account = await createAccount(`${test.info().workerIndex}r`);
  const { gameSpeed } = await api<PlayerState>('GET', '/player', undefined, account.token);
  test.skip(gameSpeed < 30, `GAME_SPEED is ${gameSpeed}: the Academy's free speed-up would wait minutes (30 or more for this test)`);
  await ensureBuilding(account, BuildingType.ACADEMY);

  await logIn(page, account);
  await page.goto(`/cities/${account.city.id}/town?panel=research`);
  const panel = page.getByRole('dialog', { name: screenName('research') });
  // each technology's card is a group named after it; with only an Academy, Hero Enhancement is the one open to research
  await panel
    .getByRole('group', { name: HERO_ENHANCEMENT, exact: true })
    .getByRole('button', { name: text('research-panel:tech.research') })
    .click();
  await expect(panel.getByText(text('research-panel:job.progress', { name: HERO_ENHANCEMENT, level: 1 }))).toBeVisible();

  await panel.getByRole('button', { name: text('common:actions.cancel') }).click();
  await expect(page.getByText(text('research-panel:job.cancelled', { name: HERO_ENHANCEMENT }))).toBeVisible();
});
