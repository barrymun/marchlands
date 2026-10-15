import { itemEffect, itemGoldPrice, ITEMS } from '@marchlands/core';

import { STORE_KEY } from '@/components/active-effects/constants';
import type { Buff, Extension, Slot } from '@/components/active-effects/types';
import { period } from '@/lib/format';

export function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v != null) return v === '1';
  } catch {
    /* storage unavailable: fall through to the default */
  }
  // phones start collapsed so the item list stays above the fold
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}

/** Items giving a slot's bonus, longest first. */
export function slotItems(slot: Slot): string[] {
  if (slot.items) return slot.items;
  const durationOf = (id: string) => {
    const e = itemEffect(id);
    return e?.kind === 'buff' ? e.durationMs : 0;
  };
  return ITEMS.filter((i) => {
    const e = itemEffect(i.id);
    return e?.kind === 'buff' && e.buff === slot.buff;
  })
    .map((i) => i.id)
    .sort((a, b) => durationOf(b) - durationOf(a));
}

/** How long using an item extends its bonus ("7 days", "6 hours"), or '' for an item that gives no timed bonus. */
export function adds(id: string) {
  const e = itemEffect(id);
  if (e?.kind !== 'buff') return '';
  return period(e.durationMs);
}

export function extensionFor(slot: Slot, active: Buff | undefined, counts: Map<string, number>): Extension {
  if (slot.extend === false) return null;
  const ids = slotItems(slot);
  const order = active?.itemId && ids.includes(active.itemId) ? [active.itemId, ...ids.filter((i) => i !== active.itemId)] : ids;
  const owned = order.find((i) => (counts.get(i) ?? 0) > 0);
  if (owned) return { kind: 'use', itemId: owned, owned: counts.get(owned)! };
  const buy = order.find((i) => itemGoldPrice(i) != null);
  return buy ? { kind: 'buy', itemId: buy, price: itemGoldPrice(buy)! } : null;
}
