// Army arrival: transport, reinforcement, scouting, colonising and attacking (player cities,
// barbarian cities and valleys), plus armies coming home. The original only implemented
// valley/NPC scouting and a scout-vs-scout fight; everything else follows Evony Age 1 and the
// recommendations in docs/spec/battle.md §7.3.

import { and, count, eq } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  addHeroExp,
  addTroops,
  ArmyDirection,
  armyLoad,
  attackStanding,
  BALANCE,
  type BattleExtra,
  BuffId,
  buildingLevel,
  BuildingType,
  type CombatResult,
  countsDiffer,
  createGuardHero,
  distributeLossesAmong,
  dur,
  type FortCounts,
  freshNpcState,
  HeroBuffId,
  heroPower,
  HeroStatus,
  HISTORIC_LEVELS,
  historicCityBuildings,
  historicGuard,
  type HistoricLevel,
  historicNameAt,
  historicResearch,
  historicState,
  type HistoricState,
  injuredOf,
  ItemId,
  maxArmyTroops,
  maxCitiesFor,
  maxValleysFor,
  type Message,
  Mission,
  msg,
  nextAutoDraftAt,
  nextRefillAt,
  npcBuildings,
  npcCityBuildings,
  type NpcState,
  plunder,
  protectedResources,
  randInt,
  ref,
  refillCounts,
  regenerateNpc,
  type ReportBody,
  ReportType,
  researchLevel,
  resolveCombat,
  type ResourceSet,
  rollMedalDrops,
  scaled,
  seatLoyalty,
  seatStanding,
  seededRng,
  type StandingChange,
  stateOf,
  TechType,
  TileType,
  tileXY,
  totalResources,
  totalTroops,
  type TroopCounts,
  valleyGarrison,
  WAR_ENSIGN_DESC,
} from '@marchlands/core';
import { armies, cities, heroes, marketOrders, marketShipments, one, tiles } from '@marchlands/db';

