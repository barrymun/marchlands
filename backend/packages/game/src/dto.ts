// Client-facing JSON shapes. They follow the original "beans" (castleBean, playerInfo, ...)
// so a client port stays easy, with the original's misspellings corrected
// (storeRercent -> storePercent, texRate -> taxRate, caslteId -> castleId, ...).

import {
  BUILDING_NAMES,
  BASIC_RESOURCES,
  FORT_KEY_LIST,
  TROOP_KEY_LIST,
  populationDirection,
  stateOf,
  stateName,
  tileXY,
  titleOf,
  type CityStats,
  type FortCounts,
  type TroopCounts,
} from '@evony/core';
import { cityStats, type CityBundle } from './city.ts';
import type { ArmyRow, CityRow, HeroRow, PlayerRow, TileRow } from './repo.ts';

export const troopBean = (t: TroopCounts) => Object.fromEntries(TROOP_KEY_LIST.map((k) => [k, Math.floor(t[k] ?? 0)]));
export const fortBean = (f: FortCounts) => Object.fromEntries(FORT_KEY_LIST.map((k) => [k, Math.floor(f[k] ?? 0)]));

export function buildingBean(b: CityRow['buildings'][number]) {
  return {
    positionId: b.positionId,
    typeId: b.typeId,
    name: BUILDING_NAMES[b.typeId] ?? 'Unknown',
    level: b.level,
    status: b.status,
    startTime: b.startTime,
    endTime: b.endTime,
  };
}

export function heroBean(h: HeroRow) {
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
    seized: h.capturedByPlayerId != null,
  };
}

export function resourceBean(b: CityBundle, stats: CityStats) {
  const c = b.city;
  const res = (r: (typeof BASIC_RESOURCES)[number]) => ({
    amount: Math.floor(c[r]),
    max: stats.storage[r],
    storePercent: c.storePercent[r] ?? 0,
    workRate: c.workRates[r] ?? 100,
    workPeople: stats.workers[r],
    /** net change per hour (food is after troop upkeep) */
    increaseRate: Math.round(stats.rates[r]),
    bonusPercent: Math.round(stats.bonus[r] * 100),
  });
  return {
    gold: Math.floor(c.gold),
    goldRate: Math.round(stats.rates.gold),
    food: res('food'),
    wood: res('wood'),
    stone: res('stone'),
    iron: res('iron'),
    taxRate: c.taxRate,
    taxIncome: Math.round(stats.taxIncome),
    herosSalary: stats.heroSalary,
    troopCostFood: Math.round(stats.upkeep),
    curPopulation: Math.floor(c.population),
    maxPopulation: stats.maxPopulation,
    idlePopulation: stats.idlePopulation,
    workPeople: stats.workersNeeded,
    efficiency: Math.round(stats.efficiency * 100),
    support: Math.floor(c.loyalty),
    complaint: Math.floor(c.grievance),
    populationDirection: populationDirection(c, stats),
    updatedAt: c.resourcesAt,
  };
}

export function cityBean(b: CityBundle, now: number) {
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
    zoneName: stateName(stateOf(c.tileId)),
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
    createdAt: c.createdAt,
  };
}

export function valleyBean(t: TileRow) {
  const { x, y } = tileXY(t.id);
  return { id: t.id, x, y, type: t.type, level: t.level, ownerCityId: t.ownerCityId };
}

export function playerInfo(p: PlayerRow, extras: { allianceName?: string; cityCount: number; population?: number }) {
  return {
    id: p.id,
    userName: p.name,
    sex: p.sex,
    flag: p.flag,
    faceUrl: p.faceUrl,
    prestige: Math.floor(p.prestige),
    honor: Math.floor(p.honor),
    medal: p.cents,
    cents: p.cents,
    titleId: p.title,
    titleName: titleOf(p.title).name,
    ranking: p.prestigeRank,
    honorRank: p.honorRank,
    allianceId: p.allianceId,
    alliance: extras.allianceName ?? '',
    levelId: p.allianceRank,
    castleCount: extras.cityCount,
    population: extras.population ?? p.population,
    beginner: p.beginner,
    status: p.status,
    icon: p.misc.icon ?? 0,
    changedFace: p.misc.changedFace ?? false,
    createrTime: p.createdAt,
    lastLoginTime: p.lastLoginAt,
  };
}

export function itemsArray(items: PlayerRow['items']) {
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buffsArray(buffs: PlayerRow['buffs'], now: number) {
  return buffs.filter((b) => b.endTime > now).map((b) => ({ id: b.id, desc: b.desc, endTime: b.endTime, param: b.param, cityId: b.cityId }));
}

export function armyBean(a: ArmyRow, extra: { heroName?: string; heroLevel?: number; king?: string; visible?: boolean } = {}) {
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
