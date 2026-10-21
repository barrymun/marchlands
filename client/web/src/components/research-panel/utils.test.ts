import { afterEach, describe, expect, it } from 'vitest';

import { BuildingType, TECH_IDS, techEffect, techInfo, TechType, TroopType } from '@marchlands/core';

import { unlockName } from '@/components/research-panel/utils';
import { techName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';

afterEach(async () => {
  await i18n.changeLanguage('en-GB');
});

describe(unlockName.name, () => {
  it('names a building, troop or technology by its kind and id', async () => {
    expect(unlockName({ kind: 'building', id: BuildingType.ACADEMY })).toBe('Academy');
    expect(unlockName({ kind: 'troop', id: TroopType.ARCHER })).toBe('Archer');
    expect(unlockName({ kind: 'tech', id: TechType.MASONRY })).toBe('Masonry');
    await i18n.changeLanguage('ja-JP');
    expect(unlockName({ kind: 'tech', id: TechType.MASONRY })).toBe('石工術');
  });

  it('names everything a technology unlocks', () => {
    for (const id of TECH_IDS)
      for (const u of techInfo(id).unlocks) expect(i18n.exists(String(u.id), { ns: `data-${u.kind}s` }), `${u.kind} ${u.id}`).toBe(true);
  });
});

describe(techName.name, () => {
  it('has a name for every technology in en-GB and ja-JP', async () => {
    for (const id of TECH_IDS) expect(i18n.exists(String(id), { ns: 'data-techs', lng: 'en-GB' }), `tech ${id}`).toBe(true);
    await i18n.changeLanguage('ja-JP');
    for (const id of TECH_IDS) expect(techName(id), `tech ${id}`).not.toMatch(/[A-Z]/i);
  });
});

describe(translateMessage.name, () => {
  it('words technology summaries and effects', async () => {
    expect(translateMessage(techInfo(TechType.LUMBERING).summary)).toBe('+10% lumber production per level (on field output).');
    expect(translateMessage(techEffect(TechType.CONSTRUCTION, 2)!)).toBe('−19% build, demolish and fortification time');
    expect(translateMessage(techInfo(TechType.METAL_CASTING).summary)).toBe(
      'Training time of siege units (Transporter, Ballista, Battering Ram, Catapult) ×0.9 per level.',
    );
    await i18n.changeLanguage('ja-JP');
    expect(translateMessage(techEffect(TechType.AGRICULTURE, 3)!)).toBe('食料の生産量 +30%');
  });

  it('leaves no placeholder unfilled', async () => {
    for (const lng of ['en-GB', 'ja-JP']) {
      await i18n.changeLanguage(lng);
      for (const id of TECH_IDS) {
        expect(translateMessage(techInfo(id).summary)).not.toMatch(/\{\{|techInfo/);
        for (let level = 1; level <= 3; level++) {
          const effect = techEffect(id, level);
          if (effect) expect(translateMessage(effect)).not.toMatch(/\{\{|techInfo/);
        }
      }
    }
  });
});