import { type CityBundle, openCity, viewCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { fortBean, heroBean, troopBean } from '#/dto.ts';
import { armyRef, cityPosition, homeMarchMs, notifyArmyParties, sendBack, tileOwner } from '#/engine/armies.ts';
import { dropCapturedTarget } from '#/engine/flows.ts';
import { heroSlots, pushHero } from '#/engine/heroes.ts';
import { plunderNpc } from '#/engine/npc-economy.ts';
import { initialCity, isProtected } from '#/engine/player.ts';
import { isFriendly, relationBetween } from '#/engine/relations.ts';
import { createReport } from '#/engine/reports.ts';
import { addStanding } from '#/engine/reputation.ts';
import { ruledZones } from '#/engine/seats.ts';
import { activeBuff, addItem, addPrestige, gainResources, pushCity, pushPlayerInfo, pushResources } from '#/helpers.ts';
import {
  armiesStationedAt,
  type ArmyRow,
  citiesOf,
  type CityRow,
  findCity,
  getArmy,
  getHero,
  getPlayer,
  getTile,
  type HeroRow,
  lockPlayers,
  type PlayerRow,
  saveArmy,
  saveCity,
  saveHero,
  savePlayer,
  saveTile,
  type TileRow,
} from '#/repo.ts';
import { prefixed } from '#/stats.ts';

// ---------------------------------------------------------------------------------------------
// Entry point (timed event "army")
// ---------------------------------------------------------------------------------------------

export async function processArmy(ctx: Ctx, armyId: number) {
  const peek = await getArmy(ctx, armyId);
  if (!peek) return;
  if (peek.direction === ArmyDirection.STAY) {
    // camping with a time limit: go home once it is over
    if (peek.restTime > 0 && ctx.now >= peek.reachTime + peek.restTime) {
      const a = await getArmy(ctx, armyId, { lock: true });
      if (!a) throw new Error(`army ${armyId} is gone`); // read just above (peek)
      await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
      await notifyArmyParties(ctx, a);
    }
    return;
  }
  if (peek.reachTime > ctx.now) {
    ctx.schedule({ type: 'army', dueAt: peek.reachTime, playerId: peek.playerId, refKey: armyRef(armyId), payload: { armyId } });
    return;
  }
  const target = await getTile(ctx, peek.targetTileId);
  const ownerId = peek.direction === ArmyDirection.FORWARD ? await tileOwner(ctx, target) : null;
  await lockPlayers(ctx, [peek.playerId, ownerId ?? 0]);
  const a = await getArmy(ctx, armyId, { lock: true });
  if (!a) return;
  if (a.direction === ArmyDirection.BACKWARD) return returnHome(ctx, a);

  const attacker = await getPlayer(ctx, a.playerId);
  switch (a.mission) {
    case Mission.TRANSPORT:
      return arriveTransport(ctx, a, attacker);
    case Mission.REINFORCE:
      return arriveReinforce(ctx, a, attacker);
    case Mission.SCOUT:
      return arriveScout(ctx, a, attacker);
    case Mission.BUILD_CITY:
      return arriveBuildCity(ctx, a, attacker);
    case Mission.ATTACK:
      return arriveAttack(ctx, a, attacker);
    default:
      return turnBack(ctx, a, msg('army.unknownMission'));
  }
}

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

async function deleteArmy(ctx: Ctx, a: ArmyRow) {
  await ctx.tx.delete(armies).where(eq(armies.id, a.id));
  ctx.unschedule(armyRef(a.id));
}

async function turnBack(ctx: Ctx, a: ArmyRow, reason: Message) {
  await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
  await createReport(ctx, {
    playerId: a.playerId,
    title: msg('report.title.missionAborted'),
    armyType: a.mission,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
    body: { kind: 'text', text: reason },
  });
  await notifyArmyParties(ctx, a);
}

async function heroOf(ctx: Ctx, a: ArmyRow): Promise<HeroRow | null> {
  if (!a.heroId) return null;
  return getHero(ctx, a.heroId, { lock: true }).catch(() => null);
}

const heroSummary = (h: HeroRow | null | undefined) => (h ? { id: h.id, name: h.name, level: h.level, logoUrl: h.logoUrl } : null);

function sumTroops(list: TroopCounts[]): TroopCounts {
  return list.reduce((acc, t) => addTroops(acc, t), {} as TroopCounts);
}

async function grantHeroExp(ctx: Ctx, h: HeroRow | null | undefined, exp: number) {
  if (!h || exp <= 0) return;
  // add to the hero as stored now: the battle may have changed it since it was loaded (its army disbanded and it
  // went idle, or it was sent home), and saving the copy from before the battle would undo that
  const stored = await getHero(ctx, h.id, { lock: true }).catch(() => null);
  if (!stored) return;
  addHeroExp(stored, exp);
  await saveHero(ctx, stored);
  Object.assign(h, stored);
  if (stored.playerId) pushHero(ctx, stored.playerId, stored, 2);
}

function bestHero(list: (HeroRow | null | undefined)[]): HeroRow | null {
  let best: HeroRow | null = null;
  for (const h of list) if (h && (!best || heroPower(h) > heroPower(best))) best = h;
  return best;
}

async function heroesOfArmies(ctx: Ctx, list: ArmyRow[]): Promise<(HeroRow | null)[]> {
  const out: (HeroRow | null)[] = [];
  for (const s of list) out.push(s.heroId ? await getHero(ctx, s.heroId).catch(() => null) : null);
  return out;
}

const buffBonus = (p: PlayerRow, id: BuffId, now: number) => (activeBuff(p, id, now) ? BALANCE.battleBuffBonus : 0);

/** (marchlands) The attack / defense item bonuses that count in a battle, for its report. */
function battleBonuses(p: PlayerRow, now: number): { bonuses?: { desc: Message; itemId?: string }[] } {
  const list = [BuffId.ATTACK, BuffId.DEFENSE]
    .map((id) => activeBuff(p, id, now))
    .filter((b) => b != null)
    .map((b) => ({ desc: b.desc, ...(b.itemId ? { itemId: b.itemId } : {}) }));
  return list.length ? { bonuses: list } : {};
}

const WAR_ENSIGN = ItemId.WAR_ENSIGN;

/**
 * (marchlands) The attacker's item bonuses for its report: battleBonuses, plus the War Ensign when the army is
 * larger than its home Rally Spot allows without one (the Ensign let it march that size).
 */
async function attackerBonuses(ctx: Ctx, p: PlayerRow, a: ArmyRow): Promise<{ bonuses?: { desc: Message; itemId?: string }[] }> {
  const list = battleBonuses(p, ctx.now).bonuses ?? [];
  const home = await findCity(ctx, a.cityId);
  if (home && totalTroops(a.troops) > maxArmyTroops(home.buildings, false, home.historicLevel)) {
    list.push({ desc: WAR_ENSIGN_DESC, itemId: WAR_ENSIGN });
  }
  return list.length ? { bonuses: list } : {};
}

/** Valley/NPC regeneration window. */
const regenMs = () => Math.max(1000, scaled(BALANCE.npcRegenMs));

// ---------------------------------------------------------------------------------------------
// Coming home
// ---------------------------------------------------------------------------------------------

async function returnHome(ctx: Ctx, a: ArmyRow) {
  let homeId = a.cityId;
  const owned = await citiesOf(ctx, a.playerId);
  if (!owned.some((c) => c.id === homeId)) homeId = owned[0]?.id ?? 0;
  const hero = await heroOf(ctx, a);
  if (!homeId) {
    if (hero) await ctx.tx.delete(heroes).where(eq(heroes.id, hero.id));
    await deleteArmy(ctx, a);
    return;
  }
  const b = await openCity(ctx, homeId);
  if (!b) throw new Error(`army ${a.id}'s home city ${homeId} is gone`);
  b.city.troops = addTroops(b.city.troops, a.troops);
  gainResources(b.city, a.resources);
  if (hero && hero.capturedByPlayerId == null) {
    hero.status = HeroStatus.IDLE;
    hero.cityId = homeId;
    await saveHero(ctx, hero);
    pushHero(ctx, a.playerId, hero, 2);
  }
  await deleteArmy(ctx, a);
  await saveCity(ctx, b.city);
  ctx.push(a.playerId, PushCmd.TROOP_UPDATE, { castleId: homeId, troop: troopBean(b.city.troops) });
  pushResources(ctx, b);
  await createReport(ctx, {
    playerId: a.playerId,
    title: msg(
      a.mission === Mission.SCOUT ? 'report.title.scoutReturned' : a.mission === Mission.ATTACK ? 'report.title.attackReturned' : 'report.title.returned',
    ),
    armyType: a.mission,
    isBack: true,
    startPos: a.targetPosName,
    targetPos: a.startPosName,
    body: { kind: 'movement', movement: { hero: heroSummary(hero), troops: a.troops, resources: a.resources } },
  });
  await notifyArmyParties(ctx, a);
}

// ---------------------------------------------------------------------------------------------
// Transport / reinforce / build city
// ---------------------------------------------------------------------------------------------

async function friendlyCityAt(ctx: Ctx, a: ArmyRow): Promise<{ tile: TileRow; b: CityBundle; relation: number } | null> {
  const tile = await getTile(ctx, a.targetTileId);
  if (tile.cityId == null) return null;
  const b = await openCity(ctx, tile.cityId);
  if (!b) return null;
  const relation = await relationBetween(ctx, a.playerId, b.player.id);
  if (!isFriendly(relation)) return null;
  return { tile, b, relation };
}

async function arriveTransport(ctx: Ctx, a: ArmyRow, sender: PlayerRow) {
  const t = await friendlyCityAt(ctx, a);
  if (!t) return turnBack(ctx, a, msg('army.destinationNotFriendly'));
  gainResources(t.b.city, a.resources);
  await saveCity(ctx, t.b.city);
  pushResources(ctx, t.b);
  const body = { kind: 'trade' as const, trade: { from: sender.name, to: t.b.player.name, resources: a.resources } };
  await createReport(ctx, {
    playerId: a.playerId,
    typeId: ReportType.TRADE,
    title: msg('report.title.transportReport'),
    armyType: a.mission,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
    body,
  });
  if (t.b.player.id !== a.playerId) {
    await createReport(ctx, {
      playerId: t.b.player.id,
      typeId: ReportType.TRADE,
      title: msg('report.title.transportReceived'),
      armyType: a.mission,
      startPos: a.startPosName,
      targetPos: a.targetPosName,
      body,
    });
  }
  a.resources = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
  await notifyArmyParties(ctx, a);
}

async function arriveReinforce(ctx: Ctx, a: ArmyRow, sender: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  // own valley: camp there as its garrison
  if (tile.cityId == null) {
    if (tile.ownerPlayerId !== a.playerId) return turnBack(ctx, a, msg('army.valleyNoLongerHeld'));
    return station(ctx, a);
  }
  const t = await friendlyCityAt(ctx, a);
  if (!t) return turnBack(ctx, a, msg('army.destinationNotFriendly'));
  const hero = await heroOf(ctx, a);
  if (t.b.player.id === a.playerId) {
    // own city: troops, goods and the hero move in for good
    t.b.city.troops = addTroops(t.b.city.troops, a.troops);
    gainResources(t.b.city, a.resources);
    let heroLeft = false;
    if (hero) {
      if (t.b.heroes.length < heroSlots(t.b)) {
        Object.assign(hero, { cityId: t.b.city.id, status: HeroStatus.IDLE });
        await saveHero(ctx, hero);
        pushHero(ctx, a.playerId, hero, 2);
      } else heroLeft = true;
    }
    await saveCity(ctx, t.b.city);
    ctx.push(a.playerId, PushCmd.TROOP_UPDATE, { castleId: t.b.city.id, troop: troopBean(t.b.city.troops) });
    pushResources(ctx, t.b);
    await createReport(ctx, {
      playerId: a.playerId,
      typeId: ReportType.OTHER,
      title: msg('report.title.reinforcementArrived'),
      armyType: a.mission,
      startPos: a.startPosName,
      targetPos: a.targetPosName,
      body: { kind: 'movement', movement: { hero: heroSummary(hero), troops: a.troops, resources: a.resources, heroReturned: heroLeft } },
    });
    if (heroLeft) {
      a.troops = {};
      a.resources = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
      await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
    } else await deleteArmy(ctx, a);
    await notifyArmyParties(ctx, a);
    return;
  }
  // allied city: deliver the goods, then camp
  if (totalResources(a.resources) > 0) {
    gainResources(t.b.city, a.resources);
    await saveCity(ctx, t.b.city);
    pushResources(ctx, t.b);
    a.resources = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  }
  await createReport(ctx, {
    playerId: t.b.player.id,
    typeId: ReportType.OTHER,
    title: msg('report.title.reinforcementsFrom', { name: sender.name }),
    armyType: a.mission,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
    body: { kind: 'movement', movement: { from: sender.name, hero: heroSummary(hero), troops: a.troops } },
  });
  return station(ctx, a);
}

async function station(ctx: Ctx, a: ArmyRow) {
  a.direction = ArmyDirection.STAY;
  a.reachTime = ctx.now;
  await saveArmy(ctx, a);
  if (a.restTime > 0) ctx.schedule({ type: 'army', dueAt: ctx.now + a.restTime, playerId: a.playerId, refKey: armyRef(a.id), payload: { armyId: a.id } });
  else ctx.unschedule(armyRef(a.id));
  await notifyArmyParties(ctx, a);
}

async function arriveBuildCity(ctx: Ctx, a: ArmyRow, settler: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  const { n } = one(await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, a.playerId)));
  if (tile.type !== TileType.FLAT || tile.cityId != null || tile.ownerCityId != null) return turnBack(ctx, a, msg('army.landNotFree'));
  if (Number(n) >= maxCitiesFor(settler.title)) return turnBack(ctx, a, msg('army.cityLimit'));
  const name = `${settler.name.slice(0, 12)} ${Number(n) + 1}`;
  const base = initialCity(a.playerId, tile.id, name, ctx.now);
  const city = one(
    await ctx.tx
      .insert(cities)
      .values({
        ...base,
        gold: a.resources.gold,
        food: a.resources.food,
        wood: a.resources.wood,
        stone: a.resources.stone,
        iron: a.resources.iron,
        troops: a.troops,
      })
      .returning(),
  );
  await ctx.tx
    .update(tiles)
    .set({ cityId: city.id, type: TileType.CASTLE, ownerPlayerId: a.playerId, ownerCityId: null, updatedAt: ctx.now })
    .where(eq(tiles.id, tile.id));
  const hero = await heroOf(ctx, a);
  if (hero) {
    Object.assign(hero, { cityId: city.id, status: HeroStatus.MAYOR });
    await saveHero(ctx, hero);
    pushHero(ctx, a.playerId, hero, 0);
  }
  await deleteArmy(ctx, a);
  const b = await viewCity(ctx, city.id);
  pushCity(ctx, b);
  await createReport(ctx, {
    playerId: a.playerId,
    typeId: ReportType.OTHER,
    title: msg('report.title.newCityFounded'),
    armyType: a.mission,
    startPos: a.startPosName,
    targetPos: cityPosition(name, tile.id),
    body: { kind: 'text', text: msg('report.cityFounded', { name }) },
  });
  await notifyArmyParties(ctx, a);
}

