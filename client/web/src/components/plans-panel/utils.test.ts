import { describe, expect, it } from 'vitest';
import type { PlanBean, PlanWave } from '@marchlands/api-client';
import { sendable, troopsText, waveLeaves } from '@/components/plans-panel/utils';

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
