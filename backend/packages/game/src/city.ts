// Loading a city together with everything its economy depends on, and settling it to "now".

import { and, count, eq, ne } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  addTroops,
  type CityStats,
  computeCityStats,
  type EconomyContext,
  GameError,
  heroManagement,
  heroPower,
  HeroStatus,
  heroStratagem,
  type MayorStats,
  msg,
  settleCity,
  type SettleResult,
  tileXY,
  type TroopCounts,
} from '@marchlands/core';
import { one, players } from '@marchlands/db';

import type { Ctx } from '#/context.ts';
import { troopBean } from '#/dto.ts';
import { reportDesertion } from '#/engine/reports.ts';
import {
  armiesOfCity,
  type CityRow,
  findCity,
  getCity,
  getPlayer,
  heroesOfCity,
  type HeroRow,
  type PlayerRow,
  saveCity,
  type TileRow,
  valleysOfCity,
} from '#/repo.ts';
import { noteSettle } from '#/stats.ts';

export interface CityBundle {
  player: PlayerRow;
  city: CityRow;
  heroes: HeroRow[];
  valleys: TileRow[];
  /** troops of this city that are out marching or stationed elsewhere */
  awayTroops: TroopCounts;
  /** set by viewCity: troops the in-memory settle found deserting (not yet saved or reported) */
  deserted?: TroopCounts;
  /** (marchlands) a held historic city: whether the holder's alliance shares its tribute */
  seats?: { shared: boolean };
}

export function mayorOf(heroes: HeroRow[]): HeroRow | undefined {
  return heroes.find((h) => h.status === HeroStatus.MAYOR);
}

export function mayorStats(heroes: HeroRow[]): MayorStats | null {
  const m = mayorOf(heroes);
  return m ? { power: heroPower(m), management: heroManagement(m), stratagem: heroStratagem(m) } : null;
}

/** @internal exported for its unit test */
export function economyContext(b: CityBundle): EconomyContext {
  return {
    research: b.player.research,
    mayor: mayorStats(b.heroes),
    heroLevels: b.heroes.map((h) => h.level),
    valleys: b.valleys.map((v) => ({ type: v.type, level: v.level })),
    buffs: b.player.buffs,
    awayTroops: b.awayTroops,
    ...(b.seats ? { seats: b.seats } : {}),
  };
}

export function cityStats(b: CityBundle, now: number): CityStats {
  return computeCityStats(b.city, economyContext(b), now);
}

export async function loadBundle(ctx: Ctx, city: CityRow, player: PlayerRow): Promise<CityBundle> {
  // sequential: queries on one transaction connection must not overlap
  const heroes = await heroesOfCity(ctx, city.id);
  const valleys = await valleysOfCity(ctx, city.id);
  const armies = await armiesOfCity(ctx, city.id);
  let away: TroopCounts = {};
  for (const a of armies) away = addTroops(away, a.troops);
  const seats = city.historicLevel == null ? undefined : await seatsOf(ctx, player);
  return { player, city, heroes, valleys, awayTroops: away, ...(seats ? { seats } : {}) };
}

/** (marchlands) Whether a historic city's holder is in an alliance with anyone else (who then share their tribute). */
async function seatsOf(ctx: Ctx, player: PlayerRow): Promise<{ shared: boolean }> {
  const others =
    player.allianceId == null
      ? 0
      : one(
          await ctx.tx
            .select({ n: count() })
            .from(players)
            .where(and(eq(players.allianceId, player.allianceId), ne(players.id, player.id))),
        ).n;
  return { shared: Number(others) > 0 };
}

/**
 * Settle resources/population to ctx.now (mutates the bundle's city row).
 * @internal exported for tests; game code settles with settleAndReport
 */
export function settle(ctx: Ctx, b: CityBundle): SettleResult {
  const r = settleCity(b.city, economyContext(b), ctx.now);
  noteSettle(b.city, r.flows, r.deserted);
  if (Object.keys(r.deserted).length) {
    ctx.push(b.player.id, PushCmd.TROOP_UPDATE, { castleId: b.city.id, troop: troopBean(b.city.troops) });
  }
  return r;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Settle a locked city and report any troops that deserted for lack of food. */
export async function settleAndReport(ctx: Ctx, b: CityBundle): Promise<SettleResult> {
  const from = b.city.resourcesAt;
  const r = settle(ctx, b);
  if (Object.keys(r.deserted).length) {
    const stats = cityStats(b, ctx.now);
    const { x, y } = tileXY(b.city.tileId);
    await reportDesertion(ctx, {
      playerId: b.player.id,
      cityId: b.city.id,
      city: b.city.name,
      from,
      troops: r.deserted,
      food: { production: r2(stats.rates.food + stats.upkeep), upkeep: r2(stats.upkeep), net: r2(stats.rates.food) },
      position: msg('world.position.city', { name: b.city.name, x, y }),
    });
  }
  return r;
}

/**
 * Lock the player and one of their cities, load the economy context and settle it.
 * Throws when the city does not belong to the player.
 */
export async function openOwnCity(ctx: Ctx, playerId: number, cityId: number): Promise<CityBundle> {
  const player = await getPlayer(ctx, playerId, { lock: true });
  const city = await getCity(ctx, cityId, { lock: true });
  if (city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  const b = await loadBundle(ctx, city, player);
  await settleAndReport(ctx, b);
  return b;
}

/** Lock a city and its current owner (used by timed events, which do not know the owner). */
export async function openCity(ctx: Ctx, cityId: number): Promise<CityBundle | null> {
  for (let i = 0; i < 3; i++) {
    const peek = await findCity(ctx, cityId);
    if (!peek) return null;
    const player = await getPlayer(ctx, peek.playerId, { lock: true });
    const city = await findCity(ctx, cityId, { lock: true });
    if (!city) return null; // gone while we waited
    if (city.playerId !== player.id) continue; // ownership changed while we waited
    const b = await loadBundle(ctx, city, player);
    await settleAndReport(ctx, b);
    return b;
  }
  return null;
}

/** Read-only view of a city settled in memory (no locks, nothing written). */
export async function viewCity(ctx: Ctx, cityId: number, player?: PlayerRow): Promise<CityBundle> {
  const city = await getCity(ctx, cityId);
  const owner = player && player.id === city.playerId ? player : await getPlayer(ctx, city.playerId);
  const b = await loadBundle(ctx, city, owner);
  const r = settleCity(b.city, economyContext(b), ctx.now);
  if (Object.keys(r.deserted).length) b.deserted = r.deserted;
  return b;
}

/**
 * The owner's view of their city. When troops deserted since the last save, the city is
 * settled for real (locked, saved, desertion reported) so the report shows up straight away.
 */
export async function viewOwnCity(ctx: Ctx, playerId: number, cityId: number, player?: PlayerRow): Promise<CityBundle> {
  const b = await viewCity(ctx, cityId, player);
  if (!b.deserted || b.city.playerId !== playerId) return b;
  const own = await openOwnCity(ctx, playerId, cityId);
  await saveCity(ctx, own.city);
  return own;
}
