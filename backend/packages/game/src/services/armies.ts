// army.* — sending, recalling and listing armies. Arrival handling lives in engine/combat.ts.

import { and, count, eq, ne } from 'drizzle-orm';

import { PushCmd, type SendArmyBody } from '@marchlands/contracts';
import {
  addTroops,
  ArmyDirection,
  armyLoad,
  BALANCE,
  BASIC_RESOURCES,
  BuffId,
  buildingLevel,
  BuildingType,
  DAY,
  GameError,
  hasTroops,
  HeroStatus,
  marchTimeMs,
  maxArmies,
  maxArmyTroops,
  maxCitiesFor,
  Mission,
  msg,
  ref,
  reliefMultiplier,
  researchLevel,
  type ResourceSet,
  sanitizeTroops,
  TechType,
  TileType,
  totalResources,
  totalTroops,
  type TroopCounts,
  TroopType,
} from '@marchlands/core';
import { armies, cities, heroes, one, players } from '@marchlands/db';

import { type CityBundle, openOwnCity, viewCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { armyBean, troopBean } from '#/dto.ts';
import { armyRef, cityPosition, homeMarchMs, notifyArmyParties, sendBack, tileOwner, tilePosition } from '#/engine/armies.ts';
import { pushHero } from '#/engine/heroes.ts';
import { isProtected } from '#/engine/player.ts';
import { isFriendly, relationBetween } from '#/engine/relations.ts';
import { activeBuff, pushResources, spendResources } from '#/helpers.ts';
import { getArmy, getCity, getPlayer, getTile, saveCity, saveHero } from '#/repo.ts';

export { visibleArmies } from '#/engine/armies.ts';

function cleanResources(r: Partial<ResourceSet> | undefined): ResourceSet {
  const out: ResourceSet = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  for (const k of Object.keys(out) as (keyof ResourceSet)[]) {
    const v = Number(r?.[k] ?? 0);
    if (!Number.isFinite(v) || v < 0) throw new GameError(msg('common.invalidAmount'), -99);
    out[k] = Math.floor(v);
  }
  return out;
}

/** March duration, including the Relief Station bonus between a lord's own cities. */
function armyMarchMs(b: CityBundle, fromTile: number, toTile: number, troops: TroopCounts, ownTarget: boolean) {
  const ms = marchTimeMs(fromTile, toTile, troops, b.player.research, b.city.buildings);
  return ownTarget ? Math.max(1000, Math.floor(ms / reliefMultiplier(b.city.buildings))) : ms;
}

/** army.newArmy */
export async function sendArmy(ctx: Ctx, playerId: number, cityId: number, input: SendArmyBody) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const mission = input.mission;
  if (![1, 2, 3, 4, 5].includes(mission)) throw new GameError(msg('army.invalidMission'), -99);
  const troops = sanitizeTroops(input.troops);
  const resources = cleanResources(input.resources);
  if (!hasTroops(b.city.troops, troops)) throw new GameError(msg('army.insufficientTroops'), -29);
  if (totalResources(resources) > armyLoad(troops, b.player.research)) throw new GameError(msg('army.overloaded'), -99);
  if (buildingLevel(b.city.buildings, BuildingType.RALLY_SPOT) < 1)
    throw new GameError(msg('army.rallySpotRequired', { building: ref.building(BuildingType.RALLY_SPOT) }), -51);
  const { n: out } = one(await ctx.tx.select({ n: count() }).from(armies).where(eq(armies.cityId, cityId)));
  const armyCap = maxArmies(b.city.buildings);
  if (Number(out) >= armyCap) throw new GameError(msg('army.armyLimit', { building: ref.building(BuildingType.RALLY_SPOT), count: armyCap }), -51);
  const troopCap = maxArmyTroops(b.city.buildings, !!activeBuff(b.player, BuffId.WAR_ENSIGN, ctx.now));
  if (totalTroops(troops) > troopCap) {
    const level = buildingLevel(b.city.buildings, BuildingType.RALLY_SPOT);
    throw new GameError(msg('army.troopLimit', { building: ref.building(BuildingType.RALLY_SPOT), level, count: troopCap }), -51);
  }
  const target = await getTile(ctx, input.targetTileId);
  if (target.id === b.city.tileId) throw new GameError(msg('army.invalidTarget'), -13);
  const ownerId = await tileOwner(ctx, target);
  const relation = ownerId ? await relationBetween(ctx, playerId, ownerId) : null;
  const ownTarget = ownerId === playerId;

  switch (mission) {
    case Mission.TRANSPORT:
      if (target.cityId == null || relation == null || !isFriendly(relation)) throw new GameError(msg('army.transportTarget'), -13);
      if (totalResources(resources) <= 0) throw new GameError(msg('army.noResources'), -99);
      break;
    case Mission.REINFORCE: {
      const toValley = target.cityId == null && target.ownerCityId != null;
      if (relation == null || !isFriendly(relation) || (toValley && !ownTarget)) throw new GameError(msg('army.reinforceTarget'), -13);
      if (target.cityId != null && !ownTarget) {
        const host = await getCity(ctx, target.cityId);
        if (!host.allowAlliance) throw new GameError(msg('army.alliedTroopsRefused'), -13);
      }
      break;
    }
    case Mission.SCOUT:
    case Mission.ATTACK: {
      if (mission === Mission.SCOUT && (troops.scouter ?? 0) <= 0) throw new GameError(msg('army.scoutsRequired', { troop: ref.troop(TroopType.SCOUT) }), -61);
      if (relation != null && isFriendly(relation)) throw new GameError(msg('army.invalidTarget'), -13);
      if (target.cityId != null && b.player.beginner) {
        throw new GameError(
          msg('army.beginnerProtection', {
            count: Math.round(BALANCE.beginnerProtectionMs / DAY),
            building: ref.building(BuildingType.TOWN_HALL),
            level: BALANCE.beginnerTownHallLevel,
          }),
          -69,
        );
      }
      if (ownerId && target.cityId != null) {
        const owner = await getPlayer(ctx, ownerId);
        const why = isProtected(owner, ctx.now);
        if (why) throw new GameError(why, -70);
      }
      if (activeBuff(b.player, BuffId.TRUCE, ctx.now)) throw new GameError(msg('army.truce'), -70);
      if (target.type === TileType.FLAT && target.cityId == null) throw new GameError(msg('army.nothingToAttack'), -13);
      break;
    }
    case Mission.BUILD_CITY: {
      if (target.type !== TileType.FLAT || target.cityId != null || target.ownerCityId != null) throw new GameError(msg('army.buildOnFlat'), -13);
      const { n: cityCount } = one(await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, playerId)));
      const { n: pending } = one(
        await ctx.tx
          .select({ n: count() })
          .from(armies)
          .where(and(eq(armies.playerId, playerId), eq(armies.mission, Mission.BUILD_CITY), eq(armies.direction, ArmyDirection.FORWARD))),
      );
      if (Number(cityCount) + Number(pending) >= maxCitiesFor(b.player.title)) throw new GameError(msg('army.cityLimit'), -99);
      if (BASIC_RESOURCES.some((k) => resources[k] < BALANCE.newCityMinResource))
        throw new GameError(msg('army.newCityResources', { amount: BALANCE.newCityMinResource, resources: BASIC_RESOURCES.map((k) => ref.resource(k)) }), -99);
      break;
    }
  }

  let hero = null;
  if (input.heroId != null && input.heroId >= 0) {
    hero = b.heroes.find((h) => h.id === input.heroId && h.playerId === playerId);
    if (!hero) throw new GameError(msg('common.heroNotFound'), -80);
    if (hero.status !== HeroStatus.IDLE) throw new GameError(msg('hero.notIdle'), -80);
  } else if (mission === Mission.ATTACK) throw new GameError(msg('army.heroRequiredAttack'), -71);
  if (mission === Mission.BUILD_CITY && !hero) throw new GameError(msg('army.heroRequiredSettlers'), -71);

  spendResources(b.city, resources, msg('common.notEnoughResources'), -1);
  b.city.troops = addTroops(b.city.troops, troops, -1);
  const ms = armyMarchMs(b, b.city.tileId, target.id, troops, ownTarget);
  const restTime = Math.min(BALANCE.maxRestTimeMs, Math.max(0, Math.floor(Number(input.restTime ?? 0)) * 1000));
  const army = one(
    await ctx.tx
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
        startPosName: cityPosition(b.city.name, b.city.tileId),
        targetPosName: await tilePosition(ctx, target),
        createdAt: ctx.now,
      })
      .returning(),
  );
  if (hero) {
    hero.status = HeroStatus.ATTACK;
    await saveHero(ctx, hero);
    pushHero(ctx, playerId, hero, 2);
  }
  ctx.schedule({ type: 'army', dueAt: army.reachTime, playerId, cityId, refKey: armyRef(army.id), payload: { armyId: army.id } });
  await saveCity(ctx, b.city);
  ctx.push(playerId, PushCmd.TROOP_UPDATE, { castleId: cityId, troop: troopBean(b.city.troops) });
  pushResources(ctx, b);
  await notifyArmyParties(ctx, army);
  return armyBean(army, { heroName: hero?.name, heroLevel: hero?.level, king: b.player.name });
}

