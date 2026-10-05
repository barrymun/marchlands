// Loading a city together with everything its economy depends on, and settling it to "now".

import {
  computeCityStats,
  GameError,
  heroManagement,
  heroPower,
  heroStratagem,
  HeroStatus,
  settleCity,
  addTroops,
  type CityStats,
  type EconomyContext,
  type MayorStats,
  type SettleResult,
  type TroopCounts,
} from '@evony/core';
import type { Ctx } from './context.ts';
import { armiesOfCity, findCity, getCity, getPlayer, heroesOfCity, valleysOfCity, type CityRow, type HeroRow, type PlayerRow, type TileRow } from './repo.ts';

export interface CityBundle {
  player: PlayerRow;
  city: CityRow;
  heroes: HeroRow[];
  valleys: TileRow[];
  /** troops of this city that are out marching or stationed elsewhere */
  awayTroops: TroopCounts;
}

export function mayorOf(heroes: HeroRow[]): HeroRow | undefined {
  return heroes.find((h) => h.status === HeroStatus.MAYOR);
}

export function mayorStats(heroes: HeroRow[]): MayorStats | null {
  const m = mayorOf(heroes);
  return m ? { power: heroPower(m), management: heroManagement(m), stratagem: heroStratagem(m) } : null;
}

export function economyContext(b: CityBundle): EconomyContext {
  return {
    research: b.player.research,
    mayor: mayorStats(b.heroes),
    // seized heroes held prisoner here are not paid
    heroLevels: b.heroes.filter((h) => h.playerId === b.city.playerId).map((h) => h.level),
    valleys: b.valleys.map((v) => ({ type: v.type, level: v.level })),
    buffs: b.player.buffs,
    awayTroops: b.awayTroops,
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
  return { player, city, heroes, valleys, awayTroops: away };
}

/** Settle resources/population to ctx.now (mutates the bundle's city row). */
export function settle(ctx: Ctx, b: CityBundle): SettleResult {
  const r = settleCity(b.city, economyContext(b), ctx.now);
  if (Object.keys(r.deserted).length) {
    ctx.push(b.player.id, 'server.TroopUpdate', { castleId: b.city.id, troop: b.city.troops });
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
  if (city.playerId !== playerId) throw new GameError('Invalid castle.', -99, 403);
  const b = await loadBundle(ctx, city, player);
  settle(ctx, b);
  return b;
}

/** Lock a city and its current owner (used by timed events, which do not know the owner). */
export async function openCity(ctx: Ctx, cityId: number): Promise<CityBundle | null> {
  for (let i = 0; i < 3; i++) {
    const peek = await findCity(ctx, cityId);
    if (!peek) return null;
    const player = await getPlayer(ctx, peek.playerId, { lock: true });
    const city = await getCity(ctx, cityId, { lock: true });
    if (city.playerId !== player.id) continue; // ownership changed while we waited
    const b = await loadBundle(ctx, city, player);
    settle(ctx, b);
    return b;
  }
  return null;
}

/** Read-only view of a city settled in memory (no locks, nothing written). */
export async function viewCity(ctx: Ctx, cityId: number, player?: PlayerRow): Promise<CityBundle> {
  const city = await getCity(ctx, cityId);
  const owner = player && player.id === city.playerId ? player : await getPlayer(ctx, city.playerId);
  const b = await loadBundle(ctx, city, owner);
  settleCity(b.city, economyContext(b), ctx.now);
  return b;
}
