// Shapes of persisted game state (stored as jsonb) shared by core, db and services.

import type { FortKey, ResourceKey, TroopKey } from './constants.ts';

export type ResourceSet = Record<ResourceKey, number>;
export type TroopCounts = Partial<Record<TroopKey, number>>;
export type FortCounts = Partial<Record<FortKey, number>>;

export const BuildingStatus = {
  IDLE: 0,
  BUILDING: 1,
  DEMOLISHING: 2,
} as const;
export type BuildingStatus = (typeof BuildingStatus)[keyof typeof BuildingStatus];

export interface BuildingState {
  /** -1 Town Hall, -2 Walls, 0..31 inside, 1001..1040 fields outside */
  positionId: number;
  typeId: number;
  /** current completed level; a new building under construction has level 0 */
  level: number;
  status: BuildingStatus;
  startTime: number;
  endTime: number;
}

/** One batch of troops (or fortifications) in a production queue. */
export interface TrainBatch {
  queueId: number;
  troopId: number;
  count: number;
  /** time the batch started producing (0 while waiting) */
  startTime: number;
  /** completion time (0 while waiting) */
  endTime: number;
  /** total production time of the batch, ms */
  costTime: number;
}

export interface TroopQueueState {
  /** barracks position */
  positionId: number;
  nextQueueId: number;
  queue: TrainBatch[];
}

export interface FortQueueState {
  nextQueueId: number;
  queue: TrainBatch[];
}

export interface ResearchEntry {
  level: number;
  /** city currently researching the next level (absent when idle) */
  cityId?: number;
  startTime?: number;
  endTime?: number;
}
/** techId -> state */
export type ResearchState = Record<string, ResearchEntry>;

/** itemId -> count */
export type ItemCounts = Record<string, number>;

export interface BuffState {
  id: string;
  desc: string;
  endTime: number;
  /** optional magnitude (e.g. upkeep reduction) */
  param?: number;
  /** city-scoped buffs */
  cityId?: number;
}

export interface CastleSign {
  tileId: number;
  name: string;
  x: number;
  y: number;
}

export interface CityMisc {
  /** last population/loyalty drift tick boundary (ms) */
  lastTickAt?: number;
  lastComfortAt?: number;
  lastLevyAt?: number;
  /** food shortfall carried into troop desertion */
  starvingSince?: number;
}

export interface PlayerMisc {
  icon?: number;
  changedFace?: boolean;
  allianceApply?: string;
  allianceApplyAt?: number;
  lastAllianceLeftAt?: number;
  lastAllianceLeftId?: number;
  /** daily purchase counters: itemId -> { day, count } */
  dailyLimits?: Record<string, { day: string; count: number }>;
  tutorialStep?: number;
  dailyGiftDay?: string;
  denyChatUntil?: number;
}

/** Report payloads are structured JSON (the original wrote XML files). */
export type ReportBody =
  | { kind: 'battle'; battle: unknown }
  | { kind: 'scout'; scout: unknown }
  | { kind: 'movement'; movement: unknown }
  | { kind: 'trade'; trade: unknown }
  | { kind: 'text'; text: string };
