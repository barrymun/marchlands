import { describe, expect, it } from 'vitest';
import { BALANCE, HOUR, ITEM_CATEGORY_IDS, ITEM_INFO, ITEMS, itemInfo, medalSources } from '../src/index.ts';

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
    expect(itemInfo('player.resinc.1.b')!.description).toEqual({
      code: 'itemInfo.buff',
      params: {
        effect: { code: 'buff.production', params: { resource: { ref: 'resource', id: 'food' }, percent: Math.round(BALANCE.resourceBuffBonus * 100) } },
        period: { code: 'itemInfo.period.days', params: { count: 7 } },
      },
    });
  });

  it('derives speed-ups from what they cut', () => {
    expect(itemInfo('consume.2.a')!.description).toEqual({
      code: 'itemInfo.speedup.time',
      params: { time: { code: 'itemInfo.period.minutes', params: { count: 15 } } },
    });
    expect(itemInfo('consume.2.c.1')!.description).toEqual({ code: 'itemInfo.speedup.hours', params: { min: 10, count: 30 } });
    expect(itemInfo('consume.2.d')!.description).toEqual({ code: 'itemInfo.speedup.percent', params: { percent: 30 } });
    expect(itemInfo('player.troop.1.b')!.description).toEqual({ code: 'itemInfo.speedup.troopBatch', params: { percent: 30 } });
  });

  it('quotes cooldowns from BALANCE and refers to items by id', () => {
    expect(itemInfo('consume.move.1')!.description.params?.period).toEqual({
      code: 'itemInfo.period.hours',
      params: { count: BALANCE.teleportCooldownMs / HOUR },
    });
    expect(itemInfo('player.box.special.2')!.description.params?.medals).toEqual([4, 5, 6].map((l) => ({ ref: 'item', id: `hero.loyalty.${l}` })));
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
    expect(medalSources(1).containers.map((c) => c.id)).toContain('player.box.special.1');
  });
});
