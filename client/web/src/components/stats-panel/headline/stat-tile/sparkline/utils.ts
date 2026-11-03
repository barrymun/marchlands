/** A point of a sparkline, in its own box's units. */
export interface SparkPoint {
  x: number;
  y: number;
}

/**
 * Where each value of a sparkline falls in a `w` by `h` box: evenly across, from 0 at the bottom to the largest value
 * at the top (all at the bottom when there's nothing), `pad` kept clear above and below for the line's width.
 */
export function sparkPoints(values: readonly number[], w: number, h: number, pad = 1): SparkPoint[] {
  const most = Math.max(0, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: values.length > 1 ? i * step : w / 2,
    y: h - pad - (most > 0 ? (Math.max(0, v) / most) * (h - 2 * pad) : 0),
  }));
}

/** The index of the value nearest a point `x` across a sparkline `width` wide, of `n` values (null with none). */
export function indexAt(x: number, width: number, n: number): number | null {
  if (n === 0 || width <= 0) return null;
  if (n === 1) return 0;
  return Math.min(n - 1, Math.max(0, Math.round((x / width) * (n - 1))));
}

/** A UTC day ('2026-11-03') as a moment at its noon, so the date shown is that day in every time zone. */
export const dayMoment = (day: string) => Date.parse(`${day}T12:00:00Z`);
