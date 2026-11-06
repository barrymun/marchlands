import { describe, expect, it } from 'vitest';

import type { HeroBean } from '@marchlands/api-client';
import { BattleTarget, HeroStatus, Mission, Relation, relationPermissions } from '@marchlands/core';

import { mayorOf, ownCityTarget } from '@/routes/game/utils';

/** Only the fields mayorOf reads matter; the rest of the bean is irrelevant here. */
const hero = (id: number, status: number) => ({ id, name: `Hero ${id}`, status }) as HeroBean;

describe(mayorOf.name, () => {
  it('finds the hero serving as mayor', () => {
    const mayor = hero(2, HeroStatus.MAYOR);
    expect(mayorOf({ heros: [hero(1, HeroStatus.IDLE), mayor, hero(3, HeroStatus.ATTACK)] })).toBe(mayor);
  });

  it('returns undefined when no hero is mayor', () => {
    const heros = [HeroStatus.IDLE, HeroStatus.ATTACK, HeroStatus.RETURN].map((s, i) => hero(i, s));
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

describe(ownCityTarget.name, () => {
  const target = ownCityTarget({ fieldId: 4242, name: 'Oakmere' });

  it('aims at the city and marks it as owned, for the Relief Station', () => {
    expect(target).toMatchObject({ tileId: 4242, name: 'Oakmere', kind: BattleTarget.CITY, own: true });
  });

  it('opens on Transport, one of its missions', () => {
    expect(target.mission).toBe(Mission.TRANSPORT);
    expect(target.missions).toContain(target.mission);
  });

  it('offers only what the rules allow against a city of the player', () => {
    const allowed = relationPermissions(Relation.SELF);
    expect(allowed).toMatchObject({ canSend: true, canTrans: true, canLoot: false, canOccupy: false, canScout: false });
    expect(target.missions).toEqual([Mission.REINFORCE, Mission.TRANSPORT]);
  });
});
