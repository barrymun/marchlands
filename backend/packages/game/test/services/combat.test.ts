import { describe, expect, it } from 'vitest';
import { distributeLosses } from '../../src/services/combat.ts';

describe('distributeLosses', () => {
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
