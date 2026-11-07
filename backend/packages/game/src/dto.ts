// Client-facing JSON shapes. They follow the original "beans" (castleBean, playerInfo, ...)
// so a client port stays easy, with the original's misspellings corrected
// (storeRercent -> storePercent, texRate -> taxRate, caslteId -> castleId, ...).

import type {
  ArmyBean,
  BuffBean,
  BuildingBean,
  CityBean,
  FortBean,
  HeroBean,
  ItemCount,
  PlayerInfo,
  ResourceBean,
  TroopBean,
  ValleyBean,
} from '@marchlands/contracts';
import {
  BALANCE,
  BASIC_RESOURCES,
  type CityStats,
  draftedToday,
  draftsUsed,
  FORT_KEY_LIST,
  type FortCounts,
  heroGearStat,
  populationDirection,
  ResourceKey,
  seatLoyalty,
  Sex,
  stateOf,
  tileXY,
  TROOP_KEY_LIST,
  type TroopCounts,
} from '@marchlands/core';

import { type CityBundle, cityStats } from '#/city.ts';
import type { ArmyRow, CityRow, HeroRow, PlayerRow, TileRow } from '#/repo.ts';

export const troopBean = (t: TroopCounts): TroopBean => Object.fromEntries(TROOP_KEY_LIST.map((k) => [k, Math.floor(t[k] ?? 0)])) as TroopBean;
export const fortBean = (f: FortCounts): FortBean => Object.fromEntries(FORT_KEY_LIST.map((k) => [k, Math.floor(f[k] ?? 0)])) as FortBean;

export function buildingBean(b: CityRow['buildings'][number]): BuildingBean {
  return {
    positionId: b.positionId,
    typeId: b.typeId,
    level: b.level,
    status: b.status,
    startTime: b.startTime,
    endTime: b.endTime,
  };
}

export function heroBean(h: HeroRow): HeroBean {
  return {
    id: h.id,
    name: h.name,
    logoUrl: h.logoUrl,
    status: h.status,
    level: h.level,
    experience: Math.floor(h.experience),
    upgradeExp: h.upgradeExp,
    loyalty: h.loyalty,
    power: h.power,
    management: h.management,
    stratagem: h.stratagem,
    powerAdded: h.powerAdded,
    managementAdded: h.managementAdded,
    stratagemAdded: h.stratagemAdded,
    powerBuffAdded: h.powerBuffAdded,
    managementBuffAdded: h.managementBuffAdded,
    stratagemBuffAdded: h.stratagemBuffAdded,
    remainPoint: h.remainPoint,
    basePower: h.basePower,
    baseManagement: h.baseManagement,
    baseStratagem: h.baseStratagem,
    cityId: h.cityId,
    gearStat: heroGearStat(h),
    sex: h.sex === Sex.FEMALE ? Sex.FEMALE : Sex.MALE,
    locked: h.locked,
    buffs: h.buffs.map((b) => ({ id: b.id, desc: b.desc, endTime: b.endTime, param: b.param })),
  };
}

/** Per-hour contribution of each source to a resource's net rate (they sum to increaseRate, up to rounding). */
function productionBreakdownOf(stats: CityStats, r: (typeof BASIC_RESOURCES)[number]) {
  const fields = stats.fieldProduction[r] * stats.efficiency;
  const p = stats.bonusParts[r];
  return {
    base: BALANCE.baseProductionPerHour,
    fields: Math.round(fields),
    tech: Math.round(fields * p.tech),
    mayor: Math.round(fields * p.mayor),
    valley: Math.round(fields * p.valley),
    buff: Math.round(fields * p.buff),
    upkeep: r === ResourceKey.FOOD ? -round2(stats.upkeep) : 0,
    tax: -round2(stats.taxed[r]),
    techBonus: p.tech,
    mayorBonus: p.mayor,
    valleyBonus: p.valley,
    buffBonus: p.buff,
  };
}

/** per-game-hour rates keep 2 decimals: at high GAME_SPEED the client multiplies them back up per real hour */
const round2 = (n: number) => Math.round(n * 100) / 100;

