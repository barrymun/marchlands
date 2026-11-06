// (marchlands) Abandoning a city (docs/features/abandoning-a-city.md).

import { BALANCE } from '#/balance.ts';

/**
 * The prestige a player loses abandoning a city at `at`: what capturing it gave them, if that was recent. Otherwise capturing
 * a city, abandoning it to free the slot and capturing another would earn its prestige over and over.
 */
export function abandonPrestigeBack(city: { capturePrestige: number; capturedAt: number }, at: number): number {
  return at - city.capturedAt < BALANCE.abandon.prestigeBackMs ? city.capturePrestige : 0;
}

/** An amount shared evenly: whole units each, what's left over (a resource's fraction too) to the first, so nothing is lost. */
export function splitEvenly(amount: number, parts: number): number[] {
  if (parts < 1) return [];
  const each = Math.floor(amount / parts);
  return [amount - each * (parts - 1), ...Array.from({ length: parts - 1 }, () => each)];
}

/** Each kind in a set of counts or resources shared evenly (splitEvenly): one set per part, leaving out what a part gets none of. */
export function splitCounts<T extends object>(counts: T, parts: number): T[] {
  const split = (Object.entries(counts) as [string, number][]).map(([key, amount]) => [key, splitEvenly(amount, parts)] as const);
  return Array.from(
    { length: parts },
    (_, part) =>
      Object.fromEntries(
        split.flatMap(([key, shares]) => {
          const share = shares[part] ?? 0;
          return share > 0 ? [[key, share]] : [];
        }),
      ) as T,
  );
}
