// Helpers for the research tests (services/research.db.test.ts, engine/research.db.test.ts): a city's
// resources, a lord's research and an Academy.

import { BuildingType, type Resources } from '@marchlands/core';
import { cityBundle, reloadPlayer, setBuildings, type TestPlayer } from '#test/support/factories.ts';
import { type TestGame } from '#test/support/game.ts';

export const res = (c: Resources): Resources => ({ gold: c.gold, food: c.food, wood: c.wood, stone: c.stone, iron: c.iron });

export const stock = async (g: TestGame, p: TestPlayer, cityId = p.cityId) => res((await cityBundle(g, p, cityId)).city);

export const researchOf = async (g: TestGame, p: TestPlayer, techId: number) => (await reloadPlayer(g, p)).research[techId];

export async function withAcademy(g: TestGame, p: TestPlayer, cityId = p.cityId) {
  await setBuildings(
    g,
    p,
    [
      [0, BuildingType.ACADEMY, 1],
      [1001, BuildingType.FARM, 1],
      [1002, BuildingType.SAWMILL, 1],
    ],
    cityId,
  );
}
