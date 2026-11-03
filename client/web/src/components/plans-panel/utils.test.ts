import { describe, expect, it } from 'vitest';

import type { PlanBean, PlanWave } from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';

import { nextPosition, plannedFrom, sendable, takesWaves, troopsText, waveLeaves } from '@/components/plans-panel/utils';

const wave = (over: Partial<PlanWave>): PlanWave => ({
  id: 1,
  playerId: 7,
  player: 'Ada',
  cityId: 1,
  city: 'Home',
  heroId: null,
  hero: null,
  mission: 5,
  troops: { archer: 10 },
  position: 0,
  armyId: null,
  marchMs: 60_000,
  ...over,
});
const plan = (waves: PlanWave[]): PlanBean => ({
  id: 1,
  name: 'P',
  playerId: 7,
  player: 'Ada',
  shared: false,
  targetTileId: 1,
  x: 1,
  y: 0,
  landAt: 1_000_000,
  waves,
});

describe(waveLeaves.name, () => {
  it('is the landing second, plus its place in milliseconds, less its march', () => {
    expect(waveLeaves({ landAt: 1_000_000 }, { position: 3, marchMs: 60_000 })).toBe(940_003);
  });

  it('is null for a wave whose march the player doesn’t know (someone else’s, or sent)', () => {
    expect(waveLeaves({ landAt: 1_000_000 }, { position: 0, marchMs: null })).toBeNull();
  });
});

describe(sendable.name, () => {
  it('lists the player’s own unsent waves that can still leave in time', () => {
    const mine = wave({ id: 1 });
    const late = wave({ id: 2, marchMs: 2_000_000 });
    const sent = wave({ id: 3, armyId: 9, marchMs: null });
    const theirs = wave({ id: 4, playerId: 8, marchMs: null });
    expect(sendable(plan([mine, late, sent, theirs]), 7, 900_000).map((w) => w.id)).toEqual([1]);
  });

  it('is empty once even the first has missed its moment', () => {
    expect(sendable(plan([wave({})]), 7, 950_000)).toEqual([]);
  });
});

describe(troopsText.name, () => {
  it('lists each troop type with its count, skipping none', () => {
    expect(troopsText({ archer: 1000, scouter: 10, militia: 0 })).toBe('1,000 Archer, 10 Scout');
  });

  it('is empty without troops', () => {
    expect(troopsText({})).toBe('');
  });
});

describe(nextPosition.name, () => {
  it('is 0 for an empty plan', () => {
    expect(nextPosition(plan([]))).toBe(0);
  });

  it('comes after the last, even with gaps where waves were taken out', () => {
    expect(nextPosition(plan([wave({ position: 0 }), wave({ position: 4 }), wave({ position: 2 })]))).toBe(5);
  });
});

describe(takesWaves.name, () => {
  it('takes waves until its second', () => {
    expect(takesWaves(plan([]), 999_999)).toBe(true);
    expect(takesWaves(plan([]), 1_000_000)).toBe(false);
  });

  it('takes none once full', () => {
    const full = Array.from({ length: BALANCE.warPlans.maxWaves }, (_, i) => wave({ id: i, position: i }));
    expect(takesWaves(plan(full), 0)).toBe(false);
  });
});

describe(plannedFrom.name, () => {
  it('adds up the city’s unsent waves across plans, troops by type and their heroes', () => {
    const a = plan([wave({ troops: { archer: 100, militia: 5 }, heroId: 3 }), wave({ troops: { archer: 50 } })]);
    const b = { ...plan([wave({ troops: { archer: 1 }, heroId: 4 })]), id: 2 };
    expect(plannedFrom([a, b], 7, 1)).toEqual({ troops: { archer: 151, militia: 5 }, heroIds: [3, 4] });
  });

  it('leaves out sent waves, other cities’ and other players’', () => {
    const p = plan([wave({ armyId: 9, heroId: 3 }), wave({ cityId: 2, heroId: 4 }), wave({ playerId: 8, heroId: 5 })]);
    expect(plannedFrom([p], 7, 1)).toEqual({ troops: {}, heroIds: [] });
  });
});
