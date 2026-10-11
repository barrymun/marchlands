import { describe, expect, it } from 'vitest';
import { itemGoldPrice, ItemId } from '@marchlands/core';
import { describeGrant, goldPriceOf, medalLevelOf } from '@/components/items-panel/utils';

describe(goldPriceOf.name, () => {
  it('returns the first item of the entry that is for sale, with its gold price', () => {
    expect(goldPriceOf({ ids: [ItemId.PLOWSHARES] })).toEqual({ id: ItemId.PLOWSHARES, price: itemGoldPrice(ItemId.PLOWSHARES) });
    expect(goldPriceOf({ ids: [ItemId.IRON_RAKE, ItemId.PLOWSHARES] })).toEqual({ id: ItemId.IRON_RAKE, price: itemGoldPrice(ItemId.IRON_RAKE) });
  });

  it('skips items that are not for sale', () => {
    expect(itemGoldPrice('unknown.item')).toBeNull();
    expect(goldPriceOf({ ids: ['unknown.item', ItemId.TRUCE_AGREEMENT] })).toEqual({
      id: ItemId.TRUCE_AGREEMENT,
      price: itemGoldPrice(ItemId.TRUCE_AGREEMENT),
    });
  });

  it('returns null when nothing in the entry is for sale', () => {
    expect(goldPriceOf({ ids: ['unknown.item'] })).toBeNull();
    expect(goldPriceOf({ ids: [] })).toBeNull();
  });
});

describe(describeGrant.name, () => {
  it('lists items by their name, falling back to the id', () => {
    expect(describeGrant({ items: { [ItemId.BEGINNER_GUIDELINES]: 5, 'unknown.item': 2 } })).toBe('5 × Beginner Guidelines, 2 × unknown.item');
  });

  it('lists resources with grouped numbers, calls wood lumber and skips zero or missing amounts', () => {
    expect(describeGrant({ resources: { food: 50_000, wood: 1_234, stone: 0, iron: undefined } })).toBe('50,000 food, 1,234 lumber');
  });

  it('lists troops by their display name, falling back to the key', () => {
    expect(describeGrant({ troops: { archer: 1_500, pikemen: 0, dragons: 3 } })).toBe('1,500 Archer, 3 dragons');
  });

  it('joins items, then resources, then troops', () => {
    expect(describeGrant({ troops: { militia: 10 }, resources: { gold: 2.9 }, items: { [ItemId.PRIMARY_GUIDELINES]: 3 } })).toBe(
      '3 × Primary Guidelines, 2 gold, 10 Warrior',
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
    expect(medalLevelOf([ItemId.NATION_MEDAL])).toBe(9);
  });

  it('uses the first medal among the ids', () => {
    expect(medalLevelOf([ItemId.PLOWSHARES, ItemId.HONOUR_MEDAL, ItemId.FREEDOM_MEDAL])).toBe(4);
  });

  it('returns null for other items and out-of-range or malformed ids', () => {
    expect(medalLevelOf([])).toBeNull();
    expect(medalLevelOf([ItemId.PLOWSHARES])).toBeNull();
    expect(medalLevelOf(['hero.loyalty.0', 'hero.loyalty.10', 'hero.loyalty.1.b', 'xhero.loyalty.1'])).toBeNull();
  });
});
