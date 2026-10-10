import { ITEM_INFO, itemConfig, itemEffect, itemGoldPrice } from '@marchlands/core';
import { STORE_KEY } from '@/components/active-effects/constants';
import type { Buff, Extension, Slot } from '@/components/active-effects/types';

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
  return ITEM_INFO.filter((i) => {
    const e = itemEffect(i.id);
    return e?.kind === 'buff' && e.buff === slot.buff;
  })
    .map((i) => i.id)
    .sort((a, b) => durationOf(b) - durationOf(a));
}

export const itemName = (id: string) => itemConfig(id)?.name.trim() ?? id;

export function adds(id: string) {
  const e = itemEffect(id);
  if (e?.kind !== 'buff') return '';
  const days = e.durationMs / 86_400_000;
  return days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.round(e.durationMs / 3_600_000)} hours`;
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
