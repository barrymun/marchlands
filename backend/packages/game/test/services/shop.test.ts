import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Feature, itemConfig, itemGoldPrice, ItemId, ITEMS, setFeatureFlags } from '@marchlands/core';
import { catalogue } from '#/services/shop.ts';

describe(catalogue.name, () => {
  beforeEach(() => setFeatureFlags({ [Feature.PVP]: true }));
  afterEach(() => setFeatureFlags({ [Feature.PVP]: false }));

  it('lists every item with a gold price once, at that price, under its type', () => {
    const groups = catalogue();
    const listed = groups.flatMap((g) => g.items.map((i) => ({ ...i, typeId: g.typeId })));
    const forSale = ITEMS.filter((i) => itemGoldPrice(i.id) != null);
    expect(listed.map((i) => i.id).sort()).toEqual(forSale.map((i) => i.id).sort());
    for (const i of listed) {
      expect(i.price).toBe(itemGoldPrice(i.id));
      expect(i.typeId).toBe(itemConfig(i.id)!.type);
      expect(i.dayLimit).toBe(itemConfig(i.id)!.dayLimit);
    }
  });

  it('leaves out the Truce Agreement alone with PvP off', () => {
    const on = catalogue().flatMap((g) => g.items.map((i) => i.id));
    setFeatureFlags({ [Feature.PVP]: false });
    const off = catalogue().flatMap((g) => g.items.map((i) => i.id));
    expect(on.filter((id) => !off.includes(id))).toEqual([ItemId.TRUCE_AGREEMENT]);
  });

  it('leaves out items that are not for sale, and sorts the groups by type', () => {
    const groups = catalogue();
    const ids = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
    const notForSale = ITEMS.filter((i) => itemGoldPrice(i.id) == null);
    expect(notForSale.length).toBeGreaterThan(0);
    for (const i of notForSale) expect(ids.has(i.id)).toBe(false);
    const types = groups.map((g) => g.typeId);
    expect(types).toEqual([...new Set(types)].sort((a, b) => a - b));
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });
});
