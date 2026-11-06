import type { CityBean } from '@marchlands/api-client';
import { BattleTarget, heroPower, HeroStatus, Mission, type ResourceKey, type TroopKey } from '@marchlands/core';
import { NO_HERO } from '@/components/send-army-dialog/send-form/constants';

/**
 * Whether goods can go with a mission: a transport, settlers, or reinforcements to a city, which move them in or deliver
 * them. A garrison on a valley would only sit on them until it's called home.
 */
export const carriesResources = (mission: number, kind: BattleTarget | undefined) =>
  mission === Mission.TRANSPORT || mission === Mission.BUILD_CITY || (mission === Mission.REINFORCE && kind !== BattleTarget.VALLEY);

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

/** Resource amounts as entered, after they've been sent: kept for the next army, each capped to what the city has left (an empty field stays empty). */
export function capResourcesLeft(sent: Partial<Record<ResourceKey, string>>, had: (r: ResourceKey) => number): Partial<Record<ResourceKey, string>> {
  return Object.fromEntries(
    (Object.entries(sent) as [ResourceKey, string | undefined][]).map(([r, v]) => [r, v ? String(Math.max(0, Math.min(Number(v), had(r) - Number(v)))) : v]),
  );
}

/** Troops at home less those already set out in waves not yet sent (none below zero). */
export function freeTroops(home: Partial<Record<TroopKey, number>>, planned: Partial<Record<TroopKey, number>>): Partial<Record<TroopKey, number>> {
  return Object.fromEntries(Object.entries(home).map(([k, n]) => [k, Math.max(0, n - (planned[k as TroopKey] ?? 0))]));
}