// ---------------------------------------------------------------------------------------------
// Scouting
// ---------------------------------------------------------------------------------------------

/** Highest level of an unowned valley's defending hero. */
const VALLEY_GUARD_LEVEL = 20;

/**
 * The defending hero of a barbarian city or unowned valley, generated from a seed kept in the tile
 * state. Attacks meet the hero the last scout reported; only a new scout (`reroll`) changes it. A
 * tile never scouted gets one on its first attack. Changing hands or an upgrade clears the state.
 * It's named for the tile's state.
 */
function guardHeroOf(ctx: Ctx, tile: TileRow, state: Record<string, number>, maxLevel: number, reroll = false) {
  if (reroll || state.heroSeed == null) state.heroSeed = randInt(ctx.rng, 1, 2_147_483_646);
  return createGuardHero(maxLevel, seededRng(`guard:${state.heroSeed}`), stateOf(tile.id));
}

/**
 * An unowned valley's garrison as of `at`. (marchlands) After a fight it comes back a little every second, whole again
 * one regeneration interval later (BALANCE.npcRegenMs, deviations.md); a new garrison is rolled only once the old one
 * is whole and has stood that long. A garrison is rolled from a seed kept in the tile's state (`rollSeed`), so it can
 * be rolled again to know what full is.
 */
function valleyDefenders(ctx: Ctx, tile: TileRow, at: number): TroopCounts {
  const state = (tile.state ??= {});
  const period = regenMs();
  const full = state.rollSeed != null ? valleyGarrison(tile.level, seededRng(`valley:${state.rollSeed}`)) : null;
  if (tile.troops && full) {
    const from = state.refillAt ?? state.regenAt ?? at;
    const troops = refillCounts(tile.troops, full, at - from, 1, period);
    const whole = !countsDiffer(troops, full);
    if (!whole || at - (state.regenAt ?? 0) < period) {
      state.refillAt = nextRefillAt(tile.troops, troops, full, from, at);
      tile.troops = troops;
      return troops;
    }
  }
  state.rollSeed = randInt(ctx.rng, 1, 2_147_483_646);
  state.regenAt = at;
  state.refillAt = at;
  tile.troops = valleyGarrison(tile.level, seededRng(`valley:${state.rollSeed}`));
  return tile.troops;
}

/** A barbarian city's state, garrison and fortifications as of `at` (an army's landing time: deviations.md, Camp times; or a draft's, engine/draft.ts). */
export function npcState(tile: TileRow, at: number): { state: NpcState; troops: TroopCounts; forts: FortCounts } {
  if (!tile.state || tile.state.regenAt == null || !tile.troops) return freshNpcState(tile.level, at);
  return regenerateNpc(tile.level, tile.state as unknown as NpcState, tile.troops, tile.forts ?? {}, at);
}

async function arriveScout(ctx: Ctx, a: ArmyRow, scoutOwner: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  const hero = await heroOf(ctx, a);
  const reportBase = {
    playerId: a.playerId,
    title: msg('report.title.scoutReport'),
    armyType: Mission.SCOUT,
    isAttack: true,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
  };

  if (tile.cityId == null && tile.type === TileType.NPC) {
    const npc = npcState(tile, a.reachTime);
    const state = { ...(npc.state as unknown as Record<string, number>), heroSeed: tile.state?.heroSeed } as Record<string, number>;
    const guard = guardHeroOf(ctx, tile, state, tile.level * 10, true);
    Object.assign(tile, { state, troops: npc.troops, forts: npc.forts, updatedAt: ctx.now });
    await saveTile(ctx, tile);
    await createReport(ctx, {
      ...reportBase,
      body: {
        kind: 'scout',
        scout: {
          target: 'npc',
          level: tile.level,
          success: true,
          loyalty: Math.floor(npc.state.loyalty),
          population: npc.state.population,
          resources: {
            gold: Math.floor(npc.state.gold),
            food: Math.floor(npc.state.food),
            wood: Math.floor(npc.state.wood),
            stone: Math.floor(npc.state.stone),
            iron: Math.floor(npc.state.iron),
          },
          troops: npc.troops,
          fortifications: npc.forts,
          wallLevel: tile.level,
          buildings: npcBuildings(tile.level),
          hero: { name: guard.name, level: guard.level },
        },
      },
    });
    return finishScout(ctx, a, a.troops);
  }

  if (tile.cityId == null && tile.type === TileType.HISTORIC) {
    const level = historicLevel(tile);
    const hc = historicOf(tile, a.reachTime);
    const guard = historicGuard(level, tile.id);
    Object.assign(tile, { state: hc.state, troops: hc.troops, forts: hc.forts, updatedAt: ctx.now });
    await saveTile(ctx, tile);
    await createReport(ctx, {
      ...reportBase,
      body: {
        kind: 'scout',
        scout: {
          target: 'npc',
          level,
          historic: true,
          success: true,
          loyalty: Math.floor(hc.state.loyalty),
          population: hc.state.population,
          resources: {
            gold: Math.floor(hc.state.gold),
            food: Math.floor(hc.state.food),
            wood: Math.floor(hc.state.wood),
            stone: Math.floor(hc.state.stone),
            iron: Math.floor(hc.state.iron),
          },
          troops: hc.troops,
          fortifications: hc.forts,
          wallLevel: level,
          buildings: npcBuildings(10),
          hero: { name: guard.name, level: guard.level },
        },
      },
    });
    return finishScout(ctx, a, a.troops);
  }

  if (tile.cityId == null) {
    // valley or empty land
    let defenders: TroopCounts;
    let ownerName: string | null = null;
    let guard: ReturnType<typeof guardHeroOf> | null = null;
    if (tile.ownerPlayerId) {
      const stationed = await armiesStationedAt(ctx, tile.id, { lock: true });
      defenders = sumTroops(stationed.map((s) => s.troops));
      ownerName = (await getPlayer(ctx, tile.ownerPlayerId)).name;
    } else if (tile.type !== TileType.FLAT) {
      defenders = valleyDefenders(ctx, tile, a.reachTime);
      guard = guardHeroOf(ctx, tile, (tile.state ??= {}), VALLEY_GUARD_LEVEL, true);
      await saveTile(ctx, tile);
    } else defenders = {};
    await createReport(ctx, {
      ...reportBase,
      body: {
        kind: 'scout',
        scout: {
          target: 'valley',
          type: tile.type,
          level: tile.level,
          owner: ownerName,
          success: true,
          troops: defenders,
          ...(guard ? { hero: { name: guard.name, level: guard.level } } : {}),
        },
      },
    });
    return finishScout(ctx, a, a.troops);
  }

  // player city: scouts fight the defending scouts
  const def = await openCity(ctx, tile.cityId);
  if (!def) return turnBack(ctx, a, msg('army.cityGone'));
  const stationed = await armiesStationedAt(ctx, tile.id, { lock: true });
  const cityScouts = def.city.goOutForBattle ? (def.city.troops.scouter ?? 0) : 0;
  const defScouts = cityScouts + stationed.reduce((s, x) => s + (x.troops.scouter ?? 0), 0);
  // the strongest of the city's own heroes and those of armies stationed there, as for an attack
  const defHero = bestHero([
    ...def.heroes.filter((h) => h.playerId === def.player.id && h.status <= HeroStatus.MAYOR),
    ...(await heroesOfArmies(ctx, stationed)),
  ]);
  const result = resolveCombat(
    { troops: { scouter: a.troops.scouter ?? 0 }, research: scoutOwner.research, hero },
    { troops: { scouter: defScouts }, research: def.player.research, hero: defHero },
    ctx.rng,
  );
  const survivors = result.attacker.after.scouter ?? 0;
  // defending scout losses spread over the city (null) and stationed armies
  const holders = [null, ...stationed];
  const scoutsOf = (s: (typeof stationed)[number] | null) => ({ scouter: s ? (s.troops.scouter ?? 0) : cityScouts });
  for (const { holder: s, troops } of distributeLossesAmong(holders, scoutsOf, { scouter: defScouts }, result.defender.after)) {
    if (!s) {
      if (cityScouts > 0) def.city.troops = { ...def.city.troops, scouter: troops.scouter ?? 0 };
      continue;
    }
    s.troops = { ...s.troops, scouter: troops.scouter ?? 0 };
    if (totalTroops(s.troops) <= 0) await disbandEmptyArmy(ctx, s);
    else await saveArmy(ctx, s);
  }
  await saveCity(ctx, def.city);
  const success = survivors > 0;
  const scoutsLost = (a.troops.scouter ?? 0) - survivors;
  const defScoutsLost = defScouts - (result.defender.after.scouter ?? 0);
  ctx.stat(a.playerId, a.cityId, { 'killed.scouter': defScoutsLost, 'lost.scouter': scoutsLost, [`scouting.${success ? 'won' : 'lost'}`]: 1 });
  ctx.stat(def.player.id, def.city.id, { 'killed.scouter': scoutsLost, 'lost.scouter': defScoutsLost, [`scouting.${success ? 'lost' : 'won'}Defending`]: 1 });
  const informatics = researchLevel(scoutOwner.research, TechType.INFORMATICS);
  const intel = success
    ? {
        resources: {
          gold: Math.floor(def.city.gold),
          food: Math.floor(def.city.food),
          wood: Math.floor(def.city.wood),
          stone: Math.floor(def.city.stone),
          iron: Math.floor(def.city.iron),
        },
        troops: def.city.troops,
        fortifications: def.city.forts,
        wallLevel: buildingLevel(def.city.buildings, BuildingType.WALLS),
        population: Math.floor(def.city.population),
        heroes: informatics >= 1 ? def.heroes.filter((h) => h.playerId === def.player.id).map((h) => ({ name: h.name, level: h.level })) : undefined,
        buildings: informatics >= 2 ? def.city.buildings.map((x) => ({ typeId: x.typeId, level: x.level })) : undefined,
        stationed: stationed.filter((s) => totalTroops(s.troops) > 0).map((s) => s.troops),
      }
    : null;
  const battle = {
    rounds: result.rounds,
    attackerScouts: { before: a.troops.scouter ?? 0, after: survivors },
    defenderScouts: { before: defScouts, after: result.defender.after.scouter ?? 0 },
  };
  await createReport(ctx, { ...reportBase, body: { kind: 'scout', scout: { target: 'city', owner: def.player.name, success, battle, intel } } });
  await createReport(ctx, {
    playerId: def.player.id,
    title: msg(success ? 'report.title.enemyScouts' : 'report.title.scoutsRepelled'),
    armyType: Mission.SCOUT,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
    body: { kind: 'scout', scout: { target: 'city', from: scoutOwner.name, success, battle } },
  });
  if (cityScouts > 0) ctx.push(def.player.id, PushCmd.TROOP_UPDATE, { castleId: def.city.id, troop: troopBean(def.city.troops) });
  if (!success) {
    // only the scouts fought: anything else sent along comes home with the hero
    const { scouter: _lost, ...others } = a.troops;
    if (totalTroops(others) > 0) return finishScout(ctx, a, others);
    return armyWiped(ctx, a, hero, def);
  }
  return finishScout(ctx, a, { ...a.troops, scouter: survivors });
}

