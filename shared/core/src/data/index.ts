// Static game configuration converted from the legacy `config_*` tables
// (tools/legacy-import/convert.mjs). Treat as read-only.

import { BALANCE } from '../balance.ts';
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

// (evony-re) the original's level-10 upgrades also need a Michelangelo's Script item; with
// BALANCE.buildingItemRequirements off they need only resources, time and the usual prerequisites
export const BUILDINGS = (buildingRows as BuildingLevelConfig[]).map((b) =>
  BALANCE.buildingItemRequirements || !b.requires.items.length ? b : { ...b, requires: { ...b.requires, items: [] } },
);
export const RESEARCH = researchRows as ResearchLevelConfig[];
export const TROOPS = troopRows as TroopConfig[];
export const ITEMS = itemRows as ItemConfig[];
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
