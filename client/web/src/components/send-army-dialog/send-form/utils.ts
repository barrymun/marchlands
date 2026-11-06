import type { CityBean } from '@marchlands/api-client';
import { heroPower, HeroStatus, Mission, type TroopKey } from '@marchlands/core';
import { NO_HERO } from '@/components/send-army-dialog/send-form/constants';

/** The strongest idle hero (by Attack) to lead the army, leaving out `exclude` (e.g. one just sent): its id, or 'none'. */
export function bestIdleHero(heros: CityBean['heros'], exclude?: number): string {
  const best = heros
    .filter((h) => h.status === HeroStatus.IDLE && h.id !== exclude)
    .reduce<CityBean['heros'][number] | null>((top, h) => (!top || heroPower(h) > heroPower(top) ? h : top), null);
  return best ? String(best.id) : NO_HERO;
}

/** The hero chosen for a mission: the strongest idle one for an attack (where Attack counts), none otherwise. */
export const defaultHero = (mission: number, heros: CityBean['heros'], exclude?: number) =>
  mission === Mission.ATTACK ? bestIdleHero(heros, exclude) : NO_HERO;

/** Troop amounts as entered, each capped to what the city has (an empty field stays empty). */
export function capTroops(troops: Partial<Record<TroopKey, string>>, inCity: Partial<Record<TroopKey, number>>): Partial<Record<TroopKey, string>> {
  return Object.fromEntries(Object.entries(troops).map(([k, v]) => [k, v ? String(Math.min(Number(v), inCity[k as TroopKey] ?? 0)) : v]));
}

/** Troops at home less those already set out in waves not yet sent (none below zero). */
export function freeTroops(home: Partial<Record<TroopKey, number>>, planned: Partial<Record<TroopKey, number>>): Partial<Record<TroopKey, number>> {
  return Object.fromEntries(Object.entries(home).map(([k, n]) => [k, Math.max(0, n - (planned[k as TroopKey] ?? 0))]));
}