async function finishScout(ctx: Ctx, a: ArmyRow, survivors: TroopCounts) {
  a.troops = survivors;
  await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
  await notifyArmyParties(ctx, a);
}

async function disbandEmptyArmy(ctx: Ctx, s: ArmyRow) {
  if (s.heroId) {
    const h = await getHero(ctx, s.heroId, { lock: true }).catch(() => null);
    if (h) {
      Object.assign(h, { status: HeroStatus.IDLE });
      await saveHero(ctx, h);
      if (h.playerId) pushHero(ctx, h.playerId, h, 2);
    }
  }
  await deleteArmy(ctx, s);
  await notifyArmyParties(ctx, s);
}

/**
 * The whole army died. Its hero loses 5 loyalty and may be captured by a defending city with a
 * free Feasting Hall slot (chance: d100 > loyalty), its loyalty then 0; otherwise it limps home at once.
 */
async function armyWiped(ctx: Ctx, a: ArmyRow, hero: HeroRow | null, captor: CityBundle | null): Promise<{ captured: boolean }> {
  let captured = false;
  if (hero) {
    hero.loyalty = Math.max(0, hero.loyalty - 5);
    const free = captor ? captor.heroes.length < heroSlots(captor) : false;
    if (captor && free && randInt(ctx.rng, 0, 99) > hero.loyalty) {
      const home = hero.cityId;
      Object.assign(hero, {
        cityId: captor.city.id,
        status: HeroStatus.SEIZED,
        capturedByPlayerId: captor.player.id,
        // as the original's battle handler: a captive's loyalty to its owner is gone, so it can be persuaded
        loyalty: 0,
        powerBuffAdded: 0,
        managementBuffAdded: 0,
        stratagemBuffAdded: 0,
        buffs: [{ id: HeroBuffId.HOME_CITY, desc: msg('buff.homeCity'), endTime: Number.MAX_SAFE_INTEGER, param: home }],
      });
      captured = true;
      pushHero(ctx, captor.player.id, hero, 0);
      ctx.push(a.playerId, PushCmd.HERO_UPDATE, { castleId: home, hero: heroBean(hero), updateType: 1 });
    } else {
      hero.status = HeroStatus.IDLE;
      pushHero(ctx, a.playerId, hero, 2);
    }
    await saveHero(ctx, hero);
  }
  await deleteArmy(ctx, a);
  await notifyArmyParties(ctx, a);
  return { captured };
}

// ---------------------------------------------------------------------------------------------
// Attacks
// ---------------------------------------------------------------------------------------------

interface BattleSideReport {
  player: string;
  hero: ReturnType<typeof heroSummary>;
  troops: { before: TroopCounts; lost: TroopCounts; after: TroopCounts };
  /** fallen troops that survived injured (Medicine) */
  injured?: TroopCounts;
  bonuses?: { desc: Message; itemId?: string }[];
}

/**
 * (marchlands) Lord statistics of an attack: kills, losses and the result for the attacker's home city
 * and, when a lord defended, for the defending city. Valleys count `captured` as occupied.
 */
function battleStats(
  ctx: Ctx,
  a: ArmyRow,
  r: CombatResult,
  target: 'city' | 'npc' | 'valley',
  o: {
    injured?: TroopCounts;
    loot?: ResourceSet;
    captured?: boolean;
    level?: number;
    defender?: { playerId: number; cityId: number; injured?: TroopCounts } | null;
  },
) {
  const fortsLost = r.forts.lost;
  const won = r.attackerWon;
  ctx.stat(a.playerId, a.cityId, {
    ...prefixed('killed', r.defender.lost),
    ...prefixed('killed', fortsLost),
    ...prefixed('lost', r.attacker.lost),
    ...prefixed('injured', o.injured),
    ...prefixed('plundered', o.loot),
    [`attacks.${won ? 'won' : 'lost'}.${target}`]: 1,
    ...(target === 'npc' && won && o.level ? { [`npcWins.${o.level}`]: 1 } : {}),
    ...(o.captured ? { [`captured.${target}`]: 1 } : {}),
    honor: r.attackerHonor,
  });
  const d = o.defender;
  if (!d) return;
  ctx.stat(d.playerId, d.cityId, {
    ...prefixed('killed', r.attacker.lost),
    ...prefixed('lost', r.defender.lost),
    ...prefixed('lost', fortsLost),
    ...prefixed('injured', d.injured),
    ...prefixed('stolen', o.loot),
    [`defenses.${won ? 'lost' : 'won'}.${target}`]: 1,
    ...(o.captured ? { [`taken.${target}`]: 1 } : {}),
    honor: r.defenderHonor,
  });
}

/** Medals a won attack on a city of `level` drops (BALANCE.medalDrops), added to the attacker's items. */
function awardMedals(ctx: Ctx, attacker: PlayerRow, level: number): Record<string, number> {
  const medals = rollMedalDrops(level, ctx.rng);
  for (const [id, n] of Object.entries(medals)) addItem(ctx, attacker, id, n);
  return medals;
}

/**
 * Medicine for attackers (BALANCE.attackersGetInjured): part of an attacking army's fallen are
 * carried home injured, healable in the army's home city with resources or honor.
 */
async function woundAttackers(ctx: Ctx, a: ArmyRow, attacker: PlayerRow, lost: TroopCounts): Promise<TroopCounts> {
  if (!BALANCE.attackersGetInjured) return {};
  const injured = injuredOf(lost, attacker.research);
  if (totalTroops(injured) <= 0) return {};
  const home = await openCity(ctx, a.cityId);
  if (!home) return {};
  home.city.injuredTroops = addTroops(home.city.injuredTroops, injured);
  await saveCity(ctx, home.city);
  ctx.push(home.player.id, PushCmd.INJURED_TROOP_UPDATE, { castleId: home.city.id, troop: troopBean(home.city.injuredTroops) });
  return injured;
}

