// Army helpers shared with combat and flows: event references, positions, notifying both sides,
// marching home and the armies a lord can see.

import { asc, eq, or } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  ArmyDirection,
  buildingLevel,
  BuildingType,
  HeroStatus,
  marchTimeMs,
  type Message,
  Mission,
  msg,
  ref,
  reliefMarchMs,
  TileType,
  tileXY,
} from '@marchlands/core';
import { armies, cities, heroes, players } from '@marchlands/db';

import { type Ctx } from '#/context.ts';
import { armyBean } from '#/dto.ts';
import { type ArmyRow, findCity, getArmy, getPlayer, getTile, saveArmy, type TileRow } from '#/repo.ts';

export const armyRef = (id: number) => `army:${id}`;
/** The timed event that sets off an army waiting to land at a chosen time (camp times). */
export const departRef = (id: number) => `army-depart:${id}`;

/** An army set to land at a chosen time that hasn't left its city yet: only its own player sees it. */
export const isWaiting = (a: Pick<ArmyRow, 'direction' | 'startTime'>, now: number) => a.direction === ArmyDirection.FORWARD && a.startTime > now;

/** Timed event "army.depart": a waiting army sets off, so its target sees it coming from now on. */
export async function departArmy(ctx: Ctx, armyId: number) {
  const a = await getArmy(ctx, armyId);
  if (a) await notifyArmyParties(ctx, a);
}

/** Where a city stands, as a message (army and report positions). */
export function cityPosition(name: string, tileId: number): Message {
  return msg('world.position.city', { name, ...tileXY(tileId) });
}

/** Where an army is headed, as a message: the city standing there, or the tile's type and level (flat land has none). */
export async function tilePosition(ctx: Ctx, t: TileRow): Promise<Message> {
  const { x, y } = tileXY(t.id);
  if (t.cityId != null) {
    const c = await findCity(ctx, t.cityId);
    if (c) return cityPosition(c.name, t.id);
  }
  const tile = ref.tile(t.cityId != null ? TileType.CASTLE : t.type);
  return t.type === TileType.FLAT || t.cityId != null
    ? msg('world.position.place', { tile, x, y })
    : msg('world.position.tile', { tile, level: t.level, x, y });
}

/** Owner player of whatever stands on a tile (city or occupied valley). */
export async function tileOwner(ctx: Ctx, t: TileRow): Promise<number | null> {
  if (t.cityId != null) return (await findCity(ctx, t.cityId))?.playerId ?? null;
  return t.ownerPlayerId ?? null;
}

/** Push fresh army lists to everyone involved with an army. */
export async function notifyArmyParties(ctx: Ctx, a: Pick<ArmyRow, 'playerId' | 'targetPlayerId'>) {
  for (const id of new Set([a.playerId, a.targetPlayerId].filter((x): x is number => !!x))) {
    const v = await visibleArmies(ctx, id);
    ctx.push(id, PushCmd.SELF_ARMIES_UPDATE, { armys: v.self });
    ctx.push(id, PushCmd.FRIEND_ARMIES_UPDATE, { armys: v.friend });
    ctx.push(id, PushCmd.ENEMY_ARMIES_UPDATE, { armys: v.enemy });
  }
}

/** Turn an army around towards its home city. */
export async function sendBack(ctx: Ctx, a: ArmyRow, marchMs: number) {
  a.direction = ArmyDirection.BACKWARD;
  a.startTime = ctx.now;
  a.reachTime = ctx.now + Math.max(1000, marchMs);
  a.restTime = 0;
  await saveArmy(ctx, a);
  if (a.heroId) await ctx.tx.update(heroes).set({ status: HeroStatus.RETURN }).where(eq(heroes.id, a.heroId));
  ctx.schedule({ type: 'army', dueAt: a.reachTime, playerId: a.playerId, cityId: a.cityId, refKey: armyRef(a.id), payload: { armyId: a.id } });
}

/**
 * Turn an army home as a recall does: one marching walks back the way it came (one still waiting at home to leave is
 * back at once, its departure cancelled), one stationed marches home from its target.
 */
export async function turnHome(ctx: Ctx, a: ArmyRow) {
  const ms = a.direction === ArmyDirection.FORWARD ? ctx.now - a.startTime : await homeMarchMs(ctx, a, a.targetTileId);
  if (isWaiting(a, ctx.now)) ctx.unschedule(departRef(a.id));
  await sendBack(ctx, a, ms);
}

/**
 * Return march time from wherever the army is to its home city. (marchlands) From one of the player's own places (a
 * city they hold, their valley) the home city's Relief Station speeds it, as it does the march out (docs/deviations.md).
 */
export async function homeMarchMs(ctx: Ctx, a: ArmyRow, fromTile: number): Promise<number> {
  const home = await findCity(ctx, a.cityId);
  if (!home) return 1000;
  const p = await getPlayer(ctx, a.playerId);
  const ms = marchTimeMs(fromTile, home.tileId, a.troops, p.research, home.buildings);
  const own = (await tileOwner(ctx, await getTile(ctx, fromTile))) === a.playerId;
  return own ? reliefMarchMs(ms, home.buildings) : ms;
}

// ---------------------------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------------------------

/**
 * self: my armies; friend: other lords' armies stationed at or reinforcing/transporting to me;
 * enemy: hostile armies heading for me (troop details need a Beacon Tower). Another lord's army still waiting at home
 * to land at a chosen time isn't seen until it sets off. Each list is in the order the armies land (or landed).
 */
export async function visibleArmies(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx
    .select({ a: armies, heroName: heroes.name, heroLevel: heroes.level, king: players.name })
    .from(armies)
    .leftJoin(heroes, eq(heroes.id, armies.heroId))
    .innerJoin(players, eq(players.id, armies.playerId))
    .where(or(eq(armies.playerId, playerId), eq(armies.targetPlayerId, playerId)))
    .orderBy(asc(armies.reachTime), asc(armies.id));
  const myCities = await ctx.tx.select({ id: cities.id, buildings: cities.buildings }).from(cities).where(eq(cities.playerId, playerId));
  const beacon = Math.max(0, ...myCities.map((c) => buildingLevel(c.buildings, BuildingType.BEACON_TOWER)));
  const self = [];
  const friend = [];
  const enemy = [];
  for (const { a, heroName, heroLevel, king } of rows) {
    const extra = { heroName: heroName ?? undefined, heroLevel: heroLevel ?? undefined, king };
    if (a.playerId === playerId) self.push(armyBean(a, extra));
    else if (isWaiting(a, ctx.now)) continue;
    else if ((a.mission === Mission.ATTACK || a.mission === Mission.SCOUT) && a.direction === ArmyDirection.FORWARD) {
      enemy.push(armyBean(a, { ...extra, visible: beacon > 0, heroName: beacon > 1 ? extra.heroName : '' }));
    } else if (a.direction !== ArmyDirection.BACKWARD) friend.push(armyBean(a, extra));
  }
  return { self, friend, enemy };
}
