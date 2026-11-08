// Item names (data-items, with short names for medals), item categories (data-item-categories) and item
// descriptions (msg-itemInfo, core ITEM_INFO): every item the game defines is named and described in
// every full locale.

import { afterEach, describe, expect, it } from 'vitest';

import { ITEM_CATEGORY_IDS, ITEM_INFO, ItemId, itemInfo, ITEMS, medalId } from '@marchlands/core';

import { itemCategoryName, itemName, itemShortName } from '@/lib/game-data';
import { i18n, Locale } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';
import categories from '@/locales/en-GB/data-item-categories.json';
import enGB from '@/locales/en-GB/data-items.json';

const ids = ITEMS.map((i) => i.id);
const medals = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(medalId);

afterEach(async () => {
  await i18n.changeLanguage(Locale.EN_GB);
});

describe('data-items', () => {
  it('names every item in en-GB, plus a short name for every medal, and nothing else', () => {
    expect(Object.keys(enGB).sort()).toEqual([...ids, ...medals.map((m) => `${m}.short`)].sort());
  });

  it('is looked up by id', async () => {
    expect(itemName(ItemId.KINGS_PEACE)).toBe("King's Peace");
    expect(itemName('unknown.item')).toBe('unknown.item');
    await i18n.changeLanguage(Locale.JA_JP);
    expect(itemName(ItemId.KINGS_PEACE)).toBe('王の平和');
  });

  it('gives medals a short name, and other items their name', async () => {
    expect(itemShortName(ItemId.CROSS_MEDAL)).toBe('Cross');
    expect(itemShortName(ItemId.HONOUR_MEDAL)).toBe('Honour');
    expect(itemShortName(ItemId.KINGS_PEACE)).toBe("King's Peace");
    await i18n.changeLanguage(Locale.EN_US);
    expect(itemShortName(ItemId.HONOUR_MEDAL)).toBe('Honor');
    await i18n.changeLanguage(Locale.JA_JP);
    expect(itemShortName(ItemId.CROSS_MEDAL)).toBe('十字');
  });
});

describe('data-item-categories', () => {
  it('names every item category in en-GB, and nothing else', () => {
    expect(Object.keys(categories).map(Number)).toEqual(ITEM_CATEGORY_IDS);
  });

  it('is looked up by id', async () => {
    expect(itemCategoryName(1)).toBe('Speed-ups');
    await i18n.changeLanguage(Locale.JA_JP);
    expect(itemCategoryName(1)).toBe('スピードアップ');
  });
});

describe('item descriptions', () => {
  it('describes every item in every full locale', async () => {
    for (const lng of [Locale.EN_GB, Locale.JA_JP]) {
      await i18n.changeLanguage(lng);
      for (const info of ITEM_INFO) {
        for (const m of [info.description, ...(info.howTo ? [info.howTo] : [])]) {
          const text = translateMessage(m);
          expect(text, `${lng} ${info.id}`).not.toMatch(/\{\{|itemInfo\.|buff\.|^$/);
        }
      }
    }
  });

  it('names the items, numbers and durations it refers to', () => {
    const text = (id: string) => translateMessage(itemInfo(id)!.description);
    expect(text(ItemId.PLOUGHSHARE)).toBe('+25% food production for 1 day. Using another extends the time.');
    expect(text(ItemId.HEAVY_PLOUGH)).toBe('+25% food production for 7 days. Using another extends the time.');
    expect(text(ItemId.NOVICES_NOTES)).toBe('Cuts 15 minutes off a construction or research.');
    expect(text(ItemId.JOURNEYMANS_NOTES)).toBe('Cuts 2.5 hours off a construction or research.');
    expect(text(ItemId.GRANDMASTERS_NOTES)).toBe('Cuts 10–30 hours (at random) off a construction or research.');
    expect(text(ItemId.VILLARDS_SKETCHBOOK)).toBe('Cuts 30% of the total time off a construction or research.');
    expect(text(ItemId.BRONZE_COFFER)).toBe('Contains 2–4 each of Cross Medal, Rose Medal, Lion Medal.');
    expect(text(ItemId.GOLD_COFFER)).toBe('Contains 2–4 each of Fidelity Medal, Justice Medal, Crown Medal.');
    expect(text(ItemId.FOUNDERS_GIFT)).toBe(
      "Gives 5 × Novice's Notes, 3 × Apprentice's Notes, 50,000 food, 50,000 lumber, 50,000 stone, 50,000 iron to the current city.",
    );
    expect(text(ItemId.JOYEUSE)).toBe("Raises one hero's Attack by 25% for 1 day.");
    expect(text(ItemId.DEEDS_OF_THE_SAXONS)).toBe('Gives a hero experience: 8% of the next level, at least 1,000.');
    expect(text(ItemId.NIBELUNGENLIED)).toBe('Gives a hero experience: a full level, at least 100,000.');
    expect(text(ItemId.KINGS_PEACE)).toBe('Truce: your cities cannot be attacked for 12 hours, but you cannot attack either.');
    expect(text(ItemId.OATH_OF_FEALTY)).toBe('Recruits a level 30 hero with every base stat at least 55. Needs a free Feasting Hall slot.');
  });
});
