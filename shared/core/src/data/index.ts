// Static game configuration converted from the legacy `config_*` tables
// (tools/legacy-import/convert.mjs). Treat as read-only.

import { BuildingType, TechType } from '../constants.ts';
import type { Resources } from '../resources.ts';
import buildingRows from './legacy/buildings.json' with { type: 'json' };
import researchRows from './legacy/research.json' with { type: 'json' };
import troopRows from './legacy/troops.json' with { type: 'json' };
import itemRows from './legacy/items.json' with { type: 'json' };
import questRows from './legacy/quests.json' with { type: 'json' };

export interface Prereq {
  id: number;
  level: number;
}
export interface Requirements {
  buildings: Prereq[];
  items: Prereq[];
  techs: Prereq[];
}
export interface BuildingLevelConfig {
  typeId: number;
  level: number;
  /** seconds */
  buildTime: number;
  cost: Resources;
  requires: Requirements;
  /** 1 = inside the castle, 2 = outside (fields), 3 = walls/fortification */
  inside: number;
  /** max count per city (0 = unlimited) */
  limit: number;
}
export interface ResearchLevelConfig {
  techId: number;
  level: number;
  buildTime: number;
  cost: Resources;
  requires: Requirements;
}
export interface TroopConfig {
  troopId: number;
  buildTime: number;
  population: number;
  cost: Resources;
  /** 1 = troop (barracks), 2 = fortification (walls) */
  inside: number;
  requires: Requirements;
  life: number;
  attack: number;
  defense: number;
  load: number;
  /** food per hour */
  upkeep: number;
  speed: number;
  range: number;
}
export interface ItemConfig {
  legacyId: number;
  id: string;
  name: string;
  cost: number;
  buyable: boolean;
  canGamble: boolean;
  type: number;
  dayLimit: number;
  rarity: number;
}
export interface QuestConfig {
  id: number;
  mainId: number;
  isFinish: boolean;
  description: string;
  name: string;
  typeId: number;
  requires: { buildings: number[]; items: number[]; techs: number[]; quests: number[] };
}

// (marchlands) the original's level-10 upgrades also needed a Michelangelo's Script item; here they
// need only resources, time and the usual prerequisites (the Script is removed)
export const BUILDINGS = (buildingRows as BuildingLevelConfig[]).map((b) => (!b.requires.items.length ? b : { ...b, requires: { ...b.requires, items: [] } }));
/**
 * (marchlands) Hero Enhancement (gear.ts): twice Military Science's cost and time, level N needs Academy level N.
 */
const HERO_ENHANCEMENT_RESEARCH: ResearchLevelConfig[] = (researchRows as ResearchLevelConfig[])
  .filter((r) => r.techId === TechType.MILITARY_SCIENCE)
  .map((r) => ({
    techId: TechType.HERO_ENHANCEMENT,
    level: r.level,
    buildTime: r.buildTime * 2,
    cost: Object.fromEntries(Object.entries(r.cost).map(([k, v]) => [k, (v as number) * 2])) as ResearchLevelConfig['cost'],
    requires: { buildings: [{ id: BuildingType.ACADEMY, level: r.level }], items: [], techs: [] },
  }));
export const RESEARCH = [...(researchRows as ResearchLevelConfig[]), ...HERO_ENHANCEMENT_RESEARCH];
export const TROOPS = troopRows as TroopConfig[];
/** (marchlands) legacy items removed from this game: never sold, won or granted */
export const REMOVED_ITEMS: readonly string[] = [
  // Merchant Fleet: halved market shipment time (market trades settle instantly here)
  'consume.transaction.1',
  // lockboxes and their keys: no key can be obtained, so no box can be opened
  'player.box.1',
  'player.box.2',
  'player.box.3',
  'consume.key.1',
  'consume.key.2',
  'consume.key.3',
  // the same upkeep buff as Vesta's Blessing, from past events
  'player.santa.stoptoopsupkeep',
  'player.newyear.stoptoopsupkeep',
  'player.running.shoes',
  // never sold, won or granted here
  'player.box.gambling.medal.300', // Closed Beta Awards
  'player.truce.dream',
  'player.move.castle.1.b', // Pioneer Express Teleport
  'player.box.resource.1', // Grand Resources
  'player.box.troop.1', // Superb Regiments
  'player.box.wood.1', // Wooden Chest
  'player.box.test.1', // Test Item (sold for cents, did nothing)
  // Amulet prizes nothing else gives: hero helms (a random hero) and troop battalions
  'player.box.hero.a',
  'player.box.hero.b',
  'player.box.hero.c',
  'player.box.hero.d',
  'player.box.troop.a',
  'player.box.troop.b',
  'player.box.troop.c',
  'player.box.troop.d',
  // items for things that are free here, or gone: renaming the lord (once a day) and changing the
  // flag, re-rolling the Inn (gold only), demolishing (always instant), the level-10 building
  // requirement, chat icons, the alliance member limit, and city loyalty (lords' cities have none)
  'player.name.1.a', // New ID
  'consume.changeflag.1', // National Flag
  'consume.refreshtavern.1', // Hero Hunting
  'player.destroy.1.a', // Dynamite
  'consume.blueprint.1', // Michelangelo's Script
  'player.speak.bronze_publicity_ambassador.permanent',
  'player.speak.bronze_publicity_ambassador.permanent.15',
  'player.speak.silver_publicity_ambassador.15',
  'player.speak.silver_publicity_ambassador.permanent',
  'player.speak.gold_publicity_ambassador.15',
  'player.speak.gold_publicity_ambassador.permanent',
  'consume.hegemony.1', // Ritual of Pact
  'alliance.ritual_of_pact.advanced',
  'alliance.ritual_of_pact.premium',
  'alliance.ritual_of_pact.ultimate',
  'player.heart.1.a', // Speech Text
  'hero.reset.1.a', // Holy Water (5 pieces package)
  'player.more.castle.1.a', // Adv City Teleporter: the City Teleporter now picks the tile
  // Speakers (and their 10 / 100 packs): World chat is free
  'consume.1.a',
  'consume.1.b',
  'consume.1.c',
];
/**
 * (marchlands) legacy item families removed from this game: event, promotion and compensation packages
 * (every gift package but the Newbies Package each new lord gets), event keys and tokens, and the Amulet
 * (a gamble) with every copy of it and its prizes (player.box.gambling.*)
 */
