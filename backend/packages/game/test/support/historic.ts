// Helpers for the historic city tests: a player's city made a seat, and barbarian cities in and out of its area.

import { BALANCE, inSeatArea, TileType, tileXY } from '@marchlands/core';

import { world } from '#/index.ts';
import { getCity, getTile, saveCity } from '#/repo.ts';
import { type TestPlayer } from '#test/support/factories.ts';
import type { TestGame } from '#test/support/game.ts';

/**
 * Make a player's city a held level 12 historic city where it stands (a shortcut past capturing one in battle, which
 * the combat tests cover): its area is then the 9 tiles round it.
 */
export async function makeSeat(g: TestGame, p: TestPlayer, opts: { auto?: boolean } = {}) {
  const city = await getCity(g, p.cityId);
  await saveCity(g, { ...city, historicLevel: 12, draftAuto: opts.auto ?? true });
  return getCity(g, p.cityId);
}

/** Barbarian cities nobody holds near a player's city, in its seat's area (`inside`) or just beyond it. */
export async function barbariansNear(g: TestGame, p: TestPlayer, inside: boolean) {
  const city = await getCity(g, p.cityId);
  const { x, y } = tileXY(city.tileId);
  const found = await world.searchTiles(g, x, y, 30, TileType.NPC);
  const free = found.filter((t) => t.cityId == null && t.ownerCityId == null && inSeatArea(city.tileId, 12, t.id, BALANCE.mapSize) === inside);
  return Promise.all(free.map((t) => getTile(g, t.id)));
}
