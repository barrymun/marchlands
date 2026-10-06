// army.* — sending, recalling and listing armies. Arrival handling lives in combat.ts.

import { and, count, eq, ne, or } from 'drizzle-orm';
import {
  ArmyDirection,
  BALANCE,
  BuildingType,
  buildingLevel,
  GameError,
  hasTroops,
  HeroStatus,
  marchTimeMs,
  maxArmies,
  maxArmyTroops,
  totalTroops,
  maxCitiesFor,
  Mission,
  armyLoad,
  reliefMultiplier,
  researchLevel,
  sanitizeTroops,
  TechType,
  TILE_NAMES,
  TileType,
  tileXY,
  totalResources,
  addTroops,
  type ResourceSet,
  type TroopCounts,
} from '@evony/core';
import { armies, cities, heroes, players } from '@evony/db';
import { openOwnCity, viewCity, type CityBundle } from '../city.ts';
import type { Ctx } from '../context.ts';
import { armyBean, troopBean } from '../dto.ts';
import { activeBuff, pushResources, spendResources } from '../helpers.ts';
import { findCity, getArmy, getCity, getPlayer, getTile, saveArmy, saveCity, saveHero, type ArmyRow, type TileRow } from '../repo.ts';
import { isFriendly, relationBetween } from './relations.ts';
import { isProtected } from './player.ts';
import { pushHero } from './heroes.ts';

export const armyRef = (id: number) => `army:${id}`;

export function posName(name: string, tileId: number) {
  const { x, y } = tileXY(tileId);
  return `${name} (${x},${y})`;
}

export async function tileDisplayName(ctx: Ctx, t: TileRow): Promise<string> {
  if (t.cityId != null) {
    const c = await findCity(ctx, t.cityId);
    return posName(c?.name ?? 'City', t.id);
  }
  return posName(`${TILE_NAMES[t.type] ?? 'Land'}${t.type !== TileType.FLAT ? ` Lv.${t.level}` : ''}`, t.id);
}

/** Owner player of whatever stands on a tile (city or occupied valley). */
export async function tileOwner(ctx: Ctx, t: TileRow): Promise<number | null> {
  if (t.cityId != null) return (await findCity(ctx, t.cityId))?.playerId ?? null;
  return t.ownerPlayerId ?? null;
}

export interface SendArmyInput {
  targetTileId: number;
  mission: number;
  troops: Record<string, unknown>;
  resources?: Partial<ResourceSet>;
  heroId?: number | null;
  /** seconds to camp (reinforcing a valley or ally) before coming home; 0 = until recalled */
  restTime?: number;
}

function cleanResources(r: Partial<ResourceSet> | undefined): ResourceSet {
  const out: ResourceSet = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  for (const k of Object.keys(out) as (keyof ResourceSet)[]) {
    const v = Number(r?.[k] ?? 0);
    if (!Number.isFinite(v) || v < 0) throw new GameError('Invalid resource amount.', -99);
    out[k] = Math.floor(v);
  }
  return out;
}

/** March duration, including the Relief Station bonus between a lord's own cities. */
export function armyMarchMs(b: CityBundle, fromTile: number, toTile: number, troops: TroopCounts, ownTarget: boolean) {
  const ms = marchTimeMs(fromTile, toTile, troops, b.player.research, b.city.buildings);
  return ownTarget ? Math.max(1000, Math.floor(ms / reliefMultiplier(b.city.buildings))) : ms;
}

