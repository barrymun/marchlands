import { afterEach, describe, expect, it, vi } from 'vitest';

import { BUFF_IDS, BuffId, itemEffect, ItemEffectKind, itemGoldPrice, ItemId, ITEMS, msg, ref, ResourceKey } from '@marchlands/core';

import { ExtensionKind, GROUPS, STORE_KEY } from '@/components/active-effects/constants';
import type { Buff, Slot } from '@/components/active-effects/types';
import { adds, extensionFor, readCollapsed, slotItems, slotOf } from '@/components/active-effects/utils';

// real game data, plus made-up items for branches no real item reaches (buffs shorter than a day)
vi.mock('@marchlands/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@marchlands/core')>();
  return {
    ...core,
    itemEffect: (id: string) =>
      id === 'test.hourly'
        ? { kind: core.ItemEffectKind.BUFF, buff: core.BuffId.ATTACK, desc: core.msg('buff.troopAttack', { percent: 20 }), durationMs: 5.6 * 3_600_000 }
        : id === 'test.hour'
          ? { kind: core.ItemEffectKind.BUFF, buff: core.BuffId.ATTACK, desc: core.msg('buff.troopAttack', { percent: 20 }), durationMs: 3_600_000 }
          : core.itemEffect(id),
  };
});

const food: Slot = { buff: BuffId.FOOD_PRODUCTION, label: 'Food', boost: '+25%' };
const truce = GROUPS.flatMap((g) => g.slots).find((s) => s.buff === BuffId.TRUCE)!;
const buff = (itemId?: string): Buff => ({
  id: BuffId.FOOD_PRODUCTION,
  desc: msg('buff.production', { resource: ref.resource(ResourceKey.FOOD), percent: 25 }),
  endTime: 0,
  itemId,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(readCollapsed.name, () => {
  const stub = (stored: string | null, phone: boolean) => {
    const getItem = vi.fn(() => stored);
    const matchMedia = vi.fn(() => ({ matches: phone }));
    vi.stubGlobal('localStorage', { getItem });
    vi.stubGlobal('window', { matchMedia });
    return { getItem, matchMedia };
  };

  it('uses the stored choice', () => {
    const { getItem, matchMedia } = stub('1', false);
    expect(readCollapsed()).toBe(true);
    expect(getItem).toHaveBeenCalledWith(STORE_KEY);
    expect(matchMedia).not.toHaveBeenCalled();
    stub('0', true);
    expect(readCollapsed()).toBe(false);
  });

  it('treats any stored value other than 1 as expanded', () => {
    stub('yes', true);
    expect(readCollapsed()).toBe(false);
  });

  it('defaults to collapsed on phones only when nothing is stored', () => {
    const { matchMedia } = stub(null, true);
    expect(readCollapsed()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 639px)');
    stub(null, false);
    expect(readCollapsed()).toBe(false);
  });

  it('falls back to the screen width when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(readCollapsed()).toBe(true);
  });

  it('is expanded without a window (server or test environment)', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('window', undefined);
    expect(readCollapsed()).toBe(false);
  });
});

describe(slotOf.name, () => {
  it('finds the slot showing a bonus', () => {
    for (const slot of GROUPS.flatMap((g) => g.slots)) expect(slotOf(slot.buff)).toBe(slot);
  });

  it('finds none for a bonus no slot shows', () => {
    const shown = new Set(GROUPS.flatMap((g) => g.slots.map((s) => s.buff)));
    const unshown = BUFF_IDS.find((b) => !shown.has(b));
    expect(unshown).toBeDefined();
    expect(slotOf(unshown!)).toBeNull();
  });
});

