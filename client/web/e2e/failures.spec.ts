// When the server says no, fails, or can't be reached: the player gets a clear message and nothing changes. The
// answers are made up by the test (page.route) for one request, building a cottage; the rest of the game is real.
import type { Route } from '@playwright/test';

import { BuildingType } from '@marchlands/core';

import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

// a server error is what this test is about, so the fixture lets 5xx answers through
test.use({ allowServerErrors: true });

const COTTAGE = text(`data-buildings:${BuildingType.COTTAGE}`);

for (const [what, answer, message] of [
  [
    'a refusal',
    (route: Route) => route.fulfill({ status: 400, json: { ok: -99, error: { code: 'building.requirementsNotMet' } } }),
    text('msg-building:requirementsNotMet'),
  ],
  [
    'a server error',
    (route: Route) => route.fulfill({ status: 500, json: { ok: -99, error: { code: 'common.serverError' } } }),
    text('msg-common:serverError'),
  ],
  ['no answer at all', (route: Route) => route.abort('connectionfailed'), text('common:errors.network')],
] as const) {
  test(`${what} when building shows a clear message, and nothing is built`, async ({ loggedIn: page }) => {
    await page.route('**/api/v1/cities/*/buildings', (route) => (route.request().method() === 'POST' ? answer(route) : route.fallback()));
    const slot = page.getByRole('button', { name: /^Build at slot \d+$/ }).first();
    const slotName = await slot.getAttribute('aria-label');
    await slot.press('Enter');
    const dialog = page.getByRole('dialog', { name: text('buildings-panel:buildList.title') });
    await dialog
      .getByRole('group', { name: COTTAGE })
      .getByRole('button', { name: text('buildings-panel:buildList.build') })
      .click();

    await expect(page.getByText(message)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: slotName ?? '', exact: true })).toBeAttached();
  });
}
