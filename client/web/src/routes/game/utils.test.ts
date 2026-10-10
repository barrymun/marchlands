import { describe, expect, it } from 'vitest';
import type { HeroBean } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';
import { mayorOf } from '@/routes/game/utils';

/** Only the fields mayorOf reads matter; the rest of the bean is irrelevant here. */
const hero = (id: number, status: number) => ({ id, name: `Hero ${id}`, status }) as HeroBean;

describe(mayorOf.name, () => {
  it('finds the hero serving as mayor', () => {
    const mayor = hero(2, HeroStatus.MAYOR);
    expect(mayorOf({ heros: [hero(1, HeroStatus.IDLE), mayor, hero(3, HeroStatus.ATTACK)] })).toBe(mayor);
  });

  it('returns undefined when no hero is mayor', () => {
    const heros = [HeroStatus.IDLE, HeroStatus.ATTACK, HeroStatus.SEIZED, HeroStatus.RETURN].map((s, i) => hero(i, s));
    expect(mayorOf({ heros })).toBeUndefined();
  });

  it('returns undefined for a city without heroes', () => {
    expect(mayorOf({ heros: [] })).toBeUndefined();
  });

  it('returns the first mayor if the data ever lists two', () => {
    const first = hero(4, HeroStatus.MAYOR);
    expect(mayorOf({ heros: [hero(1, HeroStatus.IDLE), first, hero(5, HeroStatus.MAYOR)] })).toBe(first);
  });
});
