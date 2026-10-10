import { itemConfig, itemGoldPrice, TROOP_ID_BY_KEY, TROOP_NAMES, type TroopKey } from '@marchlands/core';
import { fmtExact } from '@/lib/format';

/** Gold price of an entry when one of its items is for sale (itemGoldPrice: there are no cents). */
export function goldPriceOf(e: { ids: string[] }): { id: string; price: number } | null {
  const id = e.ids.find((x) => itemGoldPrice(x) != null);
  return id ? { id, price: itemGoldPrice(id)! } : null;
}

export function describeGrant(g: {
  items?: Record<string, number>;
  resources?: Record<string, number | undefined>;
  troops?: Record<string, number | undefined>;
}) {
  const parts: string[] = [];
  for (const [id, n] of Object.entries(g.items ?? {})) parts.push(`${n} × ${itemConfig(id)?.name.trim() ?? id}`);
  for (const [r, n] of Object.entries(g.resources ?? {})) if (n) parts.push(`${fmtExact(n)} ${r === 'wood' ? 'lumber' : r}`);
  for (const [k, n] of Object.entries(g.troops ?? {})) if (n) parts.push(`${fmtExact(n)} ${TROOP_NAMES[TROOP_ID_BY_KEY[k as TroopKey]] ?? k}`);
  return parts.join(', ') || 'nothing';
}

/** Medal level 1 (Cross) … 9 (Nation) of an entry, or null for other items. */
export function medalLevelOf(ids: string[]): number | null {
  for (const id of ids) {
    const m = /^hero\.loyalty\.([1-9])$/.exec(id);
    if (m) return Number(m[1]);
  }
  return null;
}
