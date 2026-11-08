import { describe, expect, it } from 'vitest';
import { GameRefKind, ResourceKey } from '#/constants.ts';
import { BALANCE, HOUR, ITEM_CATEGORY_IDS, ITEM_INFO, ItemId, itemInfo, ITEMS, medalSources } from '#/index.ts';

describe(itemInfo.name, () => {
  it('describes every item with an itemInfo message, and its category by id', () => {
    for (const i of ITEMS) {
      const info = itemInfo(i.id)!;
      expect(info.description.code, i.id).toMatch(/^itemInfo\./);
      if (info.howTo) expect(info.howTo.code, i.id).toMatch(/^itemInfo\.howTo\./);
      expect(info.category).toBe(i.type);
      expect(info).not.toHaveProperty('name');
    }
  });

  it('is undefined for an unknown id', () => {
    expect(itemInfo('unknown.item')).toBeUndefined();
  });

  it('nests the buff description and the period', () => {
    expect(itemInfo(ItemId.HEAVY_PLOUGH)!.description).toEqual({
      code: 'itemInfo.buff',
      params: {
        effect: {
          code: 'buff.production',
          params: { resource: { ref: GameRefKind.RESOURCE, id: ResourceKey.FOOD }, percent: { share: BALANCE.resourceBuffBonus } },
        },
        period: { code: 'itemInfo.period.days', params: { count: 7 } },
      },
    });
  });

  it('derives speed-ups from what they cut', () => {
    expect(itemInfo(ItemId.NOVICES_NOTES)!.description).toEqual({
      code: 'itemInfo.speedup.time',
      params: { time: { code: 'itemInfo.period.minutes', params: { count: 15 } } },
    });
    expect(itemInfo(ItemId.GRANDMASTERS_NOTES)!.description).toEqual({ code: 'itemInfo.speedup.hours', params: { min: 10, count: 30 } });
    expect(itemInfo(ItemId.VILLARDS_SKETCHBOOK)!.description).toEqual({ code: 'itemInfo.speedup.percent', params: { percent: { share: 0.3 } } });
    expect(itemInfo(ItemId.OTTOS_MUSTER_ROLL)!.description).toEqual({ code: 'itemInfo.speedup.troopBatch', params: { percent: { share: 0.3 } } });
  });

  it('quotes cooldowns from BALANCE and refers to items by id', () => {
    expect(itemInfo(ItemId.LOCATORS_CHARTER)!.description.params?.period).toEqual({
      code: 'itemInfo.period.hours',
      params: { count: BALANCE.teleportCooldownMs / HOUR },
    });
    expect(itemInfo(ItemId.SILVER_COFFER)!.description.params?.medals).toEqual(
      [ItemId.HONOUR_MEDAL, ItemId.COURAGE_MEDAL, ItemId.WISDOM_MEDAL].map((id) => ({ ref: GameRefKind.ITEM, id })),
    );
  });
});

describe('ITEM_INFO', () => {
  it('lists every item once, by category', () => {
    expect(ITEM_INFO.map((i) => i.id).sort()).toEqual(ITEMS.map((i) => i.id).sort());
    const cats = ITEM_INFO.map((i) => i.category);
    expect(cats).toEqual([...cats].sort((a, b) => a - b));
    expect(ITEM_CATEGORY_IDS).toEqual([0, 1, 2, 3, 4]);
  });
});

describe(medalSources.name, () => {
  it('refers to containers and their keys by item id', () => {
    for (const c of medalSources(1).containers) {
      expect(ITEMS.some((i) => i.id === c.id)).toBe(true);
      expect(c).not.toHaveProperty('name');
    }
  });

  it('lists only containers the shop sells, so not the medal boxes (BALANCE.notInShop)', () => {
    for (let level = 1; level <= 9; level++) expect(medalSources(level).containers.map((c) => c.id)).not.toContain(ItemId.BRONZE_COFFER);
  });
});
