import { scaled } from '@marchlands/core';

/** Amount now, integrating the hourly rate since the server's snapshot (capped at storage). */
export function live(amount: number, ratePerHour: number, max: number, since: number, now: number) {
  const grown = amount + (ratePerHour * Math.max(0, now - since)) / Math.max(1, scaled(3_600_000));
  if (ratePerHour > 0) return amount >= max ? amount : Math.min(max, grown);
  return Math.max(0, grown);
}