/** army.newArmy */
export async function sendArmy(ctx: Ctx, playerId: number, cityId: number, input: SendArmyInput) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const mission = input.mission;
  if (![1, 2, 3, 4, 5].includes(mission)) throw new GameError('Invalid mission.', -99);
  const troops = sanitizeTroops(input.troops);
  const resources = cleanResources(input.resources);
  if (!hasTroops(b.city.troops, troops)) throw new GameError('You have insufficient troops.', -29);
  if (totalResources(resources) > armyLoad(troops, b.player.research)) throw new GameError('Your troops cannot carry that much.', -99);
  if (buildingLevel(b.city.buildings, BuildingType.RALLY_SPOT) < 1) throw new GameError('You need a Rally Spot to send troops.', -51);
  const [{ n: out }] = await ctx.tx.select({ n: count() }).from(armies).where(eq(armies.cityId, cityId));
  if (Number(out) >= maxArmies(b.city.buildings)) {
    throw new GameError('No more troops are allowed to sent at current level of Rally Spot. Please upgrade the Rally Spot first.', -51);
  }
  const troopCap = maxArmyTroops(b.city.buildings, !!activeBuff(b.player, 'WarEnsignBuff', ctx.now));
  if (totalTroops(troops) > troopCap) {
    const level = buildingLevel(b.city.buildings, BuildingType.RALLY_SPOT);
    throw new GameError(`A level ${level} Rally Spot sends at most ${troopCap.toLocaleString('en')} troops in one army.`, -51);
  }
  const target = await getTile(ctx, input.targetTileId);
  if (target.id === b.city.tileId) throw new GameError("You can't perform this operation against this target.", -13);
  const ownerId = await tileOwner(ctx, target);
  const relation = ownerId ? await relationBetween(ctx, playerId, ownerId) : null;
  const ownTarget = ownerId === playerId;

  switch (mission) {
    case Mission.TRANSPORT:
      if (target.cityId == null || relation == null || !isFriendly(relation)) throw new GameError('You can only transport to your own or allied cities.', -13);
      if (totalResources(resources) <= 0) throw new GameError('Choose resources to transport.', -99);
      break;
    case Mission.REINFORCE: {
      const toValley = target.cityId == null && target.ownerCityId != null;
      if (relation == null || !isFriendly(relation) || (toValley && !ownTarget)) throw new GameError('You can only reinforce your own or allied cities.', -13);
      if (target.cityId != null && !ownTarget) {
        const host = await getCity(ctx, target.cityId);
        if (!host.allowAlliance) throw new GameError('This city does not accept allied troops.', -13);
      }
      break;
    }
    case Mission.SCOUT:
    case Mission.ATTACK: {
      if (mission === Mission.SCOUT && (troops.scouter ?? 0) <= 0) throw new GameError('Scouts are required for this mission.', -61);
      if (relation != null && isFriendly(relation)) throw new GameError("You can't perform this operation against this target.", -13);
      if (target.cityId != null && b.player.beginner) {
        throw new GameError("Beginner's Protection will automatically expired 7 days after registration or Town Hall reaches level 5.", -69);
      }
      if (ownerId && target.cityId != null) {
        const owner = await getPlayer(ctx, ownerId);
        const why = isProtected(owner, ctx.now);
        if (why) throw new GameError(why, -70);
      }
      if (activeBuff(b.player, 'PlayerPeaceBuff', ctx.now)) throw new GameError('You cannot attack while under truce.', -70);
      if (target.type === TileType.FLAT && target.cityId == null) throw new GameError('There is nothing to attack there.', -13);
      break;
    }
    case Mission.BUILD_CITY: {
      if (target.type !== TileType.FLAT || target.cityId != null || target.ownerCityId != null) throw new GameError('You can only build a city on an empty flat.', -13);
      const [{ n: cityCount }] = await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, playerId));
      const [{ n: pending }] = await ctx.tx
        .select({ n: count() })
        .from(armies)
        .where(and(eq(armies.playerId, playerId), eq(armies.mission, Mission.BUILD_CITY), eq(armies.direction, ArmyDirection.FORWARD)));
      if (Number(cityCount) + Number(pending) >= maxCitiesFor(b.player.title)) throw new GameError('Your title does not allow more cities.', -99);
      const need = { food: 10_000, wood: 10_000, stone: 10_000, iron: 10_000 };
      for (const [k, v] of Object.entries(need)) if (resources[k as keyof ResourceSet] < v) throw new GameError('A new city needs at least 10,000 food, lumber, stone and iron.', -99);
      break;
    }
  }

  let hero = null;
  if (input.heroId != null && input.heroId >= 0) {
    hero = b.heroes.find((h) => h.id === input.heroId && h.playerId === playerId);
    if (!hero) throw new GameError('Hero does not exist.', -80);
    if (hero.status !== HeroStatus.IDLE) throw new GameError('Status of this hero is not Idle.', -80);
  } else if (mission === Mission.ATTACK) throw new GameError('You must appoint a hero to lead the attack.', -71);
  if (mission === Mission.BUILD_CITY && !hero) throw new GameError('A hero must lead the settlers to the new city.', -71);

  spendResources(b.city, resources, 'Not enough resources.', -1);
  b.city.troops = addTroops(b.city.troops, troops, -1);
  const ms = armyMarchMs(b, b.city.tileId, target.id, troops, ownTarget);
  const restTime = Math.min(BALANCE.maxRestTimeMs, Math.max(0, Math.floor(Number(input.restTime ?? 0)) * 1000));
  const [army] = await ctx.tx
    .insert(armies)
    .values({
      playerId,
      cityId,
      heroId: hero?.id ?? null,
      mission,
      direction: ArmyDirection.FORWARD,
      startTileId: b.city.tileId,
      targetTileId: target.id,
      targetPlayerId: ownerId,
      troops,
      resources,
      startTime: ctx.now,
      reachTime: ctx.now + ms,
      restTime,
      startPosName: posName(b.city.name, b.city.tileId),
      targetPosName: await tileDisplayName(ctx, target),
      createdAt: ctx.now,
    })
    .returning();
  if (hero) {
    hero.status = HeroStatus.ATTACK;
    await saveHero(ctx, hero);
    pushHero(ctx, playerId, hero, 2);
  }
  ctx.schedule({ type: 'army', dueAt: army.reachTime, playerId, cityId, refKey: armyRef(army.id), payload: { armyId: army.id } });
  await saveCity(ctx, b.city);
  ctx.push(playerId, 'server.TroopUpdate', { castleId: cityId, troop: troopBean(b.city.troops) });
  pushResources(ctx, b);
  await notifyArmyParties(ctx, army);
  return armyBean(army, { heroName: hero?.name, heroLevel: hero?.level, king: b.player.name });
}

