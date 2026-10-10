import { afterEach, describe, expect, it } from 'vitest';
import { setGameSpeed } from '@marchlands/core';
import { live } from '@/components/resource-bar/utils';

const HOUR = 3_600_000;

describe(live.name, () => {
  afterEach(() => {
    setGameSpeed(1);
  });

  it('returns the snapshot amount when no time has passed', () => {
    expect(live(1_000, 500, 10_000, 5_000, 5_000)).toBe(1_000);
  });

  it('adds the hourly rate pro rata since the snapshot', () => {
    expect(live(1_000, 600, 10_000, 0, HOUR)).toBe(1_600);
    expect(live(1_000, 600, 10_000, 0, HOUR / 2)).toBe(1_300);
    expect(live(0, 3_600, 10_000, 0, 1_000)).toBe(1);
  });

  it('caps growth at storage', () => {
    expect(live(9_800, 600, 10_000, 0, HOUR)).toBe(10_000);
  });

  it('keeps an amount already over storage as is (production paused, not clamped down)', () => {
    expect(live(12_000, 600, 10_000, 0, HOUR)).toBe(12_000);
    expect(live(10_000, 600, 10_000, 0, HOUR)).toBe(10_000);
  });

  it('grows without limit when storage is Infinity (gold)', () => {
    expect(live(1_000_000, 1_000, Infinity, 0, 10 * HOUR)).toBe(1_010_000);
  });

  it('drains with a negative rate, ignoring storage', () => {
    expect(live(12_000, -1_000, 10_000, 0, HOUR)).toBe(11_000);
  });

  it('never drains below zero', () => {
    expect(live(500, -1_000, 10_000, 0, HOUR)).toBe(0);
  });

  it('holds steady with a zero rate', () => {
    expect(live(500, 0, 100, 0, HOUR)).toBe(500);
    expect(live(-5, 0, 100, 0, HOUR)).toBe(0);
  });

  it('ignores a clock behind the snapshot', () => {
    expect(live(1_000, 600, 10_000, HOUR, 0)).toBe(1_000);
  });

  it('runs the hour faster at a higher game speed', () => {
    setGameSpeed(60);
    // a game hour is one real minute at 60×
    expect(live(1_000, 600, 100_000, 0, 60_000)).toBe(1_600);
    expect(live(1_000, 600, 100_000, 0, HOUR)).toBe(1_000 + 600 * 60);
  });

  it('never divides by less than 1 ms at absurd game speeds', () => {
    setGameSpeed(1e7);
    // scaled(1 h) floors to 0 here; the divisor is clamped to 1 ms
    expect(live(0, 2, Infinity, 0, 10)).toBe(20);
  });
});
