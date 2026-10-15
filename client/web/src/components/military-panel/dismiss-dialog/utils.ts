/** How many units the amount field asks for: all `have` when it is empty, never more than `have`. */
export function dismissCount(input: string, have: number): number {
  if (input === '') return have;
  const n = Number(input);
  return Number.isInteger(n) && n > 0 ? Math.min(n, have) : 0;
}