/** Push fresh army lists to everyone involved with an army. */
export async function notifyArmyParties(ctx: Ctx, a: Pick<ArmyRow, 'playerId' | 'targetPlayerId'>) {
  for (const id of new Set([a.playerId, a.targetPlayerId].filter((x): x is number => !!x))) {
    const v = await visibleArmies(ctx, id);
    ctx.push(id, 'server.SelfArmysUpdate', { armys: v.self });
    ctx.push(id, 'server.FriendArmysUpdate', { armys: v.friend });
    ctx.push(id, 'server.EnemyArmysUpdate', { armys: v.enemy });
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

/** Return march time from wherever the army is to its home city. */
export async function homeMarchMs(ctx: Ctx, a: ArmyRow, fromTile: number): Promise<number> {
  const home = await findCity(ctx, a.cityId);
  if (!home) return 1000;
  const p = await getPlayer(ctx, a.playerId);
  return marchTimeMs(fromTile, home.tileId, a.troops, p.research, home.buildings);
}

/** army.callBackArmy: marching armies turn around, stationed armies start home. */
export async function recallArmy(ctx: Ctx, playerId: number, armyId: number) {
  const a = await getArmy(ctx, armyId, { lock: true });
  if (!a || a.playerId !== playerId) throw new GameError('Army not found.', -99, 404);
  if (a.direction === ArmyDirection.BACKWARD) throw new GameError('The army is already returning.', -99);
  // marching armies walk back the way they came; stationed ones march home from the target
  const ms = a.direction === ArmyDirection.FORWARD ? ctx.now - a.startTime : await homeMarchMs(ctx, a, a.targetTileId);
  await sendBack(ctx, a, ms);
  await notifyArmyParties(ctx, a);
  return armyBean(a);
}

/** A host sends allied troops stationed in their city back home. */
export async function dismissGuest(ctx: Ctx, hostId: number, armyId: number) {
  const a = await getArmy(ctx, armyId, { lock: true });
  if (!a || a.direction !== ArmyDirection.STAY || a.targetPlayerId !== hostId || a.playerId === hostId) throw new GameError('Army not found.', -99, 404);
  await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
  await notifyArmyParties(ctx, a);
}

/** army.getTroopParam */
export async function troopParams(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError('Invalid castle.', -99, 403);
  const r = b.player.research;
  return {
    marchSkillParam: researchLevel(r, TechType.COMPASS) * 10,
    loadSkillParam: researchLevel(r, TechType.LOGISTICS) * 10,
    driveSkillParam: researchLevel(r, TechType.HORSEBACK_RIDING) * 5,
    transportStationParam: reliefMultiplier(b.city.buildings),
    maxArmies: maxArmies(b.city.buildings),
    maxTroops: maxArmyTroops(b.city.buildings, !!activeBuff(b.player, 'WarEnsignBuff', ctx.now)),
  };
}

/** March time / load preview for the send-army dialog. */
export async function marchEstimate(ctx: Ctx, playerId: number, cityId: number, targetTileId: number, troopsIn: Record<string, unknown>) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError('Invalid castle.', -99, 403);
  const troops = sanitizeTroops(troopsIn);
  const target = await getTile(ctx, targetTileId);
  const own = (await tileOwner(ctx, target)) === playerId;
  return { marchTime: armyMarchMs(b, b.city.tileId, targetTileId, troops, own), load: armyLoad(troops, b.player.research) };
}

// ---------------------------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------------------------

/**
 * self: my armies; friend: other lords' armies stationed at or reinforcing/transporting to me;
 * enemy: hostile armies heading for me (troop details need a Beacon Tower).
 */
export async function visibleArmies(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx
    .select({ a: armies, heroName: heroes.name, heroLevel: heroes.level, king: players.name })
    .from(armies)
    .leftJoin(heroes, eq(heroes.id, armies.heroId))
    .innerJoin(players, eq(players.id, armies.playerId))
    .where(or(eq(armies.playerId, playerId), eq(armies.targetPlayerId, playerId)));
  const myCities = await ctx.tx.select({ id: cities.id, buildings: cities.buildings }).from(cities).where(eq(cities.playerId, playerId));
  const beacon = Math.max(0, ...myCities.map((c) => buildingLevel(c.buildings, BuildingType.BEACON_TOWER)));
  const self = [];
  const friend = [];
  const enemy = [];
  for (const { a, heroName, heroLevel, king } of rows) {
    const extra = { heroName: heroName ?? undefined, heroLevel: heroLevel ?? undefined, king };
    if (a.playerId === playerId) self.push(armyBean(a, extra));
    else if ((a.mission === Mission.ATTACK || a.mission === Mission.SCOUT) && a.direction === ArmyDirection.FORWARD) {
      enemy.push(armyBean(a, { ...extra, visible: beacon > 0, heroName: beacon > 1 ? extra.heroName : '' }));
    } else if (a.direction !== ArmyDirection.BACKWARD) friend.push(armyBean(a, extra));
  }
  return { self, friend, enemy };
}

/** army.getStayAllianceArmys: foreign troops stationed in one of my cities. */
export async function stationedIn(ctx: Ctx, playerId: number, cityId: number) {
  const c = await getCity(ctx, cityId);
  if (c.playerId !== playerId) throw new GameError('Invalid castle.', -99, 403);
  const rows = await ctx.tx
    .select({ a: armies, heroName: heroes.name, heroLevel: heroes.level, king: players.name })
    .from(armies)
    .leftJoin(heroes, eq(heroes.id, armies.heroId))
    .innerJoin(players, eq(players.id, armies.playerId))
    .where(and(eq(armies.targetTileId, c.tileId), eq(armies.direction, ArmyDirection.STAY), ne(armies.playerId, playerId)));
  return rows.map(({ a, heroName, heroLevel, king }) => armyBean(a, { heroName: heroName ?? undefined, heroLevel: heroLevel ?? undefined, king }));
}

