// Zone statistics (worker job) and picking an open flat for new and teleporting cities.

import { and, eq, inArray, sql } from 'drizzle-orm';

import { BALANCE, GameError, msg, randInt, stateBounds, TileType } from '@marchlands/core';
import { type Db, tiles, worldState } from '@marchlands/db';

import { type Ctx } from '#/context.ts';

// ---------------------------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------------------------

export interface ZoneStats {
  /** zone (state) id; the client names it */
  id: number;
  playerCount: number;
  castleCount: number;
  openFlats: number;
  /** share of occupiable tiles that are taken (0-1) */
  settled: number;
}

/** Recompute zone statistics (worker job, cached in world_state). */
export async function refreshZoneStats(db: Db): Promise<ZoneStats[]> {
  const size = BALANCE.mapSize;
  const cell = size / BALANCE.stateGrid;
  const rows = await db.execute<{ state: number; flats: number; open: number; npc: number; castles: number }>(sql`
    select ((id / ${size}) / ${cell})::int * ${BALANCE.stateGrid} + ((id % ${size}) / ${cell})::int as state,
           count(*) filter (where type = ${TileType.FLAT}) as flats,
           count(*) filter (where type = ${TileType.FLAT} and city_id is null and owner_city_id is null) as open,
           count(*) filter (where type = ${TileType.NPC}) as npc,
           count(*) filter (where city_id is not null) as castles
    from tiles group by 1 order by 1`);
  const stats: ZoneStats[] = Array.from({ length: BALANCE.stateGrid ** 2 }, (_, id) => ({ id, playerCount: 0, castleCount: 0, openFlats: 0, settled: 0 }));
  for (const r of rows.rows) {
    const s = stats[Number(r.state)];
    if (!s) continue;
    const castles = Number(r.castles);
    const occupiable = Number(r.flats) + Number(r.npc) + castles;
    s.playerCount = castles;
    s.castleCount = castles + Number(r.npc);
    s.openFlats = Number(r.open);
    s.settled = occupiable ? (occupiable - Number(r.open)) / occupiable : 1;
  }
  await db
    .insert(worldState)
    .values({ key: 'zones', value: stats, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: worldState.key, set: { value: stats, updatedAt: Date.now() } });
  return stats;
}

/** Pick and lock a random open flat in a state (or anywhere when zone < 0). */
export async function pickOpenFlat(ctx: Ctx, zone: number): Promise<number> {
  const size = BALANCE.mapSize;
  for (let attempt = 0; attempt < 5; attempt++) {
    const z = zone >= 0 ? zone : randInt(ctx.rng, 0, 15);
    const b = stateBounds(z, size);
    const candidates: number[] = [];
    for (let i = 0; i < 400; i++) candidates.push(randInt(ctx.rng, b.y1, b.y2) * size + randInt(ctx.rng, b.x1, b.x2));
    const [row] = await ctx.tx
      .select({ id: tiles.id })
      .from(tiles)
      .where(and(inArray(tiles.id, candidates), eq(tiles.type, TileType.FLAT), sql`${tiles.cityId} is null and ${tiles.ownerCityId} is null`))
      .limit(1)
      .for('update', { skipLocked: true });
    if (row) return row.id;
  }
  throw new GameError(msg('world.noOpenFlat'), -25);
}
