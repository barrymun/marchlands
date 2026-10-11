import { BALANCE } from '@marchlands/core';

/** The experience books (BALANCE.items.experienceBooks), smallest first. */
export function experienceItems(): string[] {
  return Object.entries(BALANCE.items.experienceBooks)
    .sort(([, a], [, b]) => a.min - b.min)
    .map(([id]) => id);
}

/** The loyalty medals, with the loyalty each gives (BALANCE.items.medalLoyalty). */
export function loyaltyMedals(): { id: string; loyalty: number }[] {
  return Object.entries(BALANCE.items.medalLoyalty).map(([id, loyalty]) => ({ id, loyalty }));
}

/** Whether a hero's loyalty is at the most it can be, so no medal can raise it. */
export function isLoyaltyFull(loyalty: number): boolean {
  return loyalty >= BALANCE.heroMaxLoyalty;
}