const REMOVED_ITEM_PATTERNS: readonly RegExp[] = [
  /^player\.box\.present\.(?!2$)/,
  /^player\.box\.(compensation|merger|evony|toolbarbonus)/,
  /^player\.key\./,
  /^player\.(halloween|cupid|irish|easter)\./,
  /^player\.box\.gambling\./,
];
export const isRemovedItem = (id: string) => REMOVED_ITEMS.includes(id) || REMOVED_ITEM_PATTERNS.some((r) => r.test(id));
/** (marchlands) items this game adds to the legacy ones (sold for city gold, BALANCE.goldShop) */
const EXTRA_ITEMS: ItemConfig[] = [
  {
    legacyId: 0,
    id: 'player.reduce.troops.upkeep.7',
    name: "Vesta's Grand Blessing",
    cost: 0,
    buyable: false,
    canGamble: false,
    type: 4,
    dayLimit: 0,
    rarity: 0,
  },
  { legacyId: 0, id: 'player.reduce.troops.cost.1', name: "Quartermaster's Seal", cost: 0, buyable: false, canGamble: false, type: 4, dayLimit: 0, rarity: 0 },
  {
    legacyId: 0,
    id: 'player.reduce.troops.cost.7',
    name: "Quartermaster's Charter",
    cost: 0,
    buyable: false,
    canGamble: false,
    type: 4,
    dayLimit: 0,
    rarity: 0,
  },
];
export const ITEMS = [...(itemRows as ItemConfig[]).filter((i) => !isRemovedItem(i.id)), ...EXTRA_ITEMS];
export const QUESTS = questRows as QuestConfig[];

const buildingIndex = new Map<string, BuildingLevelConfig>(BUILDINGS.map((b) => [`${b.typeId}:${b.level}`, b]));
const researchIndex = new Map<string, ResearchLevelConfig>(RESEARCH.map((r) => [`${r.techId}:${r.level}`, r]));
const troopIndex = new Map<number, TroopConfig>(TROOPS.map((t) => [t.troopId, t]));
const itemIndex = new Map<string, ItemConfig>(ITEMS.map((i) => [i.id, i]));

/** Config for upgrading/constructing a building *to* `level`. */
export function buildingConfig(typeId: number, level: number): BuildingLevelConfig | undefined {
  return buildingIndex.get(`${typeId}:${level}`);
}
export function buildingMaxLevel(typeId: number): number {
  let max = 0;
  for (const b of BUILDINGS) if (b.typeId === typeId && b.level > max) max = b.level;
  return max;
}
export function isBuildingType(typeId: number): boolean {
  return buildingIndex.has(`${typeId}:1`);
}
export function researchConfig(techId: number, level: number): ResearchLevelConfig | undefined {
  return researchIndex.get(`${techId}:${level}`);
}
export function researchMaxLevel(techId: number): number {
  let max = 0;
  for (const r of RESEARCH) if (r.techId === techId && r.level > max) max = r.level;
  return max;
}
export const TECH_IDS: number[] = [...new Set(RESEARCH.map((r) => r.techId))].sort((a, b) => a - b);

export function troopConfig(troopId: number): TroopConfig | undefined {
  return troopIndex.get(troopId);
}
export function itemConfig(id: string): ItemConfig | undefined {
  return itemIndex.get(id);
}
