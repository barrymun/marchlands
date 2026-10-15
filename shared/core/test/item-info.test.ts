import { describe, expect, it } from 'vitest';
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
    expect(itemInfo(ItemId.IRON_RAKE)!.description).toEqual({
      code: 'itemInfo.buff',
      params: {
        effect: { code: 'buff.production', params: { resource: { ref: 'resource', id: 'food' }, percent: { share: BALANCE.resourceBuffBonus } } },
        period: { code: 'itemInfo.period.days', params: { count: 7 } },
      },
    });
  });

  it('derives speed-ups from what they cut', () => {
    expect(itemInfo(ItemId.BEGINNER_GUIDELINES)!.description).toEqual({
      code: 'itemInfo.speedup.time',
      params: { time: { code: 'itemInfo.period.minutes', params: { count: 15 } } },
    });
    expect(itemInfo(ItemId.MASTER_GUIDELINES)!.description).toEqual({ code: 'itemInfo.speedup.hours', params: { min: 10, count: 30 } });
    expect(itemInfo(ItemId.ULTIMATE_GUIDELINES)!.description).toEqual({ code: 'itemInfo.speedup.percent', params: { percent: { share: 0.3 } } });
    expect(itemInfo(ItemId.NAPOLEONS_DIARY)!.description).toEqual({ code: 'itemInfo.speedup.troopBatch', params: { percent: { share: 0.3 } } });
  });

  it('quotes cooldowns from BALANCE and refers to items by id', () => {
    expect(itemInfo(ItemId.CITY_TELEPORTER)!.description.params?.period).toEqual({
      code: 'itemInfo.period.hours',
      params: { count: BALANCE.teleportCooldownMs / HOUR },
    });
    expect(itemInfo(ItemId.MEDIUM_MEDAL_BOX)!.description.params?.medals).toEqual(
      [ItemId.HONOUR_MEDAL, ItemId.COURAGE_MEDAL, ItemId.WISDOM_MEDAL].map((id) => ({ ref: 'item', id })),
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
    expect(medalSources(1).containers.map((c) => c.id)).toContain(ItemId.JUNIOR_MEDAL_BOX);
  });
});
