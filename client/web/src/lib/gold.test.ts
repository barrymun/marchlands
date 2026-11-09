import { describe, expect, it } from 'vitest';
import { BALANCE, heroHireCost, tavernRefreshCost } from '@marchlands/core';
import { asksFirst } from '@/lib/gold';

describe(asksFirst.name, () => {
  const start = BALANCE.startingResources;

  it('lets a new city hire and re-roll the Inn at a click', () => {
    expect(asksFirst(heroHireCost(5), start)).toBe(false);
    expect(asksFirst(tavernRefreshCost(1), start)).toBe(false);
  });

  it('asks a new city before a gold speed-up (40,000) or an item', () => {
    expect(asksFirst(40_000, start)).toBe(true);
    expect(asksFirst(65_000, start)).toBe(true);
  });

  it('asks from exactly a tenth of the city gold up', () => {
    expect(asksFirst(9_999, 100_000)).toBe(false);
    expect(asksFirst(10_000, 100_000)).toBe(true);
  });

  it('lets a rich city speed up at a click, but asks before a large share of its gold', () => {
    expect(asksFirst(1_000_000, 20_000_000)).toBe(false);
    expect(asksFirst(2_335_000, 20_000_000)).toBe(true);
  });

  it('asks a city nearly out of gold even for a hire', () => {
    expect(asksFirst(2_000, 5_000)).toBe(true);
  });

  it('never asks about nothing', () => {
    expect(asksFirst(0, 0)).toBe(false);
  });
});
