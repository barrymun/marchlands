import { RESOURCE_KEYS, type ResourceKey } from './constants.ts';

export type Resources = Record<ResourceKey, number>;

export const emptyResources = (): Resources => ({ gold: 0, food: 0, wood: 0, stone: 0, iron: 0 });

export function addResources(a: Resources, b: Partial<Resources>, mult = 1): Resources {
  const out = { ...a };
  for (const k of RESOURCE_KEYS) out[k] += (b[k] ?? 0) * mult;
  return out;
}

export function scaleResources(a: Partial<Resources>, mult: number): Resources {
  const out = emptyResources();
  for (const k of RESOURCE_KEYS) out[k] = (a[k] ?? 0) * mult;
  return out;
}

/** true when every component of `have` is >= `need` */
export function hasResources(have: Resources, need: Partial<Resources>): boolean {
  return RESOURCE_KEYS.every((k) => have[k] + 1e-9 >= (need[k] ?? 0));
}

export function totalResources(r: Partial<Resources>): number {
  return RESOURCE_KEYS.reduce((s, k) => s + (r[k] ?? 0), 0);
}

export function floorResources(r: Resources): Resources {
  const out = emptyResources();
  for (const k of RESOURCE_KEYS) out[k] = Math.floor(r[k]);
  return out;
}
