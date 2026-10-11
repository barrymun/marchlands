// Troop and fortification names (data-troops) and descriptions (msg-troopInfo, core troopDescription):
// every troop and fortification the game defines is named and described in every full locale.

import { afterEach, describe, expect, it } from 'vitest';
import { TROOPS, troopDescription } from '@marchlands/core';
import enGB from '@/locales/en-GB/data-troops.json';
import { troopName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';

const ids = TROOPS.map((t) => t.troopId);

afterEach(async () => {
  await i18n.changeLanguage('en-GB');
});

describe('data-troops', () => {
  it('names every troop and fortification in en-GB, and nothing else', () => {
    expect(
      Object.keys(enGB)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([...ids].sort((a, b) => a - b));
  });

  it('is looked up by id', async () => {
    expect(troopName(7)).toBe('Archer');
    expect(troopName(16)).toBe("Archer's Tower");
    expect(troopName(99)).not.toBe('');
    await i18n.changeLanguage('ja-JP');
    expect(troopName(7)).toBe('弓兵');
  });
});

describe('troop descriptions', () => {
  it('describes every troop and fortification in every full locale', async () => {
    for (const lng of ['en-GB', 'ja-JP']) {
      await i18n.changeLanguage(lng);
      for (const id of ids) {
        const text = translateMessage(troopDescription(id)!);
        expect(text, `${lng} ${id}`).not.toMatch(/\{\{|troopInfo\.|^$/);
      }
    }
  });

  it('names the troops, numbers and research it refers to', () => {
    expect(translateMessage(troopDescription(5)!)).toBe('Melee spearmen built to stop horses: they deal ×1.8 damage to Cavalry and Cataphract units.');
    expect(translateMessage(troopDescription(7)!)).toContain("(Archer, Ballista, Catapult, Archer's Tower)");
    expect(translateMessage(troopDescription(16)!)).toContain('Improved by the research Archery, Medicine, Iron Working.');
    expect(translateMessage(troopDescription(14)!)).toMatch(/Takes \d+ wall space\.$/);
  });
});
