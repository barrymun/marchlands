/** Game time is unix epoch milliseconds, as in the original server (Utils::time()). */
export const now = (): number => Date.now();

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * Coins (cents) needed to instantly finish something with `timeLeftMs` remaining.
 * Port of calculatecoinsforspeedup() from defines.h. The original *assigned* (=) in the
 * 15-minute bracket, discarding coins accumulated in larger brackets; that is fixed here.
 */
export function coinsForSpeedup(timeLeftMs: number): number {
  let t = Math.max(0, Math.floor(timeLeftMs));
  let coins = 0;
  if (t >= 28_800_000) {
    coins += 50 * Math.floor(t / 28_800_000);
    t %= 28_800_000;
  }
  if (t > 21_600_000) return coins + 50;
  if (t >= 9_000_000) {
    coins += 20 * Math.floor(t / 9_000_000);
    t %= 9_000_000;
  }
  if (t > 7_200_000) return coins + 20;
  if (t >= 3_600_000) {
    coins += 10 * Math.floor(t / 3_600_000);
    t %= 3_600_000;
  }
  if (t > 1_800_000) return coins + 10;
  if (t >= 900_000) {
    coins += 5 * Math.floor(t / 900_000);
    t %= 900_000;
  }
  if (t > 0) coins += 5;
  return coins;
}
