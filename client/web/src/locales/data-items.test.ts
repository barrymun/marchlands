// Item names (data-items, with short names for medals), item categories (data-item-categories) and item
// descriptions (msg-itemInfo, core ITEM_INFO): every item the game defines is named and described in
// every full locale.

import { afterEach, describe, expect, it } from 'vitest';
import { ITEM_CATEGORY_IDS, ITEM_INFO, ITEMS, itemInfo, medalId } from '@marchlands/core';
import enGB from '@/locales/en-GB/data-items.json';
import categories from '@/locales/en-GB/data-item-categories.json';
import { itemCategoryName, itemName, itemShortName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';

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
    expect(itemName('player.peace.1')).toBe('Truce Agreement');
    expect(itemName('unknown.item')).toBe('unknown.item');
    await i18n.changeLanguage('ja-JP');
    expect(itemName('player.peace.1')).toBe('休戦協定');
  });

  it('gives medals a short name, and other items their name', async () => {
    expect(itemShortName('hero.loyalty.1')).toBe('Cross');
    expect(itemShortName('hero.loyalty.4')).toBe('Honour');
    expect(itemShortName('player.peace.1')).toBe('Truce Agreement');
    await i18n.changeLanguage('en-US');
    expect(itemShortName('hero.loyalty.4')).toBe('Honor');
    await i18n.changeLanguage('ja-JP');
    expect(itemShortName('hero.loyalty.1')).toBe('十字');
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
    expect(text('player.resinc.1')).toBe('+25% food production for 1 day. Using another extends the time.');
    expect(text('player.resinc.1.b')).toBe('+25% food production for 7 days. Using another extends the time.');
    expect(text('consume.2.a')).toBe('Cuts 15 minutes off a construction or research.');
    expect(text('consume.2.b.1')).toBe('Cuts 2.5 hours off a construction or research.');
    expect(text('consume.2.c.1')).toBe('Cuts 10–30 hours (at random) off a construction or research.');
    expect(text('consume.2.d')).toBe('Cuts 30% of the total time off a construction or research.');
    expect(text('player.box.special.1')).toBe('Contains 2–4 each of Cross Medal, Rose Medal, Lion Medal.');
    expect(text('player.box.present.2')).toBe(
      'Gives 5 × Beginner Guidelines, 3 × Primary Guidelines, 50,000 food, 50,000 lumber, 50,000 stone, 50,000 iron to the current city.',
    );
    expect(text('hero.power.1')).toBe("Raises one hero's Attack by 25% for 1 day.");
    expect(text('player.experience.1.a')).toBe('Gives a hero experience: 8% of the next level, at least 1,000.');
    expect(text('player.experience.1.c')).toBe('Gives a hero experience: a full level, at least 100,000.');
    expect(text('player.peace.1')).toBe('Truce: your cities cannot be attacked for 12 hours, but you cannot attack either.');
    expect(text('player.box.currently.1')).toBe('Recruits a level 30 hero with every base stat at least 55. Needs a free Feasting Hall slot.');
  });
});
