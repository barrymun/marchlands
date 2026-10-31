import { describe, expect, it } from 'vitest';

import { BALANCE, FACTION_IDS } from '@marchlands/core';

import { FACTION_STYLE, standingText, standingTierName, standingTone } from '@/lib/factions';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';

const R = BALANCE.reputation;

describe('FACTION_STYLE', () => {
  it('gives every faction a swatch and a tint', () => {
    expect(Object.keys(FACTION_STYLE).sort()).toEqual([...FACTION_IDS].sort());
  });
});

describe(standingText.name, () => {
  it('signs a standing and shows one decimal at most', () => {
    expect(standingText(12.5)).toBe('+12.5');
    expect(standingText(-3)).toBe('−3');
    expect(standingText(-1.54)).toBe('−1.5');
  });

  it('shows no sign for what rounds to 0', () => {
    expect(standingText(0)).toBe('0');
    expect(standingText(0.04)).toBe('0');
    expect(standingText(-0.04)).toBe('0');
  });
});

describe(standingTierName.name, () => {
  it("names a standing's band", () => {
    expect(standingTierName(R.refuseBelow)).toBe('Hostile');
    expect(standingTierName(0)).toBe('Neutral');
    expect(standingTierName(R.max)).toBe('Honoured');
  });
});

describe(standingTone.name, () => {
  it('reads below neutral as a loss and above it as a gain', () => {
    expect(standingTone(R.refuseBelow)).toBe(LOSS_TEXT);
    expect(standingTone(R.tiers.unfriendly - 1)).toBe(LOSS_TEXT);
    expect(standingTone(0)).toBe('');
    expect(standingTone(R.tiers.friendly + 1)).toBe(GAIN_TEXT);
    expect(standingTone(R.max)).toBe(GAIN_TEXT);
  });
});
