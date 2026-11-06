import { describe, expect, it } from 'vitest';
import { TroopKey } from '@marchlands/core';
import { headline } from '@/components/stats-panel/headline/utils';

describe(headline.name, () => {
  const c = {
    'attacks.won.npc': 10_629,
    'attacks.won.valley': 93,
    'attacks.lost.npc': 19,
    'defenses.won.city': 2,
    'defenses.lost.city': 1,
    honor: 12_302_039_702,
    'killed.militia': 4_045_076_363,
    'killed.trap': 74_878_696,
    'killed.archer': 4_072_607,
    'trained.archer': 129_072_206,
    'trained.trap': 2,
    'lost.archer': 58_183_785,
    'injured.archer': 29_089_168,
    'lost.trap': 5,
    'captured.npc': 8,
    'captured.valley': 93,
  };

  it('counts attacks and defences, won and in all', () => {
    expect(headline(c)).toMatchObject({ attacksWon: 10_722, attacks: 10_741, defensesWon: 2, defenses: 3 });
  });

  it('adds up the enemies defeated and names the type defeated most', () => {
    expect(headline(c)).toMatchObject({ enemies: 4_045_076_363 + 74_878_696 + 4_072_607, topEnemy: TroopKey.MILITIA });
  });

  it('counts the troops trained and those that fell for good, fortifications included', () => {
    expect(headline(c)).toMatchObject({ trained: 129_072_208, fell: 58_183_785 - 29_089_168 + 5 });
  });

  it('counts the honour and what was captured', () => {
    expect(headline(c)).toMatchObject({ honor: 12_302_039_702, citiesCaptured: 8, valleys: 93 });
    expect(headline({ 'captured.city': 1, 'captured.npc': 2 }).citiesCaptured).toBe(3);
  });

  it('is all nothing without counters', () => {
    expect(headline({})).toEqual({
      attacksWon: 0,
      attacks: 0,
      defensesWon: 0,
      defenses: 0,
      honor: 0,
      enemies: 0,
      topEnemy: null,
      trained: 0,
      fell: 0,
      citiesCaptured: 0,
      valleys: 0,
    });
  });
});
