// Quests (data-quests names, msg-questInfo descriptions and targets), nobility titles (data-titles) and hero
// gear pieces (data-gear): everything the game defines is named, and worded in every full locale.

import { afterEach, describe, expect, it } from 'vitest';

import { GEAR_PIECE_IDS, QUEST_CATALOGUE, questGroups, questTargetMessage, TITLES } from '@marchlands/core';

import { gearName, questGroupName, questName, titleName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';
import gear from '@/locales/en-GB/data-gear.json';
import quests from '@/locales/en-GB/data-quests.json';
import titles from '@/locales/en-GB/data-titles.json';

const sorted = (ids: (string | number)[]) => ids.map(String).sort();

afterEach(async () => {
  await i18n.changeLanguage('en-GB');
});

describe('data-quests', () => {
  it('names every quest and every quest group in en-GB, and nothing else', () => {
    expect(sorted(Object.keys(quests.quest))).toEqual(sorted(QUEST_CATALOGUE.map((q) => q.id)));
    expect(sorted(Object.keys(quests.group))).toEqual(sorted(questGroups().map((g) => g.id)));
  });

  it('is looked up by id', async () => {
    expect(questName(1000)).toBe('Town Hall');
    expect(questGroupName(11)).toBe('Hero Recruitment');
    expect(questName(1)).toBe('1');
    await i18n.changeLanguage('ja-JP');
    expect(questName(1030)).toBe('期待の新星');
  });
});

describe('quest descriptions and targets', () => {
  it('words every quest in every full locale', async () => {
    for (const lng of ['en-GB', 'ja-JP']) {
      await i18n.changeLanguage(lng);
      for (const q of QUEST_CATALOGUE)
        for (const m of [q.description, ...q.targets.map(questTargetMessage)])
          expect(translateMessage(m), `${lng} ${q.id} ${m.code}`).not.toMatch(/\{\{|questInfo\.|^$/);
    }
  });

  it('names the buildings, troops and numbers from the quest data', () => {
    const q = (id: number) => QUEST_CATALOGUE.find((x) => x.id === id)!;
    expect(translateMessage(q(1000).description)).toBe('Upgrade your Town Hall to level 2.');
    expect(translateMessage(questTargetMessage(q(1000).targets[0]!))).toBe('Town Hall level 2');
    expect(translateMessage(q(1014).description)).toBe('Own 5 Farm fields.');
    expect(translateMessage(questTargetMessage(q(1014).targets[0]!))).toBe('5 × Farm at level 1 or higher');
    expect(translateMessage(questTargetMessage(q(1025).targets[0]!))).toBe('100 × Warrior');
    expect(translateMessage(questTargetMessage(q(1026).targets[0]!))).toBe('100 × Trap');
    expect(translateMessage(questTargetMessage(q(1030).targets[0]!))).toBe('10,000 prestige');
    expect(translateMessage(questTargetMessage({ kind: 'cities', count: 1 }))).toBe('Own 1 city');
  });
});

describe('data-titles', () => {
  it('names every title in en-GB, and nothing else', () => {
    expect(sorted(Object.keys(titles))).toEqual(sorted(TITLES.map((t) => t.id)));
  });

  it('is looked up by id', async () => {
    expect(titleName(1)).toBe('Knight');
    await i18n.changeLanguage('ja-JP');
    expect(titleName(1)).toBe('騎士');
  });
});

describe('data-gear', () => {
  it('names every gear piece in en-GB, and nothing else', () => {
    expect(sorted(Object.keys(gear))).toEqual(sorted([...GEAR_PIECE_IDS]));
  });

  it('is looked up by id', async () => {
    expect(gearName('head')).toBe('Head Gear');
    await i18n.changeLanguage('ja-JP');
    expect(gearName('head')).toBe('頭部装備');
  });
});