/** army.callBackArmy: marching armies turn around, stationed armies start home. */
export async function recallArmy(ctx: Ctx, playerId: number, armyId: number) {
  const a = await getArmy(ctx, armyId, { lock: true });
  if (!a || a.playerId !== playerId) throw new GameError(msg('army.notFound'), -99, 404);
  if (a.direction === ArmyDirection.BACKWARD) throw new GameError(msg('army.alreadyReturning'), -99);
  // marching armies walk back the way they came; stationed ones march home from the target
  const ms = a.direction === ArmyDirection.FORWARD ? ctx.now - a.startTime : await homeMarchMs(ctx, a, a.targetTileId);
  await sendBack(ctx, a, ms);
  await notifyArmyParties(ctx, a);
  return armyBean(a);
}

/** A host sends allied troops stationed in their city back home. */
export async function dismissGuest(ctx: Ctx, hostId: number, armyId: number) {
  const a = await getArmy(ctx, armyId, { lock: true });
  if (!a || a.direction !== ArmyDirection.STAY || a.targetPlayerId !== hostId || a.playerId === hostId) throw new GameError(msg('army.notFound'), -99, 404);
  await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
  await notifyArmyParties(ctx, a);
}

/** army.getTroopParam */
export async function troopParams(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  const r = b.player.research;
  return {
    marchSkillParam: researchLevel(r, TechType.COMPASS) * BALANCE.compassSpeedPerLevel,
    loadSkillParam: researchLevel(r, TechType.LOGISTICS) * BALANCE.logisticsLoadPerLevel,
    driveSkillParam: researchLevel(r, TechType.HORSEBACK_RIDING) * BALANCE.horsebackSpeedPerLevel,
    transportStationParam: reliefMultiplier(b.city.buildings),
    maxArmies: maxArmies(b.city.buildings),
    maxTroops: maxArmyTroops(b.city.buildings, !!activeBuff(b.player, BuffId.WAR_ENSIGN, ctx.now)),
  };
}

