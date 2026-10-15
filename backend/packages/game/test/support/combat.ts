// Helpers for the barbarian city tests (services/combat/npc.db.test.ts, engine/combat/npc.db.test.ts).

import { Mission } from '@marchlands/core';

import { arrive, battleOf, reportsOf, send } from '#test/support/armies.ts';
import { type TestPlayer } from '#test/support/factories.ts';
import { type TestGame } from '#test/support/game.ts';

export async function attack(g: TestGame, p: TestPlayer, heroId: number, tileId: number, lightCavalry = 2000) {
  const bean = await send(g, p, { targetTileId: tileId, mission: Mission.ATTACK, troops: { lightCavalry }, heroId });
  await arrive(g, bean.armyId);
  const r = (await reportsOf(g, p.id)).at(-1)!;
  return { armyId: bean.armyId, report: r, battle: battleOf(r, 'npc') };
}
