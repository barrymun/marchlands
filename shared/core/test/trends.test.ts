import { describe, expect, it } from 'vitest';
import { TREND_DAYS, TREND_KEYS, trendDays, TrendKey, trendOf } from '#/trends.ts';

describe(trendOf.name, () => {
  it('puts every counter a headline number adds up in its trend', () => {
    expect(trendOf('attacks.won.npc')).toBe(TrendKey.ATTACKS_WON);
    expect(trendOf('attacks.won.valley')).toBe(TrendKey.ATTACKS_WON);
    expect(trendOf('defenses.won.city')).toBe(TrendKey.DEFENSES_WON);
    expect(trendOf('honor')).toBe(TrendKey.HONOR);
    expect(trendOf('killed.militia')).toBe(TrendKey.ENEMIES);
    expect(trendOf('killed.arrowTower')).toBe(TrendKey.ENEMIES);
    expect(trendOf('trained.archer')).toBe(TrendKey.TRAINED);
    expect(trendOf('captured.city')).toBe(TrendKey.CAPTURED);
    expect(trendOf('captured.npc')).toBe(TrendKey.CAPTURED);
  });

  it('leaves out every other counter', () => {
    expect(trendOf('attacks.lost.npc')).toBeNull();
    expect(trendOf('captured.valley')).toBeNull();
    expect(trendOf('honorable')).toBeNull();
    expect(trendOf('spent.healing.honor')).toBeNull();
    expect(trendOf('lost.archer')).toBeNull();
    expect(trendOf('')).toBeNull();
  });

  it('has a trend for every key', () => {
    expect(TREND_KEYS).toEqual(['attacksWon', 'defensesWon', 'honor', 'enemies', 'trained', 'captured']);
  });
});

describe(trendDays.name, () => {
  it('lists the UTC days, oldest first, ending today', () => {
    const days = trendDays(Date.UTC(2026, 10, 3, 23, 59));
    expect(days).toHaveLength(TREND_DAYS);
    expect(days.at(-1)).toBe('2026-11-03');
    expect(days[0]).toBe('2026-10-05');
  });

  it('crosses months and years', () => {
    expect(trendDays(Date.UTC(2027, 0, 2)).slice(-3)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
  });
});
