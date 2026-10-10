// Army arrival: transport, reinforcement, scouting, colonising and attacking (player cities,
// barbarian cities and valleys), plus armies coming home. The original only implemented
// valley/NPC scouting and a scout-vs-scout fight; everything else follows Evony Age 1 and the
// recommendations in docs/spec/battle.md §7.3.

import { count, eq } from 'drizzle-orm';
import {
  ArmyDirection,
  BALANCE,
  BuildingStatus,
  BuildingType,
  buildingLevel,
  createGuardHero,
  freshNpcState,
  GameError,
  HeroStatus,
  maxCitiesFor,
  maxValleysFor,
  Mission,
  npcBuildings,
  plunder,
  protectedResources,
  randInt,
  injuredOf,
  rollMedalDrops,
  seededRng,
  regenerateNpc,
  researchLevel,
  resolveCombat,
  scaled,
  TechType,
  TileType,
  TROOP_KEY_LIST,
  addTroops,
  armyLoad,
  heroPower,
  itemEffect,
  maxArmyTroops,
  totalResources,
  totalTroops,
  valleyGarrison,
  VALLEY_TYPES,
  valleyUpgradeCost,
  type BattleExtra,
  type BuildingState,
  type CombatResult,
  type FortCounts,
  type NpcState,
  type ReportBody,
  type ResourceSet,
  type TroopCounts,
  addHeroExp,
  BuffId,
  HeroBuffId,
} from '@marchlands/core';
import { armies, cities, heroes, tiles } from '@marchlands/db';
import { openCity, openOwnCity, viewCity, type CityBundle } from '../city.ts';
import type { Ctx } from '../context.ts';
import { fortBean, heroBean, troopBean } from '../dto.ts';
import { addItem, addPrestige, activeBuff, gainResources, pushCity, pushResources } from '../helpers.ts';
import { prefixed } from '../stats.ts';
import {
  armiesStationedAt,
  citiesOf,
  findCity,
  getArmy,
  getHero,
  getPlayer,
  getTile,
  lockPlayers,
  saveArmy,
  saveCity,
  saveHero,
  savePlayer,
  saveTile,
  type ArmyRow,
  type HeroRow,
  type PlayerRow,
  type TileRow,
} from '../repo.ts';
import { armyRef, homeMarchMs, notifyArmyParties, posName, sendBack, tileOwner } from './armies.ts';
import { heroSlots, pushHero } from './heroes.ts';
import { initialCity, isProtected } from './player.ts';
import { isFriendly, relationBetween } from './relations.ts';
import { createReport, ReportType } from './reports.ts';

// ---------------------------------------------------------------------------------------------
// Entry point (timed event "army")
// ---------------------------------------------------------------------------------------------

