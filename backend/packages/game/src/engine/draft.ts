// (marchlands) The daily draft of a held historic city (docs/features/historical-cities.md, Capturing and holding
// one): BALANCE.historic.draftsPerDay drafts a UTC day, each taking BALANCE.historic.draftShare of a barbarian city's
// largest troop type into the seat. A seat drafts by itself unless its holder turned that off (draftJob, jobs.ts),
// aiming at the strongest barbarian cities in its area; its holder can always choose one (services/historic.ts).

import { and, eq, isNull, sql } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  addTroops,
  BALANCE,
  DAY,
  draftStanding,
  draftsUsed,
  draftTake,
  HISTORIC_LEVELS,
  type HistoricLevel,
  inSeatArea,
  msg,
  randInt,
  stateBounds,
  stateOf,
  TileType,
} from '@marchlands/core';
import { tiles } from '@marchlands/db';

import { type Ctx } from '#/context.ts';
import { troopBean } from '#/dto.ts';
import { cityPosition, tilePosition } from '#/engine/armies.ts';
import { npcState } from '#/engine/combat.ts';
import { createReport } from '#/engine/reports.ts';
import { addStanding } from '#/engine/reputation.ts';
import { ruledZones } from '#/engine/seats.ts';
import { type CityRow, saveCity, saveTile, type TileRow } from '#/repo.ts';

/** A held historic city's level, or null for any other city. */
export const seatLevelOf = (city: CityRow): HistoricLevel | null => HISTORIC_LEVELS.find((l) => l === city.historicLevel) ?? null;

/** Whether a tile is a barbarian city nobody holds, which a seat may draft from. */
export const draftable = (t: TileRow) => t.type === TileType.NPC && t.cityId == null && t.ownerCityId == null;

/**
 * The barbarian city a seat drafting by itself aims at: of those nobody holds in its area, the highest level; among
 * several, the one with the most troops when the seat has a scout to compare them (equals at random), else one at random.
 * Returns it with how many were compared (0 when picked at random), or null when its area holds none.
 */
export async function pickDraftTarget(ctx: Ctx, city: CityRow, level: HistoricLevel): Promise<{ tile: TileRow; scouted: number } | null> {
  const size = BALANCE.mapSize;
  const x = city.tileId % size;
  const y = Math.floor(city.tileId / size);
  // the area as a rough box (wrapped distance), then exactly by inSeatArea
  const reach = level === 12 ? 9 : level === 14 ? 33 : null;
  const near = (axis: 'x' | 'y', at: number, r: number) => {
    const v = axis === 'x' ? sql`${tiles.id} % ${size}` : sql`${tiles.id} / ${size}`;
    return sql`least(abs(${v} - ${at}), ${size} - abs(${v} - ${at})) <= ${r}`;
  };
  const state = level === 16 ? stateBounds(stateOf(city.tileId, size), size) : null;
  const area = reach
    ? sql`${near('x', x, reach)} and ${near('y', y, reach)}`
    : state
      ? sql`${tiles.id} % ${size} between ${state.x1} and ${state.x2} and ${tiles.id} / ${size} between ${state.y1} and ${state.y2}`
      : sql`true`;
  const free = and(eq(tiles.type, TileType.NPC), isNull(tiles.cityId), isNull(tiles.ownerCityId), area);
  const [top] = await ctx.tx
    .select({ level: sql<number>`max(${tiles.level})` })
    .from(tiles)
    .where(free);
  if (top?.level == null) return null;
  const rows = (
    await ctx.tx
      .select()
      .from(tiles)
      .where(and(free, eq(tiles.level, top.level)))
  ).filter((t) => inSeatArea(city.tileId, level, t.id, size));
  // with a scout the seat compares them all and keeps those with the most troops; without, any of them will do
  const scouted = rows.length > 1 && (city.troops.scouter ?? 0) >= 1;
  const counted = rows.map((t) => ({ t, n: scouted ? Object.values(npcState(t, ctx.now).troops).reduce((sum, n) => sum + n, 0) : 0 }));
  const most = Math.max(...counted.map((c) => c.n));
  const best = counted.filter((c) => c.n === most);
  const chosen = best[randInt(ctx.rng, 0, best.length - 1)];
  return chosen ? { tile: chosen.t, scouted: scouted ? rows.length : 0 } : null;
}

/**
 * Draft from a barbarian city into a seat (both locked): BALANCE.historic.draftShare of its largest troop type, as its
 * garrison stands now, counted against the seat's drafts today. Returns what was drafted, or null if it had no troops.
 */
export async function draft(ctx: Ctx, city: CityRow, tile: TileRow, opts: { auto: boolean; scouted: number }) {
  const npc = npcState(tile, ctx.now);
  const take = draftTake(npc.troops);
  if (!take) return null;
  const troops = { [take.key]: take.count };
  Object.assign(tile, { state: npc.state, troops: addTroops(npc.troops, troops, -1), forts: npc.forts, updatedAt: ctx.now });
  await saveTile(ctx, tile);
  Object.assign(city, { troops: addTroops(city.troops, troops), draftDay: Math.floor(ctx.now / DAY), draftsUsed: draftsUsed(city, ctx.now) + 1 });
  await saveCity(ctx, city);
  // (marchlands) drafting from a faction's member costs standing with it (core draftStanding)
  const moved = draftStanding(tile.id, tile.level, await ruledZones(ctx));
  const standing = moved && { faction: moved.faction.id, change: moved.change, now: await addStanding(ctx, city.playerId, moved.faction.id, moved.change) };
  const target = await tilePosition(ctx, tile);
  await createReport(ctx, {
    playerId: city.playerId,
    title: msg('report.title.draft'),
    startPos: target,
    targetPos: cityPosition(city.name, city.tileId),
    body: {
      kind: 'draft',
      draft: { cityId: city.id, city: city.name, target, level: tile.level, troops, auto: opts.auto, scouted: opts.scouted, ...(standing ? { standing } : {}) },
    },
  });
  ctx.push(city.playerId, PushCmd.TROOP_UPDATE, { castleId: city.id, troop: troopBean(city.troops) });
  return troops;
}
