import { describe, expect, it } from 'vitest';
import { itemGoldPrice, ItemId } from '@marchlands/core';
import { describeGrant, goldPriceOf, medalLevelOf } from '@/components/items-panel/utils';

describe(goldPriceOf.name, () => {
  it('returns the first item of the entry that is for sale, with its gold price', () => {
    expect(goldPriceOf({ ids: [ItemId.PLOUGHSHARE] })).toEqual({ id: ItemId.PLOUGHSHARE, price: itemGoldPrice(ItemId.PLOUGHSHARE) });
    expect(goldPriceOf({ ids: [ItemId.HEAVY_PLOUGH, ItemId.PLOUGHSHARE] })).toEqual({ id: ItemId.HEAVY_PLOUGH, price: itemGoldPrice(ItemId.HEAVY_PLOUGH) });
  });

  it('skips items that are not for sale', () => {
    expect(itemGoldPrice('unknown.item')).toBeNull();
    expect(goldPriceOf({ ids: ['unknown.item', ItemId.KINGS_PEACE] })).toEqual({
      id: ItemId.KINGS_PEACE,
      price: itemGoldPrice(ItemId.KINGS_PEACE),
    });
  });

  it('returns null when nothing in the entry is for sale', () => {
    expect(goldPriceOf({ ids: ['unknown.item'] })).toBeNull();
    expect(goldPriceOf({ ids: [] })).toBeNull();
  });
});

describe(describeGrant.name, () => {
  it('lists items by their name, falling back to the id', () => {
    expect(describeGrant({ items: { [ItemId.NOVICES_NOTES]: 5, 'unknown.item': 2 } })).toBe("5 × Novice's Notes, 2 × unknown.item");
  });

  it('lists resources with grouped numbers, calls wood lumber and skips zero or missing amounts', () => {
    expect(describeGrant({ resources: { food: 50_000, wood: 1_234, stone: 0, iron: undefined } })).toBe('50,000 food, 1,234 lumber');
  });

  it('lists troops by their display name, falling back to the key', () => {
    expect(describeGrant({ troops: { archer: 1_500, pikemen: 0, dragons: 3 } })).toBe('1,500 Archer, 3 dragons');
  });

  it('joins items, then resources, then troops', () => {
    expect(describeGrant({ troops: { militia: 10 }, resources: { gold: 2.9 }, items: { [ItemId.APPRENTICES_NOTES]: 3 } })).toBe(
      "3 × Apprentice's Notes, 2 gold, 10 Warrior",
    );
  });

  it('says nothing for an empty grant', () => {
    expect(describeGrant({})).toBe('nothing');
    expect(describeGrant({ items: {}, resources: { food: 0 }, troops: { archer: undefined } })).toBe('nothing');
  });
});

describe(medalLevelOf.name, () => {
  it('reads the level of a medal item', () => {
    expect(medalLevelOf([ItemId.CROSS_MEDAL])).toBe(1);
    expect(medalLevelOf([ItemId.CROWN_MEDAL])).toBe(9);
  });

  it('uses the first medal among the ids', () => {
    expect(medalLevelOf([ItemId.PLOUGHSHARE, ItemId.HONOUR_MEDAL, ItemId.FIDELITY_MEDAL])).toBe(4);
  });

  it('returns null for other items and out-of-range or malformed ids', () => {
    expect(medalLevelOf([])).toBeNull();
    expect(medalLevelOf([ItemId.PLOUGHSHARE])).toBeNull();
    expect(medalLevelOf(['hero.loyalty.0', 'hero.loyalty.10', 'hero.loyalty.1.b', 'xhero.loyalty.1'])).toBeNull();
  });
});
