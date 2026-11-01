/**
 * How many units the amount field asks for: nothing when it is empty, not a whole number or more than the city
 * `have`s. Never all by default, and never cut down to what the city has, so a slip of the keyboard can't dismiss
 * everything.
 */
export function dismissCount(input: string, have: number): number {
  if (input === '') return 0;
  const n = Number(input);
  return Number.isInteger(n) && n > 0 && n <= have ? n : 0;
}