/** March time / load preview for the send-army dialog. */
export async function marchEstimate(ctx: Ctx, playerId: number, cityId: number, targetTileId: number, troopsIn: Record<string, unknown>) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  const troops = sanitizeTroops(troopsIn);
  const target = await getTile(ctx, targetTileId);
  const own = (await tileOwner(ctx, target)) === playerId;
  return { marchTime: armyMarchMs(b, b.city.tileId, targetTileId, troops, own), load: armyLoad(troops, b.player.research) };
}

/** army.getStayAllianceArmys: foreign troops stationed in one of my cities. */
export async function stationedIn(ctx: Ctx, playerId: number, cityId: number) {
  const c = await getCity(ctx, cityId);
  if (c.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  const rows = await ctx.tx
    .select({ a: armies, heroName: heroes.name, heroLevel: heroes.level, king: players.name })
    .from(armies)
    .leftJoin(heroes, eq(heroes.id, armies.heroId))
    .innerJoin(players, eq(players.id, armies.playerId))
    .where(and(eq(armies.targetTileId, c.tileId), eq(armies.direction, ArmyDirection.STAY), ne(armies.playerId, playerId)));
  return rows.map(({ a, heroName, heroLevel, king }) => armyBean(a, { heroName: heroName ?? undefined, heroLevel: heroLevel ?? undefined, king }));
}
