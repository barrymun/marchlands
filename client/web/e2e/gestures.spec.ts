// Moving round the canvas views as a player does with a mouse (components/iso-viewport): dragging, the wheel's zoom and a
// click on what's drawn. The other tests reach the map by its address and the Scene's buildings by the keyboard.
import type { Locator, Page } from '@playwright/test';

import { BuildingType } from '@marchlands/core';

import { expect, test } from './support/fixtures.ts';
import { text } from './support/text.ts';

const TOWN_HALL = text(`data-buildings:${BuildingType.TOWN_HALL}`);

/** Drag the canvas by (dx, dy) from its middle, in steps, as a hand would (a press that hardly moves is a click). */
async function drag(page: Page, canvas: Locator, dx: number, dy: number) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('the canvas has no box');
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

/** The middle of an element's box. */
async function middle(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
}

test("the town's Scene drags, zooms with the wheel, and a click on a building opens it", async ({ loggedIn: page }) => {
  const scene = page.getByRole('application');
  // the Scene's buildings are keyboard buttons laid over the canvas where each is drawn: where it is shows where the camera is
  const townHall = page.getByRole('button', { name: `${TOWN_HALL}, level 1`, exact: true });
  const start = await middle(townHall);

  await drag(page, scene, -150, 60);
  await expect.poll(async () => (await middle(townHall)).x).toBeCloseTo(start.x - 150, -1);

  const dragged = await middle(townHall);
  await page.mouse.move(dragged.x, dragged.y);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await middle(townHall)).width).toBeGreaterThan(dragged.width);

  // a click picks the building whose pixels are under the pointer (hitTest)
  const zoomed = await middle(townHall);
  await page.mouse.click(zoomed.x, zoomed.y);
  await expect(page.getByRole('dialog')).toContainText(TOWN_HALL);
});

test('the map drags, zooms round the pointer, goes back to the city, and a click selects a tile', async ({ account, loggedIn: page }) => {
  await page.goto(`/cities/${account.city.id}/map`);
  const map = page.getByRole('application');
  const toolbar = page.getByRole('toolbar', { name: text('map-panel:toolbar') });
  const here = (x: number, y: number) => text('map-panel:goTo.open', { x, y });
  const where = toolbar.getByRole('button', { name: /\(\d+, \d+\)/ }).first();
  await expect(where).toHaveAccessibleName(here(account.city.x, account.city.y));

  // the map opens on the city; a drag moves it to another tile
  await drag(page, map, -300, 0);
  await expect(where).not.toHaveAccessibleName(here(account.city.x, account.city.y));

  // the wheel zooms round the pointer: aimed off the middle, the tile in the middle changes too
  await toolbar.getByRole('button', { name: text('map-panel:pan.home') }).click();
  await expect(where).toHaveAccessibleName(here(account.city.x, account.city.y));
  const box = await map.boundingBox();
  if (!box) throw new Error('the map has no box');
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -600);
  await expect(where).not.toHaveAccessibleName(here(account.city.x, account.city.y));

  // back on the city, a click in the middle selects its tile, and its card opens
  await toolbar.getByRole('button', { name: text('map-panel:pan.home') }).click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('region', { name: account.city.name })).toBeVisible();
});