function battleBody(
  r: CombatResult,
  attacker: BattleSideReport,
  defender: BattleSideReport & { forts?: { before: FortCounts; lost: FortCounts; after: FortCounts }; wallLevel?: number },
  extra: BattleExtra,
): ReportBody {
  return {
    kind: 'battle' as const,
    battle: {
      result: r.attackerWon ? 'attackerWon' : r.defenderWon ? 'defenderWon' : 'draw',
      rounds: r.rounds,
      attacker: { ...attacker, honor: r.attackerHonor, heroExp: r.attackerHeroExp },
      defender: { ...defender, honor: r.defenderHonor, heroExp: r.defenderHeroExp },
      ...extra,
    },
  };
}

async function arriveAttack(ctx: Ctx, a: ArmyRow, attacker: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId);
  if (tile.cityId != null) return attackCity(ctx, a, attacker, tile.cityId);
  if (tile.type === TileType.NPC) return attackNpc(ctx, a, attacker);
  if (tile.type === TileType.HISTORIC) return attackHistoric(ctx, a, attacker);
  if (tile.type !== TileType.FLAT) return attackValley(ctx, a, attacker);
  return turnBack(ctx, a, msg('army.nothingToAttack'));
}

async function homeBundle(ctx: Ctx, a: ArmyRow): Promise<CityBundle | null> {
  return openCity(ctx, a.cityId);
}

/** Survivors head home carrying plunder. */
async function returnWithLoot(ctx: Ctx, a: ArmyRow, survivors: TroopCounts, loot: ResourceSet) {
  a.troops = survivors;
  a.resources = {
    gold: a.resources.gold + loot.gold,
    food: a.resources.food + loot.food,
    wood: a.resources.wood + loot.wood,
    stone: a.resources.stone + loot.stone,
    iron: a.resources.iron + loot.iron,
  };
  await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
  await notifyArmyParties(ctx, a);
}

function lootCapacity(a: ArmyRow, survivors: TroopCounts, attacker: PlayerRow) {
  return Math.max(0, armyLoad(survivors, attacker.research) - totalResources(a.resources));
}

async function attackCity(ctx: Ctx, a: ArmyRow, attacker: PlayerRow, cityId: number) {
  const def = await openCity(ctx, cityId);
  if (!def) return turnBack(ctx, a, msg('army.cityGone'));
  const relation = await relationBetween(ctx, a.playerId, def.player.id);
  if (isFriendly(relation)) return turnBack(ctx, a, msg('army.cityNowFriendly'));
  // (marchlands) a captured historic city has a truce of its own; its holder's protection doesn't cover it
  const why = def.city.historicLevel
    ? def.city.truceUntil > ctx.now
      ? msg('army.historicTruce', { time: dur(def.city.truceUntil - ctx.now) })
      : null
    : isProtected(def.player, ctx.now);
  if (why) return turnBack(ctx, a, why);
  const tile = await getTile(ctx, def.city.tileId, { lock: true });
  const stationed = await armiesStationedAt(ctx, tile.id, { lock: true });
  const hero = await heroOf(ctx, a);
  const cityTroops = def.city.goOutForBattle ? def.city.troops : {};
  const groups = [cityTroops, ...stationed.map((s) => s.troops)];
  const defTroops = sumTroops(groups);
  const stationedHeroes = await heroesOfArmies(ctx, stationed);
  const defHero = bestHero([...def.heroes.filter((h) => h.playerId === def.player.id && h.status <= HeroStatus.MAYOR), ...stationedHeroes]);
  const wallLevel = buildingLevel(def.city.buildings, BuildingType.WALLS);
  const r = resolveCombat(
    {
      troops: a.troops,
      research: attacker.research,
      hero,
      attackBonus: buffBonus(attacker, BuffId.ATTACK, ctx.now),
      defenseBonus: buffBonus(attacker, BuffId.DEFENSE, ctx.now),
    },
    {
      troops: defTroops,
      research: def.player.research,
      hero: defHero,
      forts: def.city.forts,
      wallLevel,
      attackBonus: buffBonus(def.player, BuffId.ATTACK, ctx.now),
      defenseBonus: buffBonus(def.player, BuffId.DEFENSE, ctx.now),
    },
    ctx.rng,
  );

  let defenderInjured: TroopCounts = {};
  // apply defender losses: the city's own (null), then each stationed army's
  for (const { holder: s, troops } of distributeLossesAmong([null, ...stationed], (s) => (s ? s.troops : cityTroops), defTroops, r.defender.after)) {
    if (!s) {
      if (def.city.goOutForBattle) {
        const lost = addTroops(def.city.troops, troops, -1);
        def.city.troops = troops;
        // Medicine: part of the city's own fallen recover as injured
        defenderInjured = injuredOf(lost, def.player.research);
        def.city.injuredTroops = addTroops(def.city.injuredTroops, defenderInjured);
      }
      continue;
    }
    s.troops = troops;
    if (totalTroops(s.troops) <= 0) await disbandEmptyArmy(ctx, s);
    else await saveArmy(ctx, s);
  }
  def.city.forts = r.forts.after;

  // spoils; (marchlands) lords' cities have no loyalty, so they are plundered but never captured; a captured historic
  // city has, and the win that leaves it at 0 hands it to the winner (takeSeat, below)
  let loot: ResourceSet = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  let seat: { level: number; loyaltyDamage: number; loyaltyLeft: number; captured: boolean } | undefined;
  const seatLevel = HISTORIC_LEVELS.find((l) => l === def.city.historicLevel);
  if (seatLevel) {
    const now = seatLoyalty(def.city.loyalty, def.city.loyaltyAt, a.reachTime);
    const loyaltyDamage = r.attackerWon ? Math.min(now.loyalty, BALANCE.historic.loyaltyPerWin) : 0;
    Object.assign(def.city, { loyalty: now.loyalty - loyaltyDamage, loyaltyAt: now.loyaltyAt });
    const captured = r.attackerWon && def.city.loyalty <= 0 && (await canHoldHistoric(ctx, attacker, seatLevel));
    seat = { level: seatLevel, loyaltyDamage, loyaltyLeft: def.city.loyalty, captured };
  }
  if (r.attackerWon) {
    const prot = protectedResources(def.city.buildings, def.city.storePercent);
    const available: ResourceSet = {
      gold: def.city.gold,
      food: Math.max(0, def.city.food - prot.food),
      wood: Math.max(0, def.city.wood - prot.wood),
      stone: Math.max(0, def.city.stone - prot.stone),
      iron: Math.max(0, def.city.iron - prot.iron),
    };
    loot = plunder(available, lootCapacity(a, r.attacker.after, attacker));
    for (const k of Object.keys(loot) as (keyof ResourceSet)[]) def.city[k] -= loot[k];
  }

  attacker.honor += r.attackerHonor;
  def.player.honor += r.defenderHonor;
  const medals = r.attackerWon ? awardMedals(ctx, attacker, buildingLevel(def.city.buildings, BuildingType.TOWN_HALL)) : {};
  await grantHeroExp(ctx, hero, r.attackerHeroExp);
  await grantHeroExp(ctx, defHero, r.defenderHeroExp);
  await savePlayer(ctx, attacker);
  await savePlayer(ctx, def.player);
  await saveCity(ctx, def.city);

  const attackerSide = {
    player: attacker.name,
    hero: heroSummary(hero),
    troops: { before: r.attacker.before, lost: r.attacker.lost, after: r.attacker.after },
    injured: await woundAttackers(ctx, a, attacker, r.attacker.lost),
    ...(await attackerBonuses(ctx, attacker, a)),
  };
  const defenderSide = {
    player: def.player.name,
    hero: heroSummary(defHero),
    troops: { before: r.defender.before, lost: r.defender.lost, after: r.defender.after },
    injured: defenderInjured,
    forts: r.forts,
    wallLevel,
    ...battleBonuses(def.player, ctx.now),
  };
  battleStats(ctx, a, r, 'city', {
    injured: attackerSide.injured,
    loot,
    defender: { playerId: def.player.id, cityId: def.city.id, injured: defenderInjured },
  });
  const body = battleBody(r, attackerSide, defenderSide, {
    plunder: loot,
    city: def.city.name,
    ...(Object.keys(medals).length ? { medals } : {}),
    ...(seat ? { seat } : {}),
  });
  const reportCommon = { armyType: Mission.ATTACK, startPos: a.startPosName, targetPos: a.targetPosName, body };
  await createReport(ctx, {
    ...reportCommon,
    playerId: a.playerId,
    title: msg(r.attackerWon ? 'report.title.attackSucceeded' : 'report.title.attackFailed'),
    isAttack: true,
  });
  await createReport(ctx, {
    ...reportCommon,
    playerId: def.player.id,
    title: msg(seat?.captured ? 'report.title.seatLost' : r.attackerWon ? 'report.title.cityAttacked' : 'report.title.attackRepelled'),
  });
  for (const owner of new Set(stationed.map((s) => s.playerId).filter((id) => id !== def.player.id))) {
    await createReport(ctx, { ...reportCommon, playerId: owner, title: msg('report.title.reinforcementsFought') });
  }
  ctx.push(def.player.id, PushCmd.TROOP_UPDATE, { castleId: def.city.id, troop: troopBean(def.city.troops) });
  ctx.push(def.player.id, PushCmd.FORTIFICATIONS_UPDATE, { castleId: def.city.id, fortification: fortBean(def.city.forts) });
  pushResources(ctx, def);
  if (seat?.captured) await takeSeat(ctx, def, attacker, seat.level);
  if (totalTroops(r.attacker.after) <= 0) {
    await armyWiped(ctx, a, hero, def);
    return;
  }
  await returnWithLoot(ctx, a, r.attacker.after, loot);
}

