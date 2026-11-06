import type { CityBean } from '@marchlands/api-client';

/**
 * A player always keeps a regular city, as a historic one can be taken from them: whether they'd still have one, not being
 * abandoned itself, without this city. The server has the last word (keepsRegularCity, engine/abandon.ts).
 */
export const keepsRegularCity = (castles: readonly Pick<CityBean, 'id' | 'historicLevel' | 'abandonAt'>[], cityId: number) =>
  castles.some((c) => c.id !== cityId && c.historicLevel == null && !c.abandonAt);

/** How many troops or fortifications a bean holds, none for an army whose troops are hidden. */
export const countOf = (counts: Record<string, number> | null | undefined) => Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0);

/** How many troops or fortifications a city's queues hold, waiting or being made: paid for, and lost with the city. */
export const queuedCount = (queues: readonly { allProduceQueue: readonly { num: number }[] }[] | undefined) =>
  (queues ?? []).reduce((sum, q) => sum + q.allProduceQueue.reduce((n, batch) => n + batch.num, 0), 0);

/** Only the things of this city, from a list of the player's. */
export const ofCity = <T extends { cityId: number }>(list: readonly T[] | undefined, cityId: number): T[] => (list ?? []).filter((x) => x.cityId === cityId);
