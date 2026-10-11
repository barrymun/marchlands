// Database helpers for the tests of city.ts, repo.ts and dto.ts: armies out of a city, valleys held by it,
// and starvation desertion switched on (BALANCE.starvationDesertion is off in this game).

import { afterAll, beforeAll } from 'vitest';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ArmyDirection, BALANCE, Mission, msg, type TroopCounts } from '@marchlands/core';
import { armies, tiles } from '@marchlands/db';
import { getCity, type ArmyRow } from '../../src/index.ts';
import type { TestPlayer } from './factories.ts';
import type { TestGame } from './game.ts';

/** An army row out of the player's city (what armies.sendArmy would store), heading for `targetTileId`. */
export async function insertArmy(
  g: TestGame,
  p: TestPlayer,
  troops: TroopCounts,
  opts: { cityId?: number; targetTileId?: number; direction?: number } = {},
): Promise<ArmyRow> {
  const city = await getCity(g, opts.cityId ?? p.cityId);
  const pos = msg('world.position.city', { name: city.name, x: 0, y: 0 });
  const [row] = await g.tx
    .insert(armies)
    .values({
      playerId: p.id,
      cityId: city.id,
      mission: Mission.ATTACK,
      direction: opts.direction ?? ArmyDirection.FORWARD,
      startTileId: city.tileId,
      targetTileId: opts.targetTileId ?? city.tileId + 1,
      troops,
      resources: { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 },
      startTime: g.now,
      reachTime: g.now + 60_000,
      startPosName: pos,
      targetPosName: pos,
      createdAt: g.now,
    })
    .returning();
  return row;
}

/** Give the city a free valley of this type (as occupying one does); returns its id. */
export async function holdValley(g: TestGame, p: TestPlayer, type: number, cityId = p.cityId): Promise<number> {
  const [row] = await g.tx
    .select({ id: tiles.id })
    .from(tiles)
    .where(and(eq(tiles.type, type), isNull(tiles.cityId), isNull(tiles.ownerCityId)))
    .orderBy(asc(tiles.id))
    .limit(1);
  await g.tx.update(tiles).set({ ownerCityId: cityId, ownerPlayerId: p.id }).where(eq(tiles.id, row.id));
  return row.id;
}

/** Switch starvation desertion on for the tests of the enclosing describe block. */
export function withStarvationDesertion() {
  const balance = BALANCE as { starvationDesertion: boolean };
  let was = balance.starvationDesertion;
  beforeAll(() => {
    was = balance.starvationDesertion;
    balance.starvationDesertion = true;
  });
  afterAll(() => {
    balance.starvationDesertion = was;
  });
}
