// A spend of gold asks first from a tenth of the paying city's gold (lib/gold.ts, SpendGoldButton), on an account of its
// own so the city holds exactly its 100,000. A small spend is one click: the Inn's hire (inn.spec.ts).
import { BuildingType } from '@marchlands/core';

import { createAccount } from './support/accounts.ts';
import { expect, logIn, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

const TOWN_HALL = text(`data-buildings:${BuildingType.TOWN_HALL}`);

test("finishing an hour's upgrade with gold asks first, saying what's left", async ({ page }) => {
  const account = await createAccount(`${test.info().workerIndex}g`);
  await logIn(page, account);
  const townHall = page.getByRole('button', { name: `${TOWN_HALL}, level 1`, exact: true });
  await townHall.press('Enter');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: text('buildings-panel:detail.upgrade') })
    .click();
  const inProgress = page.getByRole('region', { name: text('activity-dock:title') });
  await expect(inProgress.getByText(text('activity-dock:job.level', { name: TOWN_HALL, level: 2 }))).toBeVisible();

  // the price follows the time left in game time (40,000 under 10 game minutes, 85,000 under an hour): over a tenth of
  // the city's 100,000 either way
  await townHall.press('Enter');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${text('speedup-options:finishNow').split(' · ')[0]}`) })
    .click();
  const [before, after] = text('common:spendGold.title').split('{{gold}}');
  const ask = page.getByRole('dialog', { name: new RegExp(`^${before}[\\d,]+${after?.replace('?', '\\?') ?? ''}$`) });
  const gold = Number((await ask.getByRole('heading').innerText()).replace(/\D/g, ''));
  const exact = (n: number) => n.toLocaleString('en-GB');
  await expect(ask).toContainText(text('common:spendGold.description', { city: account.city.name, have: exact(100_000), left: exact(100_000 - gold) }));
  await ask.getByRole('button', { name: text('common:actions.cancel') }).click();
  // nothing spent: the Town Hall's dialog, open behind the question, still has it upgrading
  await expect(page.getByRole('dialog', { name: new RegExp(`^${TOWN_HALL}`) })).toContainText(text('buildings-panel:detail.upgrading', { level: 2 }));
});
