import { describe, expect, it } from 'vitest';
import { BALANCE, historicCities, historicDay, historicGarrison, historicLevelAt, historicRallyBonus, historicResearch, TechType } from '#/index.ts';

describe(historicLevelAt.name, () => {
  it('puts Atlantis at (0, 0), a capital in the middle of every state, 14s every 66 tiles and 12s every 18', () => {
    expect(historicLevelAt(0, 0)).toBe(18);
    expect(historicLevelAt(100, 100)).toBe(16);
    expect(historicLevelAt(700, 700)).toBe(16);
    expect(historicLevelAt(33, 33)).toBe(14);
    // the reference's tables: Saxony's and Carinthia's level 14s
    expect(historicLevelAt(231, 165)).toBe(14);
    expect(historicLevelAt(627, 429)).toBe(14);
    expect(historicLevelAt(9, 9)).toBe(12);
    expect(historicLevelAt(207, 9)).toBe(12);
  });

  it('has a level 12 in each state’s middle place of the level 14 grid, as source 9 said', () => {
    for (const v of [99, 297, 495, 693]) expect(historicLevelAt(v, v)).toBe(12);
    expect(historicLevelAt(99, 297)).toBe(12);
  });

  it('puts the wiki’s two named cities, St. Gallen and Vigevano, on level 12 places', () => {
    expect(historicLevelAt(369, 657)).toBe(12);
    expect(historicLevelAt(567, 747)).toBe(12);
  });

  it('is null anywhere else', () => {
    expect(historicLevelAt(1, 0)).toBeNull();
    expect(historicLevelAt(10, 9)).toBeNull();
    expect(historicLevelAt(233, 33)).toBeNull();
    expect(historicLevelAt(101, 100)).toBeNull();
  });
});

describe(historicCities.name, () => {
  it('lists 2,081: one Atlantis, 16 capitals, 128 level 14s and 1,936 level 12s', () => {
    const all = historicCities();
    const count = (level: number) => all.filter((c) => c.level === level).length;
    expect(all).toHaveLength(2081);
    expect([count(18), count(16), count(14), count(12)]).toEqual([1, 16, 128, 1936]);
  });
});

describe(historicDay.name, () => {
  it('is the same all day for a city, and changes with the day and the city', () => {
    expect(historicDay(1234, 20_000)).toEqual(historicDay(1234, 20_000));
    const days = new Set(Array.from({ length: 200 }, (_, d) => JSON.stringify(historicDay(1234, d))));
    // two foot troops, two horse, three siege engines
    expect(days.size).toBe(12);
  });
});

describe(historicGarrison.name, () => {
  it('holds the day’s troops beside the warriors and archers, and the same fortifications at every level', () => {
    const g = historicGarrison(16, { foot: 'swordsmen', horse: 'heavyCavalry', siege: 'catapult' });
    expect(g.troops).toEqual({ militia: 7_000_000, swordsmen: 1_016_665, archer: 428_070, heavyCavalry: 677_777, catapult: 91_500 });
    expect(g.forts).toEqual(BALANCE.historic.forts);
    expect(historicGarrison(12, { foot: 'pikemen', horse: 'lightCavalry', siege: 'batteringRam' }).forts).toEqual(g.forts);
  });
});

describe(historicResearch.name, () => {
  it('has every research at the level but Archery, at 0', () => {
    const r = historicResearch();
    expect(r[TechType.ARCHERY]).toEqual({ level: 0 });
    expect(r[TechType.HORSEBACK_RIDING]).toEqual({ level: BALANCE.historic.researchLevel });
    expect(historicResearch(5)[TechType.IRON_WORKING]).toEqual({ level: 5 });
  });
});

describe(historicRallyBonus.name, () => {
  it('adds a quarter a level step above 10', () => {
    expect([12, 14, 16, 18].map((l) => historicRallyBonus(l as 12 | 14 | 16 | 18))).toEqual([0.25, 0.5, 0.75, 1]);
  });
});