export function resourceBean(b: CityBundle, stats: CityStats): ResourceBean {
  const c = b.city;
  const res = (r: (typeof BASIC_RESOURCES)[number]) => ({
    amount: Math.floor(c[r]),
    max: stats.storage[r],
    storePercent: c.storePercent[r] ?? 0,
    workRate: c.workRates[r] ?? 100,
    workPeople: stats.workers[r],
    /** net change per hour (food is after troop upkeep) */
    increaseRate: round2(stats.rates[r]),
    bonus: stats.bonus[r],
    breakdown: productionBreakdownOf(stats, r),
  });
  return {
    gold: Math.floor(c.gold),
    goldRate: round2(stats.rates.gold),
    food: res(ResourceKey.FOOD),
    wood: res(ResourceKey.WOOD),
    stone: res(ResourceKey.STONE),
    iron: res(ResourceKey.IRON),
    taxRate: c.taxRate,
    taxIncome: Math.round(stats.taxIncome),
    taxConverted: Math.round(stats.taxConverted),
    taxItemBonus: Math.round(stats.taxBuff),
    taxItemShare: stats.taxBuff ? BALANCE.resourceBuffBonus : 0,
    tribute: Math.round(stats.tribute),
    stateTribute: Math.round(stats.stateTribute),
    tributeShared: Math.round(stats.tributeShared),
    herosSalary: round2(stats.heroSalary),
    troopCostFood: round2(stats.upkeep),
    curPopulation: Math.floor(c.population),
    maxPopulation: stats.maxPopulation,
    idlePopulation: stats.idlePopulation,
    workPeople: stats.workersNeeded,
    efficiency: stats.efficiency,
    populationDirection: populationDirection(c, stats),
    updatedAt: c.resourcesAt,
  };
}

export function cityBean(b: CityBundle, now: number): CityBean {
  const stats = cityStats(b, now);
  const c = b.city;
  const { x, y } = tileXY(c.tileId);
  return {
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl,
    fieldId: c.tileId,
    x,
    y,
    zoneId: stateOf(c.tileId),
    status: c.status,
    allowAlliance: c.allowAlliance,
    goOutForBattle: c.goOutForBattle,
    resource: resourceBean(b, stats),
    buildings: c.buildings.map(buildingBean).sort((p, q) => p.positionId - q.positionId),
    troop: troopBean(c.troops),
    injuredTroop: troopBean(c.injuredTroops),
    fortification: fortBean(c.forts),
    heros: b.heroes.map(heroBean),
    fields: b.valleys.map(valleyBean),
    historicLevel: c.historicLevel,
    truceUntil: c.truceUntil,
    draftAuto: c.draftAuto,
    draftsUsed: draftsUsed(c, now),
    draftedToday: draftedToday(c, now),
    draftNextAt: c.draftNextAt,
    abandonAt: c.abandonAt,
    capturePrestige: c.capturePrestige,
    movedOut: c.abandonAt > 0 && c.misc.movedOutFor === c.abandonAt,
    capturedAt: c.capturedAt,
    seatLoyalty: c.historicLevel ? seatLoyalty(c.loyalty, c.loyaltyAt, now).loyalty : c.loyalty,
    createdAt: c.createdAt,
  };
}

/** @internal exported for its unit test */
export function valleyBean(t: TileRow): ValleyBean {
  const { x, y } = tileXY(t.id);
  return { id: t.id, x, y, type: t.type, level: t.level, ownerCityId: t.ownerCityId };
}

export function playerInfo(
  p: PlayerRow,
  extras: { allianceName?: string; cityCount: number; population?: number; seatTitle?: PlayerInfo['seatTitle'] },
): PlayerInfo {
  return {
    id: p.id,
    userName: p.name,
    sex: p.sex,
    flag: p.flag,
    flagColour: p.flagColour,
    faceUrl: p.faceUrl,
    prestige: Math.floor(p.prestige),
    honor: Math.floor(p.honor),
    titleId: p.title,
    seatTitle: extras.seatTitle ?? null,
    ranking: p.prestigeRank,
    honorRank: p.honorRank,
    allianceId: p.allianceId,
    alliance: extras.allianceName ?? '',
    levelId: p.allianceRank,
    castleCount: extras.cityCount,
    population: extras.population ?? p.population,
    beginner: p.beginner,
    status: p.status,
    changedFace: p.misc.changedFace ?? false,
    moveOutBlockedUntil: p.misc.moveOutBlockedUntil ?? 0,
    createrTime: p.createdAt,
    lastLoginTime: p.lastLoginAt,
  };
}

export function itemsArray(items: PlayerRow['items']): ItemCount[] {
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buffsArray(buffs: PlayerRow['buffs'], now: number): BuffBean[] {
  return buffs.filter((b) => b.endTime > now).map((b) => ({ id: b.id, desc: b.desc, endTime: b.endTime, param: b.param, cityId: b.cityId, itemId: b.itemId }));
}

export function armyBean(a: ArmyRow, extra: { heroName?: string; heroLevel?: number; king?: string; visible?: boolean } = {}): ArmyBean {
  const hidden = extra.visible === false;
  return {
    armyId: a.id,
    playerId: a.playerId,
    cityId: a.cityId,
    king: extra.king ?? '',
    hero: extra.heroName ?? '',
    heroLevel: extra.heroLevel ?? 0,
    heroId: a.heroId,
    missionType: a.mission,
    direction: a.direction,
    startFieldId: a.startTileId,
    targetFieldId: a.targetTileId,
    startPosName: a.startPosName,
    targetPosName: a.targetPosName,
    startTime: a.startTime,
    reachTime: a.reachTime,
    restTime: a.restTime,
    troop: hidden ? null : troopBean(a.troops),
    resource: hidden ? null : a.resources,
  };
}