/**
 * A held historic city taken (docs/features/historical-cities.md): it becomes the winner's, whole but for its troops
 * (lost in the battle; any kept home go too), under a new truce and at full loyalty, drafting by itself. What its old holder had there moves
 * to their oldest other city: heroes, armies out, market orders and shipments; with no other city, they're gone.
 * Valleys it held go free (their troops head home), allies' troops stationed in it go home, and armies already marching
 * on it now march on the winner.
 */
/**
 * A held historic city's holder leaves it (taken by a rival, or risen up): their heroes, armies, market orders and
 * shipments go to their oldest other city (or are gone, with none), its valleys go free, and allies' troops stationed in
 * it go home.
 */
export async function evacuateSeat(ctx: Ctx, city: CityRow, loserId: number) {
  const fallback = (await citiesOf(ctx, loserId)).filter((c) => c.id !== city.id).sort((p, q) => p.id - q.id)[0];
  // the old holder's heroes and armies out, orders and shipments, to their other city
  const theirs = await ctx.tx
    .select()
    .from(armies)
    .where(and(eq(armies.cityId, city.id), eq(armies.playerId, loserId)));
  if (fallback) {
    await ctx.tx
      .update(heroes)
      .set({ cityId: fallback.id })
      .where(and(eq(heroes.cityId, city.id), eq(heroes.playerId, loserId)));
    await ctx.tx
      .update(heroes)
      .set({ status: HeroStatus.IDLE })
      .where(and(eq(heroes.cityId, fallback.id), eq(heroes.status, HeroStatus.MAYOR), eq(heroes.playerId, loserId)));
    await ctx.tx
      .update(armies)
      .set({ cityId: fallback.id })
      .where(and(eq(armies.cityId, city.id), eq(armies.playerId, loserId)));
    await ctx.tx
      .update(marketOrders)
      .set({ cityId: fallback.id })
      .where(and(eq(marketOrders.cityId, city.id), eq(marketOrders.playerId, loserId)));
    await ctx.tx
      .update(marketShipments)
      .set({ cityId: fallback.id })
      .where(and(eq(marketShipments.cityId, city.id), eq(marketShipments.playerId, loserId)));
  } else {
    for (const a of theirs) ctx.unschedule(armyRef(a.id));
    await ctx.tx.delete(armies).where(and(eq(armies.cityId, city.id), eq(armies.playerId, loserId)));
    await ctx.tx.delete(heroes).where(and(eq(heroes.cityId, city.id), eq(heroes.playerId, loserId)));
    await ctx.tx.delete(marketOrders).where(and(eq(marketOrders.cityId, city.id), eq(marketOrders.playerId, loserId)));
    await ctx.tx.delete(marketShipments).where(and(eq(marketShipments.cityId, city.id), eq(marketShipments.playerId, loserId)));
  }
  // valleys it held go free; allies' troops stationed in it go home; armies marching on it now march on the winner
  for (const v of await ctx.tx.select().from(tiles).where(eq(tiles.ownerCityId, city.id))) {
    for (const s of await armiesStationedAt(ctx, v.id, { lock: true })) await sendBack(ctx, s, await homeMarchMs(ctx, s, v.id));
    await ctx.tx.update(tiles).set({ ownerCityId: null, ownerPlayerId: null, troops: null, state: null, updatedAt: ctx.now }).where(eq(tiles.id, v.id));
  }
  for (const s of await armiesStationedAt(ctx, city.tileId, { lock: true })) await sendBack(ctx, s, await homeMarchMs(ctx, s, city.tileId));
}

async function takeSeat(ctx: Ctx, def: CityBundle, winner: PlayerRow, level: number) {
  const city = def.city;
  const loser = def.player;
  await evacuateSeat(ctx, city, loser.id);
  await ctx.tx
    .update(armies)
    .set({ targetPlayerId: winner.id })
    .where(and(eq(armies.targetTileId, city.tileId), eq(armies.direction, ArmyDirection.FORWARD)));
  Object.assign(city, {
    playerId: winner.id,
    name: seatName(city.tileId, winner),
    troops: {},
    injuredTroops: {},
    truceUntil: ctx.now + BALANCE.historic.truceMs,
    loyalty: BALANCE.historic.loyalty,
    loyaltyAt: ctx.now,
    // its new holder starts drafting by itself, the default, from the next part of the day; the drafts made today
    // still count against the seat
    draftAuto: true,
    draftNextAt: nextAutoDraftAt(ctx.now),
  });
  await saveCity(ctx, city);
  await ctx.tx.update(tiles).set({ ownerPlayerId: winner.id, updatedAt: ctx.now }).where(eq(tiles.id, city.tileId));
  addPrestige(winner, 1000 * level);
  await savePlayer(ctx, winner);
  pushCity(ctx, await viewCity(ctx, city.id));
  await pushPlayerInfo(ctx, loser);
  await notifyArmyParties(ctx, { playerId: loser.id, targetPlayerId: winner.id });
}

