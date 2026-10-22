import { describe, expect, it } from 'vitest';
import { distributeLosses, distributeLossesAmong } from '#/index.ts';

describe(distributeLosses.name, () => {
  it('shrinks groups proportionally and preserves totals', () => {
    const groups = [{ militia: 100, archer: 10 }, { militia: 50 }, { militia: 1 }];
    const out = distributeLosses(groups, { militia: 151, archer: 10 }, { militia: 76, archer: 5 });
    expect(out.reduce((s, g) => s + (g.militia ?? 0), 0)).toBe(76);
    expect(out[0].archer).toBe(5);
    out.forEach((g, i) => expect(g.militia ?? 0).toBeLessThanOrEqual(groups[i].militia));
  });
  it('wipes everything when nothing survives', () => {
    expect(distributeLosses([{ scouter: 3 }, { scouter: 4 }], { scouter: 7 }, {})).toEqual([{}, {}]);
  });
});

describe(distributeLossesAmong.name, () => {
  it('pairs each holder with what it has left, in order, as distributeLosses shares them', () => {
    const holders = [
      { name: 'city', troops: { militia: 100, archer: 10 } },
      { name: 'army', troops: { militia: 50 } },
    ];
    const out = distributeLossesAmong(holders, (h) => h.troops, { militia: 150, archer: 10 }, { militia: 75, archer: 5 });
    expect(out.map((r) => r.holder.name)).toEqual(['city', 'army']);
    expect(out.map((r) => r.troops)).toEqual(
      distributeLosses(
        holders.map((h) => h.troops),
        { militia: 150, archer: 10 },
        { militia: 75, archer: 5 },
      ),
    );
  });
  it('gives nothing for no holders', () => {
    expect(distributeLossesAmong([], () => ({}), { militia: 5 }, {})).toEqual([]);
  });
});
