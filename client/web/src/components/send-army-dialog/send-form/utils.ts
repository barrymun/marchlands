import type { CityBean } from '@marchlands/api-client';
import { heroPower, HeroStatus, Mission, type TroopKey } from '@marchlands/core';

/** The strongest idle hero (by Attack) to lead the army, leaving out `exclude` (e.g. one just sent): its id, or 'none'. */
export function bestIdleHero(heros: CityBean['heros'], exclude?: number): string {
  const best = heros
    .filter((h) => h.status === HeroStatus.IDLE && !h.seized && h.id !== exclude)
    .reduce<CityBean['heros'][number] | null>((top, h) => (!top || heroPower(h) > heroPower(top) ? h : top), null);
  return best ? String(best.id) : 'none';
}

/** The hero chosen for a mission: the strongest idle one for an attack (where Attack counts), none otherwise. */
export const defaultHero = (mission: number, heros: CityBean['heros'], exclude?: number) =>
  mission === Mission.ATTACK ? bestIdleHero(heros, exclude) : 'none';

/** Troop amounts as entered, each capped to what the city has (an empty field stays empty). */
export function capTroops(troops: Partial<Record<TroopKey, string>>, inCity: Partial<Record<TroopKey, number>>): Partial<Record<TroopKey, string>> {
  return Object.fromEntries(Object.entries(troops).map(([k, v]) => [k, v ? String(Math.min(Number(v), inCity[k as TroopKey] ?? 0)) : v]));
}

/** A landing time typed as a UTC date (YYYY-MM-DD) and time (HH:MM or HH:MM:SS): its moment in ms, or null. */
export function landingTime(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return null;
  const ms = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** A moment as the landing time's UTC date and time fields, to the second. */
export function utcFields(ms: number): { date: string; time: string } {
  const iso = new Date(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

/** The landing time offered first: a round minute, at least a minute after the army could land at the soonest. */
export const firstLanding = (now: number, marchMs: number) => Math.ceil((now + marchMs + 60_000) / 60_000) * 60_000;