async function attackNpc(ctx: Ctx, a: ArmyRow, attacker: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  const hero = await heroOf(ctx, a);
  const npc = npcState(tile, a.reachTime);
  const seedHolder = { heroSeed: tile.state?.heroSeed } as Record<string, number>;
  const guard = guardHeroOf(ctx, tile, seedHolder, tile.level * 10);
  const r = resolveCombat(
    {
      troops: a.troops,
      research: attacker.research,
      hero,
      attackBonus: buffBonus(attacker, BuffId.ATTACK, ctx.now),
      defenseBonus: buffBonus(attacker, BuffId.DEFENSE, ctx.now),
    },
    { troops: npc.troops, research: {}, hero: guard, forts: npc.forts, wallLevel: tile.level },
    ctx.rng,
  );
  let loot: ResourceSet = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  let loyaltyDamage = 0;
  let captured = false;
  // (marchlands) a city no player holds belongs to a faction or is a bandit camp on one's land (core reputation.ts),
  // unless a player rules its state
  const unheld = tile.ownerCityId == null;
  const ruled = await ruledZones(ctx);
  const state = { ...npc.state, heroSeed: seedHolder.heroSeed };
  if (r.attackerWon) {
    loot = plunder({ gold: state.gold, food: state.food, wood: state.wood, stone: state.stone, iron: state.iron }, lootCapacity(a, r.attacker.after, attacker));
    for (const k of Object.keys(loot) as (keyof ResourceSet)[]) state[k] -= loot[k];
    // (marchlands) a faction member's plunder lowers its group's stock, and so moves the factions' prices
    if (unheld) await plunderNpc(ctx, tile.id, tile.level, loot, ruled);
    const [lo, hi] = BALANCE.npcLoyaltyDamagePerAttack;
    loyaltyDamage = randInt(ctx.rng, lo, hi);
    state.loyalty = Math.max(0, state.loyalty - loyaltyDamage);
  }
  Object.assign(tile, { troops: r.defender.after, forts: r.forts.after, state, updatedAt: ctx.now });
  if (r.attackerWon && state.loyalty <= 0) {
    const { n } = one(await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, attacker.id)));
    if (Number(n) < maxCitiesFor(attacker.title)) {
      captured = true;
      await captureNpc(ctx, attacker, tile, state);
    }
  }
  if (!captured) await saveTile(ctx, tile);
  // (marchlands) attacking a member costs standing with its faction; a won attack on a bandit camp earns a little
  const moved = unheld ? attackStanding(tile.id, tile.level, r.attackerWon, captured, ruled) : null;
  const standing = moved && { faction: moved.faction.id, change: moved.change, now: await addStanding(ctx, attacker.id, moved.faction.id, moved.change) };
  attacker.honor += r.attackerHonor;
  const medals = r.attackerWon ? awardMedals(ctx, attacker, tile.level) : {};
  await savePlayer(ctx, attacker);
  await grantHeroExp(ctx, hero, r.attackerHeroExp);
  const injured = await woundAttackers(ctx, a, attacker, r.attacker.lost);
  battleStats(ctx, a, r, 'npc', { injured, loot, captured, level: tile.level });
  const body = battleBody(
    r,
    {
      player: attacker.name,
      hero: heroSummary(hero),
      troops: { before: r.attacker.before, lost: r.attacker.lost, after: r.attacker.after },
      injured,
      ...(await attackerBonuses(ctx, attacker, a)),
    },
    {
      player: '', // the barbarian city itself: the client names it
      hero: { id: 0, name: guard.name, level: guard.level, logoUrl: guard.logoUrl },
      troops: { before: r.defender.before, lost: r.defender.lost, after: r.defender.after },
      forts: r.forts,
      wallLevel: tile.level,
    },
    {
      plunder: loot,
      loyaltyDamage,
      loyaltyLeft: Math.floor(state.loyalty),
      captured,
      level: tile.level,
      ...(Object.keys(medals).length ? { medals } : {}),
      ...(standing ? { standing } : {}),
    },
  );
  await createReport(ctx, {
    playerId: a.playerId,
    title: msg(r.attackerWon ? 'report.title.attackSucceeded' : 'report.title.attackFailed'),
    isAttack: true,
    armyType: Mission.ATTACK,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
    body,
  });
  if (totalTroops(r.attacker.after) <= 0) {
    await armyWiped(ctx, a, hero, null);
    return;
  }
  await returnWithLoot(ctx, a, r.attacker.after, loot);
}

/** A historic city tile's level (its row holds one of HISTORIC_LEVELS). */
function historicLevel(tile: TileRow): HistoricLevel {
  return HISTORIC_LEVELS.find((l) => l === tile.level) ?? 12;
}

/** A historic city's state, garrison and fortifications as of `at` (an army's landing time, a draft). */
export function historicOf(tile: TileRow, at: number) {
  const stored = tile.state && tile.troops ? { state: tile.state as unknown as HistoricState, troops: tile.troops, forts: tile.forts ?? {} } : null;
  return historicState(historicLevel(tile), tile.id, stored, at);
}

/**
 * An attack on a historic city (docs/features/historical-cities.md): its garrison, research and hero, its loot a level
 * 10's, and each win takes BALANCE.historic.loyaltyPerWin off its loyalty. The win that leaves it at 0 captures it,
 * when the attacker has a free city slot and holds fewer seats of its level than BALANCE.historic.holdLimit allows;
 * otherwise it stays at 0 for the next. No faction stands behind it yet.
 */
async function attackHistoric(ctx: Ctx, a: ArmyRow, attacker: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  const level = historicLevel(tile);
  const hero = await heroOf(ctx, a);
  const hc = historicOf(tile, a.reachTime);
  const guard = historicGuard(level, tile.id);
  const r = resolveCombat(
    {
      troops: a.troops,
      research: attacker.research,
      hero,
      attackBonus: buffBonus(attacker, BuffId.ATTACK, ctx.now),
      defenseBonus: buffBonus(attacker, BuffId.DEFENSE, ctx.now),
    },
    { troops: hc.troops, research: historicResearch(), hero: guard, forts: hc.forts, wallLevel: level },
    ctx.rng,
  );
  let loot: ResourceSet = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  let loyaltyDamage = 0;
  const state = { ...hc.state };
  if (r.attackerWon) {
    loot = plunder({ gold: state.gold, food: state.food, wood: state.wood, stone: state.stone, iron: state.iron }, lootCapacity(a, r.attacker.after, attacker));
    for (const k of Object.keys(loot) as (keyof ResourceSet)[]) state[k] -= loot[k];
    loyaltyDamage = Math.min(state.loyalty, BALANCE.historic.loyaltyPerWin);
    state.loyalty -= loyaltyDamage;
  }
  Object.assign(tile, { troops: r.defender.after, forts: r.forts.after, state, updatedAt: ctx.now });
  let captured = false;
  if (r.attackerWon && state.loyalty <= 0 && (await canHoldHistoric(ctx, attacker, level))) {
    captured = true;
    await captureHistoric(ctx, attacker, tile, level, state);
  } else await saveTile(ctx, tile);
  // (marchlands) attacking a historic city costs standing with the faction whose state it stands in, capturing it more,
  // and its rivals thank the captor (core seatStanding)
  const { standing, rivals } = await seatStandingMoved(ctx, attacker.id, seatStanding(tile.id, level, captured, await ruledZones(ctx)));
  attacker.honor += r.attackerHonor;
  await savePlayer(ctx, attacker);
  await grantHeroExp(ctx, hero, r.attackerHeroExp);
  const injured = await woundAttackers(ctx, a, attacker, r.attacker.lost);
  battleStats(ctx, a, r, 'npc', { injured, loot, captured, level });
  const body = battleBody(
    r,
    {
      player: attacker.name,
      hero: heroSummary(hero),
      troops: { before: r.attacker.before, lost: r.attacker.lost, after: r.attacker.after },
      injured,
      ...(await attackerBonuses(ctx, attacker, a)),
    },
    {
      player: '', // the historic city itself: the client names it (`historic`)
      hero: { id: 0, name: guard.name, level: guard.level, logoUrl: guard.logoUrl },
      troops: { before: r.defender.before, lost: r.defender.lost, after: r.defender.after },
      forts: r.forts,
      wallLevel: level,
    },
    {
      plunder: loot,
      loyaltyDamage,
      loyaltyLeft: Math.floor(state.loyalty),
      captured,
      level,
      historic: true,
      ...(standing ? { standing } : {}),
      ...(rivals.length ? { rivals } : {}),
    },
  );
  await createReport(ctx, {
    playerId: a.playerId,
    title: msg(r.attackerWon ? 'report.title.attackSucceeded' : 'report.title.attackFailed'),
    isAttack: true,
    armyType: Mission.ATTACK,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
    body,
  });
  if (totalTroops(r.attacker.after) <= 0) {
    await armyWiped(ctx, a, hero, null);
    return;
  }
  await returnWithLoot(ctx, a, r.attacker.after, loot);
}

/** Applies a historic city's standing changes to the attacker; returns them as the battle report shows them. */
async function seatStandingMoved(ctx: Ctx, playerId: number, moved: ReturnType<typeof seatStanding>) {
  if (!moved) return { standing: null, rivals: [] };
  const apply = async ({ faction, change }: StandingChange) => ({ faction: faction.id, change, now: await addStanding(ctx, playerId, faction.id, change) });
  const standing = await apply(moved.own);
  const rivals = [];
  for (const r of moved.rivals) rivals.push(await apply(r));
  return { standing, rivals };
}

/** Whether a player may take a historic city of a level: a free city slot, and fewer of that level than its limit. */
async function canHoldHistoric(ctx: Ctx, attacker: PlayerRow, level: HistoricLevel) {
  const held = await ctx.tx.select({ historicLevel: cities.historicLevel }).from(cities).where(eq(cities.playerId, attacker.id));
  return held.length < maxCitiesFor(attacker.title) && held.filter((c) => c.historicLevel === level).length < BALANCE.historic.holdLimit[level];
}

/**
 * A held historic city's name: its own when it has one (docs/features/historical-cities.md, Names), which it keeps
 * whoever holds it, else `<holder> Keep` as for any captured city.
 */
function seatName(tileId: number, holder: PlayerRow) {
  const { x, y } = tileXY(tileId);
  return historicNameAt(x, y) ?? `${holder.name.slice(0, 12)} Keep`;
}

/**
 * A historic city captured (docs/features/historical-cities.md): it becomes the attacker's city, its buildings all
 * level 10 but its fields at its own level (historicCityBuildings), under a truce of its own for BALANCE.historic.truceMs.
 */
