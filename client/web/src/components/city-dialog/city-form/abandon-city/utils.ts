import type { CityBean } from '@marchlands/api-client';

/**
 * A player always keeps a regular city, as a historic one can be taken from them: whether they'd still have one, not being
 * abandoned itself, without this city. The server has the last word (keepsRegularCity, engine/abandon.ts).
 */
export const keepsRegularCity = (castles: readonly Pick<CityBean, 'id' | 'historicLevel' | 'abandonAt'>[], cityId: number) =>
  castles.some((c) => c.id !== cityId && c.historicLevel == null && !c.abandonAt);

/** How many troops or fortifications a bean holds, none for an army whose troops are hidden. */
export const countOf = (counts: Record<string, number> | null | undefined) => Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0);

/** Only the things of this city, from a list of the player's. */
export const ofCity = <T extends { cityId: number }>(list: readonly T[] | undefined, cityId: number): T[] => (list ?? []).filter((x) => x.cityId === cityId);
