import { describe, expect, it } from 'vitest';
import { itemConfig, itemGoldPrice } from '@marchlands/core';
import { describeGrant, goldPriceOf, medalLevelOf } from '@/components/items-panel/utils';

describe(goldPriceOf.name, () => {
  it('returns the first item of the entry that is for sale, with its gold price', () => {
    expect(goldPriceOf({ ids: ['player.resinc.1'] })).toEqual({ id: 'player.resinc.1', price: itemGoldPrice('player.resinc.1') });
    expect(goldPriceOf({ ids: ['player.resinc.1.b', 'player.resinc.1'] })).toEqual({ id: 'player.resinc.1.b', price: itemGoldPrice('player.resinc.1.b') });
  });

  it('skips items that are not for sale', () => {
    expect(itemGoldPrice('unknown.item')).toBeNull();
    expect(goldPriceOf({ ids: ['unknown.item', 'player.peace.1'] })).toEqual({ id: 'player.peace.1', price: itemGoldPrice('player.peace.1') });
  });

  it('returns null when nothing in the entry is for sale', () => {
    expect(goldPriceOf({ ids: ['unknown.item'] })).toBeNull();
    expect(goldPriceOf({ ids: [] })).toBeNull();
  });
});

describe(describeGrant.name, () => {
  it('lists items by their trimmed name, falling back to the id', () => {
    const name = itemConfig('consume.2.a')!.name.trim();
    expect(describeGrant({ items: { 'consume.2.a': 5, 'unknown.item': 2 } })).toBe(`5 × ${name}, 2 × unknown.item`);
  });

  it('lists resources with grouped numbers, calls wood lumber and skips zero or missing amounts', () => {
    expect(describeGrant({ resources: { food: 50_000, wood: 1_234, stone: 0, iron: undefined } })).toBe('50,000 food, 1,234 lumber');
  });

  it('lists troops by their display name, falling back to the key', () => {
    expect(describeGrant({ troops: { archer: 1_500, pikemen: 0, dragons: 3 } })).toBe('1,500 Archer, 3 dragons');
  });

  it('joins items, then resources, then troops', () => {
    const name = itemConfig('consume.2.b')!.name.trim();
    expect(describeGrant({ troops: { militia: 10 }, resources: { gold: 2.9 }, items: { 'consume.2.b': 3 } })).toBe(`3 × ${name}, 2 gold, 10 Warrior`);
  });

  it('says nothing for an empty grant', () => {
    expect(describeGrant({})).toBe('nothing');
    expect(describeGrant({ items: {}, resources: { food: 0 }, troops: { archer: undefined } })).toBe('nothing');
  });
});

describe(medalLevelOf.name, () => {
  it('reads the level of a medal item', () => {
    expect(medalLevelOf(['hero.loyalty.1'])).toBe(1);
    expect(medalLevelOf(['hero.loyalty.9'])).toBe(9);
  });

  it('uses the first medal among the ids', () => {
    expect(medalLevelOf(['player.resinc.1', 'hero.loyalty.4', 'hero.loyalty.7'])).toBe(4);
  });

  it('returns null for other items and out-of-range or malformed ids', () => {
    expect(medalLevelOf([])).toBeNull();
    expect(medalLevelOf(['player.resinc.1'])).toBeNull();
    expect(medalLevelOf(['hero.loyalty.0', 'hero.loyalty.10', 'hero.loyalty.1.b', 'xhero.loyalty.1'])).toBeNull();
  });
});
