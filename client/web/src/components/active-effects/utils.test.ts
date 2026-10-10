import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuffId, ITEM_INFO, itemConfig, itemEffect, itemGoldPrice } from '@marchlands/core';
import { adds, extensionFor, itemName, readCollapsed, slotItems } from '@/components/active-effects/utils';
import { GROUPS, STORE_KEY } from '@/components/active-effects/constants';
import type { Buff, Slot } from '@/components/active-effects/types';

// real game data, plus two made-up items for branches no real item reaches (a buff shorter than a day, a padded name)
vi.mock('@marchlands/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@marchlands/core')>();
  return {
    ...core,
    itemEffect: (id: string) =>
      id === 'test.hourly' ? { kind: 'buff', buff: core.BuffId.ATTACK, desc: 'test', durationMs: 5.6 * 3_600_000 } : core.itemEffect(id),
    itemConfig: (id: string) => (id === 'test.padded' ? { ...core.itemConfig('player.resinc.1')!, name: '  Padded Name ' } : core.itemConfig(id)),
  };
});

const food: Slot = { buff: BuffId.FOOD_PRODUCTION, label: 'Food', boost: '+25%' };
const truce = GROUPS.flatMap((g) => g.slots).find((s) => s.buff === BuffId.TRUCE)!;
const buff = (itemId?: string): Buff => ({ id: BuffId.FOOD_PRODUCTION, desc: 'Food production +25%', endTime: 0, itemId });

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
    expect(slotItems(food)).toEqual(['player.resinc.1.b', 'player.resinc.1']);
    expect(slotItems({ buff: BuffId.ATTACK, label: 'Attack', boost: '+20%' })).toEqual(['player.attackinc.1.b', 'player.attackinc.1']);
  });

  it('matches what the game data says for every slot', () => {
    for (const slot of GROUPS.flatMap((g) => g.slots).filter((s) => !s.items)) {
      const ids = slotItems(slot);
      expect(ids.length).toBeGreaterThan(0);
      const expected = ITEM_INFO.filter((i) => {
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
    expect(slotItems(truce)).toEqual(['player.peace.1']);
    expect(slotItems({ ...food, items: [] })).toEqual([]);
  });

  it('returns nothing for a buff no item gives', () => {
    expect(slotItems({ buff: BuffId.HOLIDAY, label: 'Holiday', boost: 'On' })).toEqual([]);
  });
});

describe(itemName.name, () => {
  it('returns the item’s name', () => {
    expect(itemName('player.resinc.1')).toBe(itemConfig('player.resinc.1')!.name.trim());
    expect(itemName('player.peace.1')).toBe('Truce Agreement');
  });

  it('trims the name', () => {
    expect(itemName('test.padded')).toBe('Padded Name');
  });

  it('falls back to the id for unknown items', () => {
    expect(itemName('unknown.item')).toBe('unknown.item');
  });
});

describe(adds.name, () => {
  it('says how many days a buff item adds', () => {
    expect(adds('player.resinc.1')).toBe('1 day');
    expect(adds('player.resinc.1.b')).toBe('7 days');
  });

  it('says hours for a buff shorter than a day', () => {
    expect(adds('test.hourly')).toBe('6 hours');
  });

  it('is empty for items that give no buff', () => {
    expect(adds('player.peace.1')).toBe('');
    expect(adds('unknown.item')).toBe('');
  });
});

describe(extensionFor.name, () => {
  it('cannot extend a slot marked not extendable', () => {
    expect(extensionFor(truce, undefined, new Map([['player.peace.1', 3]]))).toBeNull();
  });

  it('uses an owned item, the longest first', () => {
    const counts = new Map([
      ['player.resinc.1', 2],
      ['player.resinc.1.b', 1],
    ]);
    expect(extensionFor(food, undefined, counts)).toEqual({ kind: 'use', itemId: 'player.resinc.1.b', owned: 1 });
  });

  it('prefers the item that set the running bonus', () => {
    const counts = new Map([
      ['player.resinc.1', 2],
      ['player.resinc.1.b', 1],
    ]);
    expect(extensionFor(food, buff('player.resinc.1'), counts)).toEqual({ kind: 'use', itemId: 'player.resinc.1', owned: 2 });
  });

  it('ignores a running item that does not belong to the slot, and items owned zero times', () => {
    const counts = new Map([
      ['player.resinc.1', 4],
      ['player.resinc.1.b', 0],
      ['player.resinc.2', 9],
    ]);
    expect(extensionFor(food, buff('player.resinc.2'), counts)).toEqual({ kind: 'use', itemId: 'player.resinc.1', owned: 4 });
  });

  it('buys one with gold when none is owned, in the same order', () => {
    expect(extensionFor(food, undefined, new Map())).toEqual({ kind: 'buy', itemId: 'player.resinc.1.b', price: itemGoldPrice('player.resinc.1.b') });
    expect(extensionFor(food, buff('player.resinc.1'), new Map())).toEqual({ kind: 'buy', itemId: 'player.resinc.1', price: itemGoldPrice('player.resinc.1') });
  });

  it('skips items that are not for sale', () => {
    const slot: Slot = { ...food, items: ['unknown.item', 'player.resinc.1'] };
    expect(extensionFor(slot, undefined, new Map())).toEqual({ kind: 'buy', itemId: 'player.resinc.1', price: itemGoldPrice('player.resinc.1') });
  });

  it('cannot extend when nothing is owned or for sale', () => {
    expect(extensionFor({ ...food, items: ['unknown.item'] }, undefined, new Map())).toBeNull();
    expect(extensionFor({ buff: BuffId.HOLIDAY, label: 'Holiday', boost: 'On' }, undefined, new Map())).toBeNull();
  });
});
