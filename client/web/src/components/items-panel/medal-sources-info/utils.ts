import { percent } from '@/lib/format';

/** A drop chance: one fixed decimal below 10% (5.0%), whole above (26%). */
export const pct = (x: number) => (x < 0.1 ? percent(x, 1, 1) : percent(x));

export const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);