export async function processArmy(ctx: Ctx, armyId: number) {
  const peek = await getArmy(ctx, armyId);
  if (!peek) return;
  if (peek.direction === ArmyDirection.STAY) {
    // camping with a time limit: go home once it is over
    if (peek.restTime > 0 && ctx.now >= peek.reachTime + peek.restTime) {
      const a = (await getArmy(ctx, armyId, { lock: true }))!;
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
      return turnBack(ctx, a, 'Unknown mission.');
  }
}

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

async function deleteArmy(ctx: Ctx, a: ArmyRow) {
  await ctx.tx.delete(armies).where(eq(armies.id, a.id));
  ctx.unschedule(armyRef(a.id));
}

async function turnBack(ctx: Ctx, a: ArmyRow, reason: string) {
  await sendBack(ctx, a, await homeMarchMs(ctx, a, a.targetTileId));
  await createReport(ctx, {
    playerId: a.playerId,
    title: 'Mission aborted',
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

/** Proportionally shrink several troop groups so their per-type totals equal `after`. */
export function distributeLosses(groups: TroopCounts[], before: TroopCounts, after: TroopCounts): TroopCounts[] {
  const out = groups.map((g) => ({ ...g }));
  for (const k of TROOP_KEY_LIST) {
    const b = before[k] ?? 0;
    if (b <= 0) continue;
    const target = after[k] ?? 0;
    let assigned = 0;
    for (const g of out) {
      const v = Math.floor(((g[k] ?? 0) * target) / b);
      g[k] = v;
      assigned += v;
    }
    // hand out the rounding remainder to the largest groups
    let rest = target - assigned;
    const order = out.map((g, i) => i).sort((x, y) => (groups[y][k] ?? 0) - (groups[x][k] ?? 0));
    for (const i of order) {
      if (rest <= 0) break;
      if ((out[i][k] ?? 0) < (groups[i][k] ?? 0)) {
        out[i][k] = (out[i][k] ?? 0) + 1;
        rest--;
      }
    }
  }
  return out.map((g) => Object.fromEntries(Object.entries(g).filter(([, v]) => (v ?? 0) > 0)) as TroopCounts);
}

function sumTroops(list: TroopCounts[]): TroopCounts {
  return list.reduce((acc, t) => addTroops(acc, t), {} as TroopCounts);
}

async function grantHeroExp(ctx: Ctx, h: HeroRow | null | undefined, exp: number) {
  if (!h || exp <= 0) return;
  addHeroExp(h, exp);
  await saveHero(ctx, h);
  if (h.playerId) pushHero(ctx, h.playerId, h, 2);
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

const buffBonus = (p: PlayerRow, id: BuffId, now: number) => (activeBuff(p, id, now) ? 0.2 : 0);

/** (marchlands) The attack / defense item bonuses that count in a battle, for its report. */
function battleBonuses(p: PlayerRow, now: number): { bonuses?: { desc: string; itemId?: string }[] } {
  const list = [BuffId.ATTACK, BuffId.DEFENSE]
    .map((id) => activeBuff(p, id, now))
    .filter((b) => b != null)
    .map((b) => ({ desc: b.desc, ...(b.itemId ? { itemId: b.itemId } : {}) }));
  return list.length ? { bonuses: list } : {};
}

const WAR_ENSIGN = 'player.troop.1.a';

/**
 * (marchlands) The attacker's item bonuses for its report: battleBonuses, plus the War Ensign when the army is
 * larger than its home Rally Spot allows without one (the Ensign let it march that size).
 */
async function attackerBonuses(ctx: Ctx, p: PlayerRow, a: ArmyRow): Promise<{ bonuses?: { desc: string; itemId?: string }[] }> {
  const list = battleBonuses(p, ctx.now).bonuses ?? [];
  const home = await findCity(ctx, a.cityId);
  if (home && totalTroops(a.troops) > maxArmyTroops(home.buildings)) {
    const ensign = itemEffect(WAR_ENSIGN);
    list.push({ desc: ensign?.kind === 'buff' ? ensign.desc : 'Army +25% troops', itemId: WAR_ENSIGN });
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
  const b = (await openCity(ctx, homeId))!;
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
  ctx.push(a.playerId, 'server.TroopUpdate', { castleId: homeId, troop: troopBean(b.city.troops) });
  pushResources(ctx, b);
  await createReport(ctx, {
    playerId: a.playerId,
    title: a.mission === Mission.SCOUT ? 'Scout Returned' : a.mission === Mission.ATTACK ? 'Attack Returned' : 'Returned',
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
  if (!t) return turnBack(ctx, a, 'The destination is no longer a friendly city.');
  gainResources(t.b.city, a.resources);
  await saveCity(ctx, t.b.city);
  pushResources(ctx, t.b);
  const body = { kind: 'trade' as const, trade: { from: sender.name, to: t.b.player.name, resources: a.resources } };
  await createReport(ctx, {
    playerId: a.playerId,
    typeId: ReportType.TRADE,
    title: 'Transport Report',
    armyType: a.mission,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
    body,
  });
  if (t.b.player.id !== a.playerId) {
    await createReport(ctx, {
      playerId: t.b.player.id,
      typeId: ReportType.TRADE,
      title: 'Transport Received',
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
    if (tile.ownerPlayerId !== a.playerId) return turnBack(ctx, a, 'You no longer control this valley.');
    return station(ctx, a);
  }
  const t = await friendlyCityAt(ctx, a);
  if (!t) return turnBack(ctx, a, 'The destination is no longer a friendly city.');
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
    ctx.push(a.playerId, 'server.TroopUpdate', { castleId: t.b.city.id, troop: troopBean(t.b.city.troops) });
    pushResources(ctx, t.b);
    await createReport(ctx, {
      playerId: a.playerId,
      typeId: ReportType.OTHER,
      title: 'Reinforcement Arrived',
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
    title: `Reinforcements from ${sender.name}`,
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
  const [{ n }] = await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, a.playerId));
  if (tile.type !== TileType.FLAT || tile.cityId != null || tile.ownerCityId != null) return turnBack(ctx, a, 'The land is no longer free.');
  if (Number(n) >= maxCitiesFor(settler.title)) return turnBack(ctx, a, 'Your title does not allow more cities.');
  const name = `${settler.name.slice(0, 12)} ${Number(n) + 1}`;
  const base = initialCity(a.playerId, tile.id, name, ctx.now);
  const [city] = await ctx.tx
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
    .returning();
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
    title: 'New City Founded',
    armyType: a.mission,
    startPos: a.startPosName,
    targetPos: posName(name, tile.id),
    body: { kind: 'text', text: `${name} has been founded.` },
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
 */
function guardHeroOf(ctx: Ctx, state: Record<string, number>, maxLevel: number, reroll = false) {
  if (reroll || state.heroSeed == null) state.heroSeed = randInt(ctx.rng, 1, 2_147_483_646);
  return createGuardHero(maxLevel, seededRng(`guard:${state.heroSeed}`));
}

/** Lazily (re)generate an unowned valley's garrison: regenerates 6 minutes after it was last touched. */
function valleyDefenders(ctx: Ctx, tile: TileRow): TroopCounts {
  const stale = !tile.troops || ctx.now - (tile.state?.regenAt ?? 0) >= regenMs();
  if (stale) {
    tile.troops = valleyGarrison(tile.level, ctx.rng);
    tile.state = { ...(tile.state ?? {}), regenAt: ctx.now };
  }
  return tile.troops!;
}

function npcState(ctx: Ctx, tile: TileRow): { state: NpcState; troops: TroopCounts; forts: FortCounts } {
  if (!tile.state || tile.state.regenAt == null || !tile.troops) {
    const fresh = freshNpcState(tile.level, ctx.now);
    return fresh;
  }
  return regenerateNpc(tile.level, tile.state as unknown as NpcState, tile.troops, tile.forts ?? {}, ctx.now);
}

async function arriveScout(ctx: Ctx, a: ArmyRow, scoutOwner: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  const hero = await heroOf(ctx, a);
  const reportBase = {
    playerId: a.playerId,
    title: 'Scout Report',
    armyType: Mission.SCOUT,
    isAttack: true,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
  };

  if (tile.cityId == null && tile.type === TileType.NPC) {
    const npc = npcState(ctx, tile);
    const state = { ...(npc.state as unknown as Record<string, number>), heroSeed: tile.state?.heroSeed } as Record<string, number>;
    const guard = guardHeroOf(ctx, state, tile.level * 10, true);
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
      defenders = valleyDefenders(ctx, tile);
      guard = guardHeroOf(ctx, (tile.state ??= {}), VALLEY_GUARD_LEVEL, true);
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
  if (!def) return turnBack(ctx, a, 'The city no longer exists.');
  const stationed = await armiesStationedAt(ctx, tile.id, { lock: true });
  const cityScouts = def.city.goOutForBattle ? (def.city.troops.scouter ?? 0) : 0;
  const defScouts = cityScouts + stationed.reduce((s, x) => s + (x.troops.scouter ?? 0), 0);
  const defHero = bestHero([...def.heroes.filter((h) => h.playerId === def.player.id && (h.status === 0 || h.status === 1))]);
  const result = resolveCombat(
    { troops: { scouter: a.troops.scouter ?? 0 }, research: scoutOwner.research, hero },
    { troops: { scouter: defScouts }, research: def.player.research, hero: defHero },
    ctx.rng,
  );
  const survivors = result.attacker.after.scouter ?? 0;
  // defending scout losses spread over the city and stationed armies
  const groups = [{ scouter: cityScouts }, ...stationed.map((s) => ({ scouter: s.troops.scouter ?? 0 }))];
  const after = distributeLosses(groups, { scouter: defScouts }, result.defender.after);
  if (cityScouts > 0) def.city.troops = { ...def.city.troops, scouter: after[0].scouter ?? 0 };
  for (let i = 0; i < stationed.length; i++) {
    const s = stationed[i];
    s.troops = { ...s.troops, scouter: after[i + 1].scouter ?? 0 };
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
    title: success ? 'Enemy Scouts' : 'Scouts Repelled',
    armyType: Mission.SCOUT,
    startPos: a.startPosName,
    targetPos: a.targetPosName,
    body: { kind: 'scout', scout: { target: 'city', from: scoutOwner.name, success, battle } },
  });
  if (cityScouts > 0) ctx.push(def.player.id, 'server.TroopUpdate', { castleId: def.city.id, troop: troopBean(def.city.troops) });
  if (!success) return armyWiped(ctx, a, hero, def);
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
 * free Feasting Hall slot (chance: d100 > loyalty); otherwise it limps home at once.
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
        powerBuffAdded: 0,
        managementBuffAdded: 0,
        stratagemBuffAdded: 0,
        buffs: [{ id: HeroBuffId.HOME_CITY, desc: 'home city', endTime: Number.MAX_SAFE_INTEGER, param: home }],
      });
      captured = true;
      pushHero(ctx, captor.player.id, hero, 0);
      ctx.push(a.playerId, 'server.HeroUpdate', { castleId: home, hero: heroBean(hero), updateType: 1 });
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
  bonuses?: { desc: string; itemId?: string }[];
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
  const fortsLost = r.forts?.lost ?? {};
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
  ctx.push(home.player.id, 'server.InjuredTroopUpdate', { castleId: home.city.id, troop: troopBean(home.city.injuredTroops) });
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
  if (tile.type !== TileType.FLAT) return attackValley(ctx, a, attacker);
  return turnBack(ctx, a, 'There was nothing to attack.');
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
  if (!def) return turnBack(ctx, a, 'The city no longer exists.');
  const relation = await relationBetween(ctx, a.playerId, def.player.id);
  if (isFriendly(relation)) return turnBack(ctx, a, 'The city now belongs to a friend.');
  const why = isProtected(def.player, ctx.now);
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
  // apply defender losses
  const afterGroups = distributeLosses(groups, defTroops, r.defender.after);
  if (def.city.goOutForBattle) {
    const lost = addTroops(def.city.troops, afterGroups[0], -1);
    def.city.troops = afterGroups[0];
    // Medicine: part of the city's own fallen recover as injured
    defenderInjured = injuredOf(lost, def.player.research);
    def.city.injuredTroops = addTroops(def.city.injuredTroops, defenderInjured);
  }
  for (let i = 0; i < stationed.length; i++) {
    const s = stationed[i];
    s.troops = afterGroups[i + 1];
    if (totalTroops(s.troops) <= 0) await disbandEmptyArmy(ctx, s);
    else await saveArmy(ctx, s);
  }
  def.city.forts = r.forts.after;

  // spoils; (marchlands) lords' cities have no loyalty, so they are plundered but never captured
  let loot: ResourceSet = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
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
  });
  const reportCommon = { armyType: Mission.ATTACK, startPos: a.startPosName, targetPos: a.targetPosName, body };
  await createReport(ctx, { ...reportCommon, playerId: a.playerId, title: r.attackerWon ? 'Attack Succeeded' : 'Attack Failed', isAttack: true });
  await createReport(ctx, { ...reportCommon, playerId: def.player.id, title: r.attackerWon ? 'City Attacked' : 'Attack Repelled' });
  for (const owner of new Set(stationed.map((s) => s.playerId).filter((id) => id !== def.player.id))) {
    await createReport(ctx, { ...reportCommon, playerId: owner, title: 'Reinforcements Fought' });
  }
  ctx.push(def.player.id, 'server.TroopUpdate', { castleId: def.city.id, troop: troopBean(def.city.troops) });
  ctx.push(def.player.id, 'server.FortificationsUpdate', { castleId: def.city.id, fortification: fortBean(def.city.forts) });
  pushResources(ctx, def);
  if (totalTroops(r.attacker.after) <= 0) {
    await armyWiped(ctx, a, hero, def);
    return;
  }
  await returnWithLoot(ctx, a, r.attacker.after, loot);
}

async function attackNpc(ctx: Ctx, a: ArmyRow, attacker: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  const hero = await heroOf(ctx, a);
  const npc = npcState(ctx, tile);
  const seedHolder = { heroSeed: tile.state?.heroSeed } as Record<string, number>;
  const guard = guardHeroOf(ctx, seedHolder, tile.level * 10);
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
  const state = { ...npc.state, heroSeed: seedHolder.heroSeed };
  if (r.attackerWon) {
    loot = plunder({ gold: state.gold, food: state.food, wood: state.wood, stone: state.stone, iron: state.iron }, lootCapacity(a, r.attacker.after, attacker));
    for (const k of Object.keys(loot) as (keyof ResourceSet)[]) state[k] -= loot[k];
    const [lo, hi] = BALANCE.npcLoyaltyDamagePerAttack;
    loyaltyDamage = randInt(ctx.rng, lo, hi);
    state.loyalty = Math.max(0, state.loyalty - loyaltyDamage);
  }
  Object.assign(tile, { troops: r.defender.after, forts: r.forts.after, state: state as unknown as Record<string, number>, updatedAt: ctx.now });
  if (r.attackerWon && state.loyalty <= 0) {
    const [{ n }] = await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, attacker.id));
    if (Number(n) < maxCitiesFor(attacker.title)) {
      captured = true;
      await captureNpc(ctx, attacker, tile, state);
    }
  }
  if (!captured) await saveTile(ctx, tile);
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
      player: "Barbarian's City",
      hero: { id: 0, name: guard.name, level: guard.level, logoUrl: guard.logoUrl },
      troops: { before: r.defender.before, lost: r.defender.lost, after: r.defender.after },
      forts: r.forts,
      wallLevel: tile.level,
    },
    { plunder: loot, loyaltyDamage, loyaltyLeft: Math.floor(state.loyalty), captured, level: tile.level, ...(Object.keys(medals).length ? { medals } : {}) },
  );
  await createReport(ctx, {
    playerId: a.playerId,
    title: r.attackerWon ? 'Attack Succeeded' : 'Attack Failed',
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

/** NPC building layout (orig NpcCity::SetupBuildings) as real buildings of a captured city. */
export function npcCityBuildings(level: number): BuildingState[] {
  const b = (positionId: number, typeId: number): BuildingState => ({ positionId, typeId, level, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 });
  const out = [b(-1, 31), b(-2, 32)];
  [25, 22, 28, 27, 23, 30, 20, 21, 29, 24, 26, 2].forEach((t, i) => out.push(b(i, t)));
  for (let p = 12; p <= 31; p++) out.push(b(p, 1));
  const fields = Math.min(37, 10 + 3 * (level - 1));
  for (let i = 0; i < fields; i++) out.push(b(1001 + i, 7));
  out.push(b(1001 + fields, 4), b(1002 + fields, 5), b(1003 + fields, 6));
  return out;
}

async function captureNpc(ctx: Ctx, attacker: PlayerRow, tile: TileRow, state: NpcState) {
  const name = `${attacker.name.slice(0, 12)} Keep`;
  const base = initialCity(attacker.id, tile.id, name, ctx.now);
  const [city] = await ctx.tx
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
    .returning();
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
  pushCity(ctx, await viewCity(ctx, city.id));
  addPrestige(attacker, 1000 * tile.level);
}

async function attackValley(ctx: Ctx, a: ArmyRow, attacker: PlayerRow) {
  const tile = await getTile(ctx, a.targetTileId, { lock: true });
  const ownerCityId = tile.ownerCityId ?? 0;
  const hero = await heroOf(ctx, a);
  let groups: TroopCounts[];
  let stationed: ArmyRow[] = [];
  let defenderName = 'Valley defenders';
  let defenderId: number | null = null;
  if (tile.ownerPlayerId) {
    if (tile.ownerPlayerId === a.playerId) return turnBack(ctx, a, 'You already control this valley.');
    const relation = await relationBetween(ctx, a.playerId, tile.ownerPlayerId);
    if (isFriendly(relation)) return turnBack(ctx, a, 'The valley now belongs to a friend.');
    stationed = await armiesStationedAt(ctx, tile.id, { lock: true });
    groups = stationed.map((s) => s.troops);
    defenderId = tile.ownerPlayerId;
    defenderName = (await getPlayer(ctx, defenderId)).name;
  } else groups = [valleyDefenders(ctx, tile)];
  const defTroops = sumTroops(groups);
  const owner = defenderId ? await getPlayer(ctx, defenderId) : null;
  const stationedHeroes = await heroesOfArmies(ctx, stationed);
  const guard = owner ? bestHero(stationedHeroes) : null;
  const npcGuard = owner ? null : guardHeroOf(ctx, (tile.state ??= {}), VALLEY_GUARD_LEVEL);
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
  const afterGroups = distributeLosses(groups, defTroops, r.defender.after);
  if (owner) {
    for (let i = 0; i < stationed.length; i++) {
      const s = stationed[i];
      s.troops = afterGroups[i];
      if (totalTroops(s.troops) <= 0) await disbandEmptyArmy(ctx, s);
      else await saveArmy(ctx, s);
    }
    owner.honor += r.defenderHonor;
    await savePlayer(ctx, owner);
  } else tile.troops = afterGroups[0];

  let occupied = false;
  let reason = '';
  if (r.attackerWon) {
    const home = await homeBundle(ctx, a);
    if (!home) reason = 'Your city no longer exists.';
    else {
      const th = buildingLevel(home.city.buildings, BuildingType.TOWN_HALL);
      const [{ n }] = await ctx.tx.select({ n: count() }).from(tiles).where(eq(tiles.ownerCityId, home.city.id));
      if (Number(n) >= maxValleysFor(th)) reason = 'Your Town Hall level does not allow another valley.';
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
    title: r.attackerWon ? (occupied ? 'Valley Occupied' : 'Attack Succeeded') : 'Attack Failed',
    isAttack: true,
  });
  if (defenderId) await createReport(ctx, { ...common, playerId: defenderId, title: occupied ? 'Valley Lost' : 'Valley Defended' });
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

/** field.giveUpField: release a valley the city occupies; its garrison comes home. */
export async function abandonValley(ctx: Ctx, playerId: number, tileId: number) {
  const peek = await getTile(ctx, tileId);
  if (peek.ownerPlayerId !== playerId || peek.ownerCityId == null) throw new GameError('You do not control this valley.', -99);
  const b = await openOwnCity(ctx, playerId, peek.ownerCityId);
  const tile = await getTile(ctx, tileId, { lock: true });
  for (const s of await armiesStationedAt(ctx, tileId, { lock: true })) await sendBack(ctx, s, await homeMarchMs(ctx, s, tileId));
  Object.assign(tile, { ownerCityId: null, ownerPlayerId: null, troops: null, state: null, updatedAt: ctx.now });
  await saveTile(ctx, tile);
  b.valleys = b.valleys.filter((v) => v.id !== tileId);
  await saveCity(ctx, b.city);
  pushResources(ctx, b);
}

/**
 * Raise an unowned valley or barbarian city one level, paid in gold by one of the lord's cities (instant). Its
 * garrison regenerates at the new level the next time it is scouted or attacked.
 */
export async function upgradeValley(ctx: Ctx, playerId: number, cityId: number, tileId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const tile = await getTile(ctx, tileId, { lock: true });
  const npc = tile.type === TileType.NPC;
  if ((!VALLEY_TYPES.includes(tile.type) && !npc) || tile.cityId != null) throw new GameError('Only valleys and barbarian cities can be upgraded.', -99);
  if (tile.ownerCityId != null) throw new GameError('Only valleys nobody holds can be upgraded.', -99);
  const what = npc ? 'barbarian city' : 'valley';
  const cost = valleyUpgradeCost(tile.level);
  if (cost == null) throw new GameError(`This ${what} is already level ${tile.level}, the highest.`, -99);
  if (b.city.gold < cost) throw new GameError(`Not enough gold: ${cost.toLocaleString('en')} needed.`, -99);
  b.city.gold -= cost;
  ctx.stat(b.player.id, b.city.id, { 'spent.valleys.gold': cost });
  // the garrison, fortifications, resources and hero start afresh at the new level
  Object.assign(tile, { level: tile.level + 1, troops: null, forts: null, state: null, updatedAt: ctx.now });
  await saveTile(ctx, tile);
  await saveCity(ctx, b.city);
  pushResources(ctx, b);
  return { tileId, level: tile.level, gold: cost, nextCost: valleyUpgradeCost(tile.level) };
}
