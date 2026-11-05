// (marchlands) Abandoning a city (docs/features/abandoning-a-city.md).

import { BALANCE } from '#/balance.ts';

/**
 * The prestige a player loses abandoning a city at `at`: what capturing it gave them, if that was recent. Otherwise capturing
 * a city, abandoning it to free the slot and capturing another would earn its prestige over and over.
 */
export function abandonPrestigeBack(city: { capturePrestige: number; capturedAt: number }, at: number): number {
  return at - city.capturedAt < BALANCE.abandon.prestigeBackMs ? city.capturePrestige : 0;
}
