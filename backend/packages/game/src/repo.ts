// Row access helpers. "lock" variants take a row lock (SELECT ... FOR UPDATE) that is held
// until the transaction ends. Lock order, to avoid deadlocks: players (by id), then cities
// (by id), then tiles, then heroes/armies.

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { GameError, HeroStatus, lordGear, syncHeroBuffs, syncHeroGear, type LordGear } from '@marchlands/core';
import { armies, cities, heroes, players, tiles } from '@marchlands/db';
import type { Ctx } from './context.ts';

export type PlayerRow = typeof players.$inferSelect;
export type CityRow = typeof cities.$inferSelect;
export type HeroRow = typeof heroes.$inferSelect;
export type ArmyRow = typeof armies.$inferSelect;
export type TileRow = typeof tiles.$inferSelect;

interface Opts {
  lock?: boolean;
}

// ---- players ----

export async function findPlayer(ctx: Ctx, id: number, opts: Opts = {}): Promise<PlayerRow | undefined> {
  const q = ctx.tx.select().from(players).where(eq(players.id, id));
  const [row] = opts.lock ? await q.for('update') : await q;
  return row;
}
export async function getPlayer(ctx: Ctx, id: number, opts: Opts = {}): Promise<PlayerRow> {
  const row = await findPlayer(ctx, id, opts);
  if (!row) throw new GameError('Player not found.', -41, 404);
  return row;
}
export async function findPlayerByName(ctx: Ctx, name: string): Promise<PlayerRow | undefined> {
  const [row] = await ctx.tx
    .select()
    .from(players)
    .where(sql`lower(${players.name}) = lower(${name})`);
  return row;
}
/** Lock several players in id order (deadlock-safe). */
export async function lockPlayers(ctx: Ctx, ids: number[]): Promise<Map<number, PlayerRow>> {
  const unique = [...new Set(ids.filter((x) => x > 0))].sort((a, b) => a - b);
  const out = new Map<number, PlayerRow>();
  for (const id of unique) {
    const row = await findPlayer(ctx, id, { lock: true });
    if (row) out.set(id, row);
  }
  return out;
}
export async function savePlayer(ctx: Ctx, p: PlayerRow): Promise<void> {
  const { id, accountId: _a, createdAt: _c, ...rest } = p;
  await ctx.tx.update(players).set(rest).where(eq(players.id, id));
}

// ---- cities ----

export async function findCity(ctx: Ctx, id: number, opts: Opts = {}): Promise<CityRow | undefined> {
  const q = ctx.tx.select().from(cities).where(eq(cities.id, id));
  const [row] = opts.lock ? await q.for('update') : await q;
  return row;
}
export async function getCity(ctx: Ctx, id: number, opts: Opts = {}): Promise<CityRow> {
  const row = await findCity(ctx, id, opts);
  if (!row) throw new GameError('City not found.', -99, 404);
  return row;
}
export async function citiesOf(ctx: Ctx, playerId: number, opts: Opts = {}): Promise<CityRow[]> {
  const q = ctx.tx.select().from(cities).where(eq(cities.playerId, playerId)).orderBy(asc(cities.id));
  return opts.lock ? await q.for('update') : await q;
}
export async function saveCity(ctx: Ctx, c: CityRow): Promise<void> {
  const { id, createdAt: _c, ...rest } = c;
  await ctx.tx.update(cities).set(rest).where(eq(cities.id, id));
}

// ---- heroes ----

/** The lord's order of a city's heroes (sort_order; heroes never placed come after, oldest first). */
const byHeroOrder = (a: HeroRow, b: HeroRow) => (a.sortOrder || 1e9) - (b.sortOrder || 1e9) || a.id - b.id;

