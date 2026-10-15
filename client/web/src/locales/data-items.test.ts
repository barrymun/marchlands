// Item names (data-items, with short names for medals), item categories (data-item-categories) and item
// descriptions (msg-itemInfo, core ITEM_INFO): every item the game defines is named and described in
// every full locale.

import { afterEach, describe, expect, it } from 'vitest';

import { ITEM_CATEGORY_IDS, ITEM_INFO, ItemId, itemInfo, ITEMS, medalId } from '@marchlands/core';

import { itemCategoryName, itemName, itemShortName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';
import categories from '@/locales/en-GB/data-item-categories.json';
import enGB from '@/locales/en-GB/data-items.json';

const ids = ITEMS.map((i) => i.id);
const medals = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(medalId);

afterEach(async () => {
  await i18n.changeLanguage('en-GB');
});

describe('data-items', () => {
  it('names every item in en-GB, plus a short name for every medal, and nothing else', () => {
    expect(Object.keys(enGB).sort()).toEqual([...ids, ...medals.map((m) => `${m}.short`)].sort());
  });

  it('is looked up by id', async () => {
    expect(itemName(ItemId.TRUCE_AGREEMENT)).toBe('Truce Agreement');
    expect(itemName('unknown.item')).toBe('unknown.item');
    await i18n.changeLanguage('ja-JP');
    expect(itemName(ItemId.TRUCE_AGREEMENT)).toBe('休戦協定');
  });

  it('gives medals a short name, and other items their name', async () => {
    expect(itemShortName(ItemId.CROSS_MEDAL)).toBe('Cross');
    expect(itemShortName(ItemId.HONOUR_MEDAL)).toBe('Honour');
    expect(itemShortName(ItemId.TRUCE_AGREEMENT)).toBe('Truce Agreement');
    await i18n.changeLanguage('en-US');
    expect(itemShortName(ItemId.HONOUR_MEDAL)).toBe('Honor');
    await i18n.changeLanguage('ja-JP');
    expect(itemShortName(ItemId.CROSS_MEDAL)).toBe('十字');
  });
});

describe('data-item-categories', () => {
  it('names every item category in en-GB, and nothing else', () => {
    expect(Object.keys(categories).map(Number)).toEqual(ITEM_CATEGORY_IDS);
  });

  it('is looked up by id', async () => {
    expect(itemCategoryName(1)).toBe('Speed-ups');
    await i18n.changeLanguage('ja-JP');
    expect(itemCategoryName(1)).toBe('スピードアップ');
  });
});

describe('item descriptions', () => {
  it('describes every item in every full locale', async () => {
    for (const lng of ['en-GB', 'ja-JP']) {
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
    expect(text(ItemId.PLOWSHARES)).toBe('+25% food production for 1 day. Using another extends the time.');
    expect(text(ItemId.IRON_RAKE)).toBe('+25% food production for 7 days. Using another extends the time.');
    expect(text(ItemId.BEGINNER_GUIDELINES)).toBe('Cuts 15 minutes off a construction or research.');
    expect(text(ItemId.INTERMEDIATE_GUIDELINES)).toBe('Cuts 2.5 hours off a construction or research.');
    expect(text(ItemId.MASTER_GUIDELINES)).toBe('Cuts 10–30 hours (at random) off a construction or research.');
    expect(text(ItemId.ULTIMATE_GUIDELINES)).toBe('Cuts 30% of the total time off a construction or research.');
    expect(text(ItemId.JUNIOR_MEDAL_BOX)).toBe('Contains 2–4 each of Cross Medal, Rose Medal, Lion Medal.');
    expect(text(ItemId.NEWBIES_PACKAGE)).toBe(
      'Gives 5 × Beginner Guidelines, 3 × Primary Guidelines, 50,000 food, 50,000 lumber, 50,000 stone, 50,000 iron to the current city.',
    );
    expect(text(ItemId.EXCALIBUR)).toBe("Raises one hero's Attack by 25% for 1 day.");
    expect(text(ItemId.ANABASIS)).toBe('Gives a hero experience: 8% of the next level, at least 1,000.');
    expect(text(ItemId.ON_WAR)).toBe('Gives a hero experience: a full level, at least 100,000.');
    expect(text(ItemId.TRUCE_AGREEMENT)).toBe('Truce: your cities cannot be attacked for 12 hours, but you cannot attack either.');
    expect(text(ItemId.HERO_PACKAGE)).toBe('Recruits a level 30 hero with every base stat at least 55. Needs a free Feasting Hall slot.');
  });
});
