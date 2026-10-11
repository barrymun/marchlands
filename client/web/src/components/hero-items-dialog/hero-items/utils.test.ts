import { describe, expect, it } from 'vitest';
import { BALANCE, experienceItemGain, ItemId, medalId } from '@marchlands/core';
import { experienceItems, isLoyaltyFull, loyaltyMedals } from '@/components/hero-items-dialog/hero-items/utils';

describe(experienceItems.name, () => {
  it('lists every experience book, smallest first', () => {
    expect(experienceItems()).toEqual([ItemId.ANABASIS, ItemId.EPITOME_OF_MILITARY_SCIENCE, ItemId.ON_WAR]);
    expect([...experienceItems()].sort()).toEqual(Object.keys(BALANCE.items.experienceBooks).sort());
    const gains = experienceItems().map((id) => experienceItemGain(id, 0));
    expect(gains).toEqual([...gains].sort((a, b) => a - b));
  });
});

describe(loyaltyMedals.name, () => {
  it('lists the nine medals with the loyalty each gives', () => {
    const medals = loyaltyMedals();
    expect(medals.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(medalId));
    expect(medals[0]).toEqual({ id: ItemId.CROSS_MEDAL, loyalty: BALANCE.items.medalLoyalty[ItemId.CROSS_MEDAL] });
    expect(medals.at(-1)!.loyalty).toBe(60);
  });
});

describe(isLoyaltyFull.name, () => {
  it('is full at BALANCE.heroMaxLoyalty and above', () => {
    expect(isLoyaltyFull(0)).toBe(false);
    expect(isLoyaltyFull(BALANCE.heroMaxLoyalty - 1)).toBe(false);
    expect(isLoyaltyFull(BALANCE.heroMaxLoyalty)).toBe(true);
    expect(isLoyaltyFull(BALANCE.heroMaxLoyalty + 5)).toBe(true);
  });
});
