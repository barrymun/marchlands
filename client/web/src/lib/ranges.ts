/** A whole number an input takes: from `min`, to `max` when it has one. */
export interface NumberRange {
  min: number;
  max?: number;
}

/** Whether a number is whole and in its range (a cleared input is NaN, never in range). */
export const inRange = (n: number, { min, max }: NumberRange) => Number.isInteger(n) && n >= min && (max == null || n <= max);

/** Whether typed digits are in range; a blank input is fine only where blank means something (`blank`: none, or all). */
export const textInRange = (text: string, range: NumberRange, { blank = false }: { blank?: boolean } = {}) =>
  text === '' ? blank : inRange(Number(text), range);

/** A number shown in an input: NaN (cleared) as blank. */
export const numberText = (n: number) => (Number.isNaN(n) ? '' : String(n));

/** Typed digits as a number: blank as NaN, which no range takes. */
export const textNumber = (text: string) => (text === '' ? Number.NaN : Number(text));