// rows are read (and locked) in id order, then sorted into the lord's order
export async function heroesOfCity(ctx: Ctx, cityId: number, opts: Opts & { tavern?: boolean } = {}): Promise<HeroRow[]> {
  const q = ctx.tx
    .select()
    .from(heroes)
    .where(and(eq(heroes.cityId, cityId), eq(heroes.inTavern, opts.tavern ?? false)))
    .orderBy(asc(heroes.id));
  return (opts.lock ? await q.for('update') : await q).sort(byHeroOrder);
}
export async function heroesOfCities(ctx: Ctx, cityIds: number[]): Promise<HeroRow[]> {
  if (!cityIds.length) return [];
  const rows = await ctx.tx
    .select()
    .from(heroes)
    .where(and(inArray(heroes.cityId, cityIds), eq(heroes.inTavern, false)))
    .orderBy(asc(heroes.id));
  return rows.sort(byHeroOrder);
}
export async function getHero(ctx: Ctx, id: number, opts: Opts = {}): Promise<HeroRow> {
  const q = ctx.tx.select().from(heroes).where(eq(heroes.id, id));
  const [row] = opts.lock ? await q.for('update') : await q;
  if (!row) throw new GameError('Hero does not exist!', -99, 404);
  return row;
}
/** The gear a hero wears: its lord's (gear.ts); none in a tavern or while held captive. */
export async function gearOfHero(ctx: Ctx, h: Pick<HeroRow, 'playerId' | 'inTavern' | 'status'>): Promise<LordGear | null> {
  if (h.playerId == null || h.inTavern || h.status === HeroStatus.SEIZED) return null;
  const [p] = await ctx.tx.select({ research: players.research, misc: players.misc }).from(players).where(eq(players.id, h.playerId));
  return p ? lordGear(p) : null;
}

export async function saveHero(ctx: Ctx, h: HeroRow): Promise<void> {
  // gear follows the lord's research and stars and the hero's level; attribute boosts follow the
  // hero's current attributes (level ups, assigned points, gear)
  syncHeroGear(h, await gearOfHero(ctx, h));
  syncHeroBuffs(h);
  const { id, createdAt: _c, ...rest } = h;
  await ctx.tx.update(heroes).set(rest).where(eq(heroes.id, id));
}

// ---- tiles ----

export async function getTile(ctx: Ctx, id: number, opts: Opts = {}): Promise<TileRow> {
  const q = ctx.tx.select().from(tiles).where(eq(tiles.id, id));
  const [row] = opts.lock ? await q.for('update') : await q;
  if (!row) throw new GameError('Invalid map coordinates.', -99, 404);
  return row;
}
export async function saveTile(ctx: Ctx, t: TileRow): Promise<void> {
  const { id, ...rest } = t;
  await ctx.tx.update(tiles).set(rest).where(eq(tiles.id, id));
}
export async function valleysOfCity(ctx: Ctx, cityId: number): Promise<TileRow[]> {
  return ctx.tx.select().from(tiles).where(eq(tiles.ownerCityId, cityId)).orderBy(asc(tiles.id));
}

// ---- armies ----

export async function getArmy(ctx: Ctx, id: number, opts: Opts = {}): Promise<ArmyRow | undefined> {
  const q = ctx.tx.select().from(armies).where(eq(armies.id, id));
  const [row] = opts.lock ? await q.for('update') : await q;
  return row;
}
export async function saveArmy(ctx: Ctx, a: ArmyRow): Promise<void> {
  const { id, createdAt: _c, ...rest } = a;
  await ctx.tx.update(armies).set(rest).where(eq(armies.id, id));
}
export async function armiesOfCity(ctx: Ctx, cityId: number): Promise<ArmyRow[]> {
  return ctx.tx.select().from(armies).where(eq(armies.cityId, cityId)).orderBy(asc(armies.id));
}
export async function armiesOfPlayer(ctx: Ctx, playerId: number): Promise<ArmyRow[]> {
  return ctx.tx.select().from(armies).where(eq(armies.playerId, playerId)).orderBy(asc(armies.id));
}
/** Armies camped (direction STAY) on a tile. */
export async function armiesStationedAt(ctx: Ctx, tileId: number, opts: Opts = {}): Promise<ArmyRow[]> {
  const q = ctx.tx
    .select()
    .from(armies)
    .where(and(eq(armies.targetTileId, tileId), eq(armies.direction, 3)))
    .orderBy(asc(armies.id));
  return opts.lock ? await q.for('update') : await q;
}