async function captureHistoric(ctx: Ctx, attacker: PlayerRow, tile: TileRow, level: HistoricLevel, state: HistoricState) {
  const base = initialCity(attacker.id, tile.id, seatName(tile.id, attacker), ctx.now);
  const city = one(
    await ctx.tx
      .insert(cities)
      .values({
        ...base,
        buildings: historicCityBuildings(level),
        gold: state.gold,
        food: state.food,
        wood: state.wood,
        stone: state.stone,
        iron: state.iron,
        population: state.population,
        historicLevel: level,
        truceUntil: ctx.now + BALANCE.historic.truceMs,
        loyalty: BALANCE.historic.loyalty,
        loyaltyAt: ctx.now,
        // drafting by itself (the default) from the next part of the day
        draftNextAt: nextAutoDraftAt(ctx.now),
      })
      .returning(),
  );
  Object.assign(tile, {
    type: TileType.CASTLE,
    cityId: city.id,
    ownerPlayerId: attacker.id,
    ownerCityId: null,
    troops: null,
    forts: null,
    state: null,
    updatedAt: ctx.now,
  });
  await saveTile(ctx, tile);
  await dropCapturedTarget(ctx, tile.id);
  pushCity(ctx, await viewCity(ctx, city.id));
  addPrestige(attacker, 1000 * level);
}

async function captureNpc(ctx: Ctx, attacker: PlayerRow, tile: TileRow, state: NpcState) {
  const name = `${attacker.name.slice(0, 12)} Keep`;
  const base = initialCity(attacker.id, tile.id, name, ctx.now);
  const city = one(
    await ctx.tx
      .insert(cities)
      .values({
        ...base,
        buildings: npcCityBuildings(tile.level),
        gold: state.gold,
        food: state.food,
        wood: state.wood,
        stone: state.stone,
        iron: state.iron,
        population: state.population,
      })
      .returning(),
  );
  Object.assign(tile, {
    type: TileType.CASTLE,
    cityId: city.id,
    ownerPlayerId: attacker.id,
    ownerCityId: null,
    troops: null,
    forts: null,
    state: null,
    updatedAt: ctx.now,
  });
  await saveTile(ctx, tile);
  await dropCapturedTarget(ctx, tile.id);
  pushCity(ctx, await viewCity(ctx, city.id));
  addPrestige(attacker, 1000 * tile.level);
}

async function attackValley(ctx: Ctx, a: ArmyRow, attacker: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  const ownerCityId = tile.ownerCityId ?? 0;
  const hero = await heroOf(ctx, a);
  let groups: TroopCounts[];
  let stationed: ArmyRow[] = [];
  let valleyTroops: TroopCounts = {}; // the valley's own defenders, when no player holds it
  let defenderName = ''; // the valley's own defenders: the client names them
  let defenderId: number | null = null;
  if (tile.ownerPlayerId) {
    if (tile.ownerPlayerId === a.playerId) return turnBack(ctx, a, msg('army.valleyAlreadyHeld'));
    const relation = await relationBetween(ctx, a.playerId, tile.ownerPlayerId);
    if (isFriendly(relation)) return turnBack(ctx, a, msg('army.valleyNowFriendly'));
    stationed = await armiesStationedAt(ctx, tile.id, { lock: true });
    groups = stationed.map((s) => s.troops);
    defenderId = tile.ownerPlayerId;
    defenderName = (await getPlayer(ctx, defenderId)).name;
  } else {
    valleyTroops = valleyDefenders(ctx, tile, a.reachTime);
    groups = [valleyTroops];
  }
  const defTroops = sumTroops(groups);
  const owner = defenderId ? await getPlayer(ctx, defenderId) : null;
  const stationedHeroes = await heroesOfArmies(ctx, stationed);
  const guard = owner ? bestHero(stationedHeroes) : null;
  const npcGuard = owner ? null : guardHeroOf(ctx, tile, (tile.state ??= {}), VALLEY_GUARD_LEVEL);
  const r = resolveCombat(
    {
      troops: a.troops,
      research: attacker.research,
      hero,
      attackBonus: buffBonus(attacker, BuffId.ATTACK, ctx.now),
      defenseBonus: buffBonus(attacker, BuffId.DEFENSE, ctx.now),
    },
    {
      troops: defTroops,
      research: owner?.research ?? {},
      hero: guard ?? npcGuard,
      attackBonus: owner ? buffBonus(owner, BuffId.ATTACK, ctx.now) : 0,
      defenseBonus: owner ? buffBonus(owner, BuffId.DEFENSE, ctx.now) : 0,
    },
    ctx.rng,
  );
  if (owner) {
    for (const { holder: s, troops } of distributeLossesAmong(stationed, (s) => s.troops, defTroops, r.defender.after)) {
      s.troops = troops;
      if (totalTroops(s.troops) <= 0) await disbandEmptyArmy(ctx, s);
      else await saveArmy(ctx, s);
    }
    owner.honor += r.defenderHonor;
    await savePlayer(ctx, owner);
  } else for (const { troops } of distributeLossesAmong([tile], () => valleyTroops, defTroops, r.defender.after)) tile.troops = troops;

  let occupied = false;
  let reason: Message | null = null;
  if (r.attackerWon) {
    const home = await homeBundle(ctx, a);
    if (!home) reason = msg('army.homeCityGone');
    else {
      const th = buildingLevel(home.city.buildings, BuildingType.TOWN_HALL);
      const { n } = one(await ctx.tx.select({ n: count() }).from(tiles).where(eq(tiles.ownerCityId, home.city.id)));
      if (Number(n) >= maxValleysFor(th)) reason = msg('army.valleyLimit', { building: ref.building(BuildingType.TOWN_HALL) });
      else {
        // remaining stationed armies of the old owner go home
        for (const s of stationed.filter((x) => totalTroops(x.troops) > 0)) await sendBack(ctx, s, await homeMarchMs(ctx, s, tile.id));
        const previousCity = tile.ownerCityId;
        Object.assign(tile, { ownerCityId: home.city.id, ownerPlayerId: a.playerId, troops: null, state: null });
        occupied = true;
        await settleValleyOwnerChange(ctx, previousCity, home);
      }
    }
  }
  tile.updatedAt = ctx.now;
  await saveTile(ctx, tile);
  attacker.honor += r.attackerHonor;
  await savePlayer(ctx, attacker);
  await grantHeroExp(ctx, hero, r.attackerHeroExp);
  await grantHeroExp(ctx, guard, r.defenderHeroExp);
  const g = guard ?? npcGuard;
  const injured = await woundAttackers(ctx, a, attacker, r.attacker.lost);
  battleStats(ctx, a, r, 'valley', { injured, captured: occupied, defender: owner ? { playerId: owner.id, cityId: ownerCityId } : null });
  const body = battleBody(
    r,
    {
      player: attacker.name,
      hero: heroSummary(hero),
      troops: { before: r.attacker.before, lost: r.attacker.lost, after: r.attacker.after },
      injured,
      ...(await attackerBonuses(ctx, attacker, a)),
    },
    {
      player: defenderName,
      hero: g ? { id: 0, name: g.name, level: g.level, logoUrl: g.logoUrl } : null,
      troops: { before: r.defender.before, lost: r.defender.lost, after: r.defender.after },
      ...(owner ? battleBonuses(owner, ctx.now) : {}),
    },
    { occupied, reason, valley: { type: tile.type, level: tile.level } },
  );
  const common = { armyType: Mission.ATTACK, startPos: a.startPosName, targetPos: a.targetPosName, body };
  await createReport(ctx, {
    ...common,
    playerId: a.playerId,
    title: msg(r.attackerWon ? (occupied ? 'report.title.valleyOccupied' : 'report.title.attackSucceeded') : 'report.title.attackFailed'),
    isAttack: true,
  });
  if (defenderId)
    await createReport(ctx, { ...common, playerId: defenderId, title: msg(occupied ? 'report.title.valleyLost' : 'report.title.valleyDefended') });
  if (totalTroops(r.attacker.after) <= 0) {
    await armyWiped(ctx, a, hero, null);
    return;
  }
  await returnWithLoot(ctx, a, r.attacker.after, { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 });
}

/** Both the old and the new owner city change production when a valley changes hands. */
async function settleValleyOwnerChange(ctx: Ctx, previousCityId: number | null, home: CityBundle) {
  await saveCity(ctx, home.city);
  pushResources(ctx, home);
  if (previousCityId) {
    const prev = await openCity(ctx, previousCityId);
    if (prev) {
      await saveCity(ctx, prev.city);
      pushResources(ctx, prev);
    }
  }
}
