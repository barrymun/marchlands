import type { RES_KEYS } from '@/components/military-panel/production/constants';

/** What caps an order: a resource, idle population, wall space (fortifications), or 'resources' when the unit costs nothing. */
export type TrainLimit = (typeof RES_KEYS)[number] | 'idlePopulation' | 'wallSpace' | 'resources';
