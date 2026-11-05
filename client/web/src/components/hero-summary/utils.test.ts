import { describe, expect, it } from 'vitest';

import type { HeroBean } from '@marchlands/api-client';
import { HeroBuffId, HeroStatus, msg } from '@marchlands/core';

import { canAppoint, isMayor, runningBoosts, statusLabel } from '@/components/hero-summary/utils';

const hero = (status: number) => ({ status });
const buff = (id: HeroBuffId, endTime: number): HeroBean['buffs'][number] => ({ id, endTime, desc: msg('buff.truce') });

describe(statusLabel.name, () => {
  it('names what the hero is doing', () => {
    expect(statusLabel(hero(HeroStatus.IDLE))).toBe('Idle');
    expect(statusLabel(hero(HeroStatus.MAYOR))).toBe('Mayor');
    expect(statusLabel(hero(HeroStatus.ATTACK))).toBe('Marching');
    expect(statusLabel(hero(HeroStatus.RETURN))).toBe('Returning');
  });

  it('shows the number of a status it does not know', () => {
    expect(statusLabel(hero(99))).toBe('99');
  });
});

describe(isMayor.name, () => {
  it('is the mayor while at home', () => {
    expect(isMayor(hero(HeroStatus.MAYOR))).toBe(true);
    expect(isMayor(hero(HeroStatus.IDLE))).toBe(false);
  });
});

describe(canAppoint.name, () => {
  it('can make an idle hero at home mayor', () => {
    expect(canAppoint(hero(HeroStatus.IDLE))).toBe(true);
  });

  it('cannot make the mayor or a hero away mayor', () => {
    expect(canAppoint(hero(HeroStatus.MAYOR))).toBe(false);
    expect(canAppoint(hero(HeroStatus.ATTACK))).toBe(false);
    expect(canAppoint(hero(HeroStatus.RETURN))).toBe(false);
  });
});

describe(runningBoosts.name, () => {
  it('keeps the boosts still running, the soonest to end first', () => {
    const late = buff(HeroBuffId.POWER, 3000);
    const soon = buff(HeroBuffId.MANAGEMENT, 2000);
    expect(runningBoosts({ buffs: [late, soon, buff(HeroBuffId.STRATAGEM, 1000)] }, 1000)).toEqual([soon, late]);
  });

  it('has none for a hero with no buffs', () => {
    expect(runningBoosts({ buffs: [] }, 0)).toEqual([]);
  });
});
