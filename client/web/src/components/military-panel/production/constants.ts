import type { ResourceKey } from '@marchlands/core';
import { param, type SearchSchema } from '@/lib/search-state';

/** What caps an order: a resource, idle population, wall space (fortifications), or `RESOURCES` when the unit costs nothing. */
export const TrainLimit = { IDLE_POPULATION: 'idlePopulation', WALL_SPACE: 'wallSpace', RESOURCES: 'resources' } as const;
export type TrainLimit = ResourceKey | (typeof TrainLimit)[keyof typeof TrainLimit];

/** A production card's tabs: what can be ordered, and the queue. */
export const ProductionTab = { TRAIN: 'train', QUEUE: 'queue' } as const;
export type ProductionTab = (typeof ProductionTab)[keyof typeof ProductionTab];

/** The panel's place in the address, under `military.` (lib/search-state.ts): the tab of each production card. */
export const MILITARY_SEARCH = {
  troops: param.oneOf(Object.values(ProductionTab), ProductionTab.TRAIN),
  forts: param.oneOf(Object.values(ProductionTab), ProductionTab.TRAIN),
} satisfies SearchSchema;
