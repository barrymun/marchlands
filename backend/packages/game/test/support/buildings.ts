// Helpers for the building tests (services/buildings.db.test.ts, engine/buildings.db.test.ts).

import { heroes } from '#/index.ts';
import { addHero, reloadCity, type TestPlayer } from '#test/support/factories.ts';
import { type TestGame } from '#test/support/game.ts';

export const buildingAt = async (g: TestGame, p: TestPlayer, pos: number) => (await reloadCity(g, p.cityId)).buildings.find((b) => b.positionId === pos);

export async function appointMayor(g: TestGame, p: TestPlayer) {
  const id = await addHero(g, p, 5);
  await heroes.appointMayor(g, p.id, id);
  return id;
}
