import type { ResourceKey } from '@marchlands/core';

/** What caps an order: a resource, idle population, wall space (fortifications), or `RESOURCES` when the unit costs nothing. */
export const TrainLimit = { IDLE_POPULATION: 'idlePopulation', WALL_SPACE: 'wallSpace', RESOURCES: 'resources' } as const;
export type TrainLimit = ResourceKey | (typeof TrainLimit)[keyof typeof TrainLimit];

/** The batches in progress show open up to this many; with more (a city of many barracks) they start collapsed, so the order form stays near the top. */
export const QUEUE_OPEN_MAX = 3;