describe(slotItems.name, () => {
  it('returns every item giving the buff, longest first', () => {
    expect(slotItems(food)).toEqual([ItemId.HEAVY_PLOUGH, ItemId.PLOUGHSHARE]);
    expect(slotItems({ buff: BuffId.ATTACK, label: 'Attack', boost: '+20%' })).toEqual([ItemId.OLIFANT, ItemId.WAR_HORN]);
  });

  it('matches what the game data says for every slot', () => {
    for (const slot of GROUPS.flatMap((g) => g.slots).filter((s) => !s.items)) {
      const ids = slotItems(slot);
      expect(ids.length).toBeGreaterThan(0);
      const expected = ITEMS.filter((i) => {
        const e = itemEffect(i.id);
        return e?.kind === ItemEffectKind.BUFF && e.buff === slot.buff;
      }).map((i) => i.id);
      expect([...ids].sort()).toEqual([...expected].sort());
      const durations = ids.map((id) => {
        const e = itemEffect(id);
        return e?.kind === ItemEffectKind.BUFF ? e.durationMs : 0;
      });
      expect(durations).toEqual([...durations].sort((a, b) => b - a));
    }
  });

  it('uses the slot’s own item list when it has one', () => {
    expect(slotItems(truce)).toEqual([ItemId.KINGS_PEACE]);
    expect(slotItems({ ...food, items: [] })).toEqual([]);
  });

  it('returns nothing for a buff no item gives', () => {
    expect(slotItems({ buff: BuffId.HOLIDAY, label: 'Holiday', boost: 'On' })).toEqual([]);
  });
});

describe(adds.name, () => {
  it('says how many days a buff item adds', () => {
    expect(adds(ItemId.PLOUGHSHARE)).toBe('1 day');
    expect(adds(ItemId.HEAVY_PLOUGH)).toBe('7 days');
  });

  it('says hours for a buff shorter than a day', () => {
    expect(adds('test.hourly')).toBe('6 hours');
    expect(adds('test.hour')).toBe('1 hour');
  });

  it('is empty for items that give no buff', () => {
    expect(adds(ItemId.KINGS_PEACE)).toBe('');
    expect(adds('unknown.item')).toBe('');
  });
});

describe(extensionFor.name, () => {
  it('cannot extend a slot marked not extendable', () => {
    expect(extensionFor(truce, undefined, new Map([[ItemId.KINGS_PEACE, 3]]))).toBeNull();
  });

  it('uses an owned item, the longest first', () => {
    const counts = new Map([
      [ItemId.PLOUGHSHARE, 2],
      [ItemId.HEAVY_PLOUGH, 1],
    ]);
    expect(extensionFor(food, undefined, counts)).toEqual({ kind: ExtensionKind.USE, itemId: ItemId.HEAVY_PLOUGH, owned: 1 });
  });

  it('prefers the item that set the running bonus', () => {
    const counts = new Map([
      [ItemId.PLOUGHSHARE, 2],
      [ItemId.HEAVY_PLOUGH, 1],
    ]);
    expect(extensionFor(food, buff(ItemId.PLOUGHSHARE), counts)).toEqual({ kind: ExtensionKind.USE, itemId: ItemId.PLOUGHSHARE, owned: 2 });
  });

  it('ignores a running item that does not belong to the slot, and items owned zero times', () => {
    const counts = new Map([
      [ItemId.PLOUGHSHARE, 4],
      [ItemId.HEAVY_PLOUGH, 0],
      [ItemId.BOW_SAW, 9],
    ]);
    expect(extensionFor(food, buff(ItemId.BOW_SAW), counts)).toEqual({ kind: ExtensionKind.USE, itemId: ItemId.PLOUGHSHARE, owned: 4 });
  });

  it('buys one with gold when none is owned, in the same order', () => {
    expect(extensionFor(food, undefined, new Map())).toEqual({
      kind: ExtensionKind.BUY,
      itemId: ItemId.HEAVY_PLOUGH,
      price: itemGoldPrice(ItemId.HEAVY_PLOUGH),
    });
    expect(extensionFor(food, buff(ItemId.PLOUGHSHARE), new Map())).toEqual({
      kind: ExtensionKind.BUY,
      itemId: ItemId.PLOUGHSHARE,
      price: itemGoldPrice(ItemId.PLOUGHSHARE),
    });
  });

  it('skips items that are not for sale', () => {
    const slot: Slot = { ...food, items: ['unknown.item', ItemId.PLOUGHSHARE] };
    expect(extensionFor(slot, undefined, new Map())).toEqual({ kind: ExtensionKind.BUY, itemId: ItemId.PLOUGHSHARE, price: itemGoldPrice(ItemId.PLOUGHSHARE) });
  });

  it('cannot extend when nothing is owned or for sale', () => {
    expect(extensionFor({ ...food, items: ['unknown.item'] }, undefined, new Map())).toBeNull();
    expect(extensionFor({ buff: BuffId.HOLIDAY, label: 'Holiday', boost: 'On' }, undefined, new Map())).toBeNull();
  });
});
