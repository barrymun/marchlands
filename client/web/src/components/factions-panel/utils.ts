/**
 * Where a faction's gold bar fills to and where its treasury (the gold it drifts back to) is marked, as shares of the
 * bar. The bar spans whichever is larger, so gold above its usual level runs past the mark rather than stopping at it.
 */
export function goldBar(gold: number, treasury: number): { fill: number; mark: number } {
  const span = Math.max(gold, treasury);
  if (span <= 0) return { fill: 0, mark: 0 };
  return { fill: Math.max(0, gold) / span, mark: treasury / span };
}
