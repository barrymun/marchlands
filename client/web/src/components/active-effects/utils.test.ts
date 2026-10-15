import { afterEach, describe, expect, it, vi } from 'vitest';

import { BuffId, itemEffect, itemGoldPrice, ItemId, ITEMS, msg, ref } from '@marchlands/core';

import { GROUPS, STORE_KEY } from '@/components/active-effects/constants';
import type { Buff, Slot } from '@/components/active-effects/types';
import { adds, extensionFor, readCollapsed, slotItems } from '@/components/active-effects/utils';

// real game data, plus made-up items for branches no real item reaches (buffs shorter than a day)
vi.mock('@marchlands/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@marchlands/core')>();
  return {
    ...core,
    itemEffect: (id: string) =>
      id === 'test.hourly'
        ? { kind: 'buff', buff: core.BuffId.ATTACK, desc: core.msg('buff.troopAttack', { percent: 20 }), durationMs: 5.6 * 3_600_000 }
        : id === 'test.hour'
          ? { kind: 'buff', buff: core.BuffId.ATTACK, desc: core.msg('buff.troopAttack', { percent: 20 }), durationMs: 3_600_000 }
          : core.itemEffect(id),
  };
});

const food: Slot = { buff: BuffId.FOOD_PRODUCTION, label: 'Food', boost: '+25%' };
const truce = GROUPS.flatMap((g) => g.slots).find((s) => s.buff === BuffId.TRUCE)!;
const buff = (itemId?: string): Buff => ({
  id: BuffId.FOOD_PRODUCTION,
  desc: msg('buff.production', { resource: ref.resource('food'), percent: 25 }),
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

describe(slotItems.name, () => {
  it('returns every item giving the buff, longest first', () => {
    expect(slotItems(food)).toEqual([ItemId.IRON_RAKE, ItemId.PLOWSHARES]);
    expect(slotItems({ buff: BuffId.ATTACK, label: 'Attack', boost: '+20%' })).toEqual([ItemId.IVORY_HORN, ItemId.WAR_HORN]);
  });

  it('matches what the game data says for every slot', () => {
    for (const slot of GROUPS.flatMap((g) => g.slots).filter((s) => !s.items)) {
      const ids = slotItems(slot);
      expect(ids.length).toBeGreaterThan(0);
      const expected = ITEMS.filter((i) => {
        const e = itemEffect(i.id);
        return e?.kind === 'buff' && e.buff === slot.buff;
      }).map((i) => i.id);
      expect([...ids].sort()).toEqual([...expected].sort());
      const durations = ids.map((id) => {
        const e = itemEffect(id);
        return e?.kind === 'buff' ? e.durationMs : 0;
      });
      expect(durations).toEqual([...durations].sort((a, b) => b - a));
    }
  });

  it('uses the slot’s own item list when it has one', () => {
    expect(slotItems(truce)).toEqual([ItemId.TRUCE_AGREEMENT]);
    expect(slotItems({ ...food, items: [] })).toEqual([]);
  });

  it('returns nothing for a buff no item gives', () => {
    expect(slotItems({ buff: BuffId.HOLIDAY, label: 'Holiday', boost: 'On' })).toEqual([]);
  });
});

describe(adds.name, () => {
  it('says how many days a buff item adds', () => {
    expect(adds(ItemId.PLOWSHARES)).toBe('1 day');
    expect(adds(ItemId.IRON_RAKE)).toBe('7 days');
  });

  it('says hours for a buff shorter than a day', () => {
    expect(adds('test.hourly')).toBe('6 hours');
    expect(adds('test.hour')).toBe('1 hour');
  });

  it('is empty for items that give no buff', () => {
    expect(adds(ItemId.TRUCE_AGREEMENT)).toBe('');
    expect(adds('unknown.item')).toBe('');
  });
});

describe(extensionFor.name, () => {
  it('cannot extend a slot marked not extendable', () => {
    expect(extensionFor(truce, undefined, new Map([[ItemId.TRUCE_AGREEMENT, 3]]))).toBeNull();
  });

  it('uses an owned item, the longest first', () => {
    const counts = new Map([
      [ItemId.PLOWSHARES, 2],
      [ItemId.IRON_RAKE, 1],
    ]);
    expect(extensionFor(food, undefined, counts)).toEqual({ kind: 'use', itemId: ItemId.IRON_RAKE, owned: 1 });
  });

  it('prefers the item that set the running bonus', () => {
    const counts = new Map([
      [ItemId.PLOWSHARES, 2],
      [ItemId.IRON_RAKE, 1],
    ]);
    expect(extensionFor(food, buff(ItemId.PLOWSHARES), counts)).toEqual({ kind: 'use', itemId: ItemId.PLOWSHARES, owned: 2 });
  });

  it('ignores a running item that does not belong to the slot, and items owned zero times', () => {
    const counts = new Map([
      [ItemId.PLOWSHARES, 4],
      [ItemId.IRON_RAKE, 0],
      [ItemId.ARCH_SAW, 9],
    ]);
    expect(extensionFor(food, buff(ItemId.ARCH_SAW), counts)).toEqual({ kind: 'use', itemId: ItemId.PLOWSHARES, owned: 4 });
  });

  it('buys one with gold when none is owned, in the same order', () => {
    expect(extensionFor(food, undefined, new Map())).toEqual({ kind: 'buy', itemId: ItemId.IRON_RAKE, price: itemGoldPrice(ItemId.IRON_RAKE) });
    expect(extensionFor(food, buff(ItemId.PLOWSHARES), new Map())).toEqual({ kind: 'buy', itemId: ItemId.PLOWSHARES, price: itemGoldPrice(ItemId.PLOWSHARES) });
  });

  it('skips items that are not for sale', () => {
    const slot: Slot = { ...food, items: ['unknown.item', ItemId.PLOWSHARES] };
    expect(extensionFor(slot, undefined, new Map())).toEqual({ kind: 'buy', itemId: ItemId.PLOWSHARES, price: itemGoldPrice(ItemId.PLOWSHARES) });
  });

  it('cannot extend when nothing is owned or for sale', () => {
    expect(extensionFor({ ...food, items: ['unknown.item'] }, undefined, new Map())).toBeNull();
    expect(extensionFor({ buff: BuffId.HOLIDAY, label: 'Holiday', boost: 'On' }, undefined, new Map())).toBeNull();
  });
});
