// In-memory rows for the pure tests of city.ts and dto.ts (no database): every column with a plain default,
// overridden by what a test cares about.

import { BALANCE, HeroStatus, msg, TileType } from '@marchlands/core';
import { type CityBundle } from '#/city.ts';
import { type ArmyRow, type CityRow, type HeroRow, type PlayerRow, type TileRow } from '#/repo.ts';

/** game.ts's T0, without loading the database support */
export const T0 = Date.UTC(2026, 0, 1);

export function playerRow(over: Partial<PlayerRow> = {}): PlayerRow {
  return {
    id: 1,
    accountId: 1,
    name: 'Lord',
    sex: 0,
    flag: 'L',
    faceUrl: '',
    allianceId: null,
    allianceRank: 0,
    allianceJoinedAt: 0,
    prestige: 0,
    honor: 0,
    title: 0,
    beginner: true,
    status: 0,
    research: {},
    items: {},
    buffs: [],
    castleSigns: [],
    misc: {},
    population: 0,
    prestigeRank: 0,
    honorRank: 0,
    createdAt: T0,
    lastLoginAt: 0,
    lastSeenAt: 0,
    ...over,
  };
}

/** A new player's city (Town Hall 1, the starting resources and population) settled at T0. */
export function cityRow(over: Partial<CityRow> = {}): CityRow {
  const r = BALANCE.startingResources;
  return {
    id: 1,
    playerId: 1,
    tileId: 401,
    name: 'Home',
    logoUrl: 'images/icon/cityLogo/citylogo_01.png',
    status: 0,
    allowAlliance: false,
    goOutForBattle: true,
    gold: r,
    food: r,
    wood: r,
    stone: r,
    iron: r,
    resourcesAt: T0,
    population: BALANCE.startPopulation,
    taxRate: BALANCE.startTaxRate,
    buildings: [{ positionId: -1, typeId: 31, level: 1, status: 0, startTime: 0, endTime: 0 }],
    troops: {},
    injuredTroops: {},
    forts: {},
    troopQueues: [],
    fortQueue: { nextQueueId: 1, queue: [] },
    workRates: { gold: 100, food: 100, wood: 100, stone: 100, iron: 100 },
    storePercent: { gold: 0, food: 25, wood: 25, stone: 25, iron: 25 },
    misc: { lastTickAt: T0 },
    createdAt: T0,
    ...over,
  };
}

let heroSerial = 0;

export function heroRow(over: Partial<HeroRow> = {}): HeroRow {
  return {
    id: ++heroSerial,
    playerId: 1,
    cityId: 1,
    inTavern: false,
    name: 'Hero',
    logoUrl: 'images/icon/hero/1.png',
    status: HeroStatus.IDLE,
    level: 1,
    experience: 0,
    upgradeExp: 100,
    loyalty: 100,
    basePower: 10,
    baseManagement: 10,
    baseStratagem: 10,
    power: 10,
    management: 10,
    stratagem: 10,
    powerAdded: 0,
    managementAdded: 0,
    stratagemAdded: 0,
    powerBuffAdded: 0,
    managementBuffAdded: 0,
    stratagemBuffAdded: 0,
    remainPoint: 0,
    buffs: [],
    capturedByPlayerId: null,
    locked: false,
    gearStat: null,
    sortOrder: 0,
    createdAt: T0,
    ...over,
  };
}

export function tileRow(over: Partial<TileRow> = {}): TileRow {
  return {
    id: 1,
    type: TileType.FOREST,
    level: 1,
    cityId: null,
    ownerCityId: null,
    ownerPlayerId: null,
    troops: null,
    forts: null,
    state: null,
    updatedAt: 0,
    ...over,
  };
}

export function armyRow(over: Partial<ArmyRow> = {}): ArmyRow {
  return {
    id: 1,
    playerId: 1,
    cityId: 1,
    heroId: null,
    mission: 1,
    direction: 1,
    startTileId: 401,
    targetTileId: 402,
    targetPlayerId: null,
    troops: {},
    resources: { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 },
    startTime: T0,
    reachTime: T0 + 60_000,
    restTime: 0,
    startPosName: msg('world.position.city', { name: 'Home', x: 1, y: 0 }),
    targetPosName: msg('world.position.city', { name: 'There', x: 2, y: 0 }),
    createdAt: T0,
    ...over,
  };
}

/** A bundle of these rows (no valleys, no troops away unless given). */
export function bundle(over: Partial<CityBundle> = {}): CityBundle {
  return { player: playerRow(), city: cityRow(), heroes: [], valleys: [], awayTroops: {}, ...over };
}
