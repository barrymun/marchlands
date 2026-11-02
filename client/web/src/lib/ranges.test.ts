import { describe, expect, it } from 'vitest';
import { inRange, numberText, textInRange, textNumber } from '@/lib/ranges';

describe(inRange.name, () => {
  it('takes whole numbers from the minimum to the maximum, or with no maximum anything above the minimum', () => {
    expect(inRange(1, { min: 1, max: 10 })).toBe(true);
    expect(inRange(10, { min: 1, max: 10 })).toBe(true);
    expect(inRange(0, { min: 1, max: 10 })).toBe(false);
    expect(inRange(11, { min: 1, max: 10 })).toBe(false);
    expect(inRange(5_000_000, { min: 1 })).toBe(true);
  });

  it('refuses a cleared input (NaN) and a fraction', () => {
    expect(inRange(Number.NaN, { min: 1 })).toBe(false);
    expect(inRange(1.5, { min: 1, max: 10 })).toBe(false);
  });
});

describe(textInRange.name, () => {
  it('reads typed digits against the range', () => {
    expect(textInRange('100', { min: 0, max: 100 })).toBe(true);
    expect(textInRange('150', { min: 0, max: 100 })).toBe(false);
    expect(textInRange('0', { min: 1 })).toBe(false);
  });

  it('takes a blank input only where blank means something', () => {
    expect(textInRange('', { min: 0, max: 100 })).toBe(false);
    expect(textInRange('', { min: 0, max: 100 }, { blank: true })).toBe(true);
  });
});

describe(numberText.name, () => {
  it('shows a number, and a cleared one (NaN) as blank', () => {
    expect(numberText(8)).toBe('8');
    expect(numberText(Number.NaN)).toBe('');
  });
});

describe(textNumber.name, () => {
  it('reads digits, and blank as NaN', () => {
    expect(textNumber('12')).toBe(12);
    expect(textNumber('')).toBeNaN();
  });
});
