// Helpers for the hero tests (services/heroes.db.test.ts, engine/heroes.db.test.ts): an Inn and a Feasting
// Hall, patching hero and player rows, and the hero pushes.

import { PushCmd, type PushData } from '@marchlands/contracts';
import { BuildingType } from '@marchlands/core';

import { getHero, getPlayer, type HeroRow, saveHero, savePlayer } from '#/repo.ts';
import { setBuildings, type TestPlayer } from '#test/support/factories.ts';
import { type TestGame } from '#test/support/game.ts';

const INN = 2;
const HALL = 3;

export const heroBuildings = (g: TestGame, p: TestPlayer, inn: number, hall = 3) =>
  setBuildings(g, p, [
    [INN, BuildingType.INN, inn],
    [HALL, BuildingType.FEASTING_HALL, hall],
  ]);

export async function patchHero(g: TestGame, id: number, fields: Partial<HeroRow>): Promise<HeroRow> {
  const h = await getHero(g, id);
  Object.assign(h, fields);
  await saveHero(g, h);
  return getHero(g, id);
}

export async function patchPlayer(g: TestGame, p: TestPlayer, change: (row: Awaited<ReturnType<typeof getPlayer>>) => void) {
  const row = await getPlayer(g, p.id);
  change(row);
  await savePlayer(g, row);
}

export const lastHeroPush = (g: TestGame) => g.pushes(PushCmd.HERO_UPDATE).at(-1);

export const pushedHeroes = (g: TestGame) => g.pushes(PushCmd.HERO_UPDATE).map((x) => (x.data as PushData<typeof PushCmd.HERO_UPDATE>).hero);
