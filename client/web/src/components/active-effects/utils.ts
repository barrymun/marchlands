import { type BuffId, itemEffect, ItemEffectKind, itemGoldPrice, ITEMS } from '@marchlands/core';

import { ExtensionKind, GROUPS, STORE_KEY } from '@/components/active-effects/constants';
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

/** The slot of a bonus, or none for a bonus no slot shows. */
export function slotOf(buff: BuffId): Slot | null {
  return GROUPS.flatMap((g) => g.slots).find((s) => s.buff === buff) ?? null;
}

/** Items giving a slot's bonus, longest first. */
export function slotItems(slot: Slot): string[] {
  if (slot.items) return slot.items;
  const durationOf = (id: string) => {
    const e = itemEffect(id);
    return e?.kind === ItemEffectKind.BUFF ? e.durationMs : 0;
  };
  return ITEMS.filter((i) => {
    const e = itemEffect(i.id);
    return e?.kind === ItemEffectKind.BUFF && e.buff === slot.buff;
  })
    .map((i) => i.id)
    .sort((a, b) => durationOf(b) - durationOf(a));
}

/** How long using an item extends its bonus ("7 days", "6 hours"), or '' for an item that gives no timed bonus. */
export function adds(id: string) {
  const e = itemEffect(id);
  if (e?.kind !== ItemEffectKind.BUFF) return '';
  return period(e.durationMs);
}

export function extensionFor(slot: Slot, active: Buff | undefined, counts: Map<string, number>): Extension {
  if (slot.extend === false) return null;
  const ids = slotItems(slot);
  const order = active?.itemId && ids.includes(active.itemId) ? [active.itemId, ...ids.filter((i) => i !== active.itemId)] : ids;
  // the first one held, else the first one for sale
  for (const itemId of order) {
    const owned = counts.get(itemId) ?? 0;
    if (owned > 0) return { kind: ExtensionKind.USE, itemId, owned };
  }
  for (const itemId of order) {
    const price = itemGoldPrice(itemId);
    if (price != null) return { kind: ExtensionKind.BUY, itemId, price };
  }
  return null;
}
