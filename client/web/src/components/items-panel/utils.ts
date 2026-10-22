import { itemGoldPrice, TROOP_ID_BY_KEY, type TroopKey } from '@marchlands/core';

import { fmtExact, type Resource, RESOURCES } from '@/lib/format';
import { itemName, troopName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';

/** Gold price of an entry when one of its items is for sale (itemGoldPrice: there are no cents). */
export function goldPriceOf(e: { ids: string[] }): { id: string; price: number } | null {
  for (const id of e.ids) {
    const price = itemGoldPrice(id);
    if (price != null) return { id, price };
  }
  return null;
}

/** What an item gave, in the current locale: "5 × Name, 50,000 food, 1,500 Archer", or "nothing". */
export function describeGrant(g: {
  items?: Record<string, number>;
  resources?: Record<string, number | undefined>;
  troops?: Record<string, number | undefined>;
}) {
  const parts: string[] = [];
  const amount = (n: number, name: string) => i18n.t('items-panel:grant.amount', { amount: fmtExact(n), name });
  const resource = (r: string) => ((RESOURCES as readonly string[]).includes(r) ? i18n.t(`common:resourcesInline.${r as Resource}`) : r);
  for (const [id, n] of Object.entries(g.items ?? {})) parts.push(`${n} × ${itemName(id)}`);
  for (const [r, n] of Object.entries(g.resources ?? {})) if (n) parts.push(amount(n, resource(r)));
  for (const [k, n] of Object.entries(g.troops ?? {}))
    if (n) parts.push(amount(n, Object.hasOwn(TROOP_ID_BY_KEY, k) ? troopName(TROOP_ID_BY_KEY[k as TroopKey]) : k));
  return parts.join(i18n.t('common:list.separator')) || i18n.t('common:nothing');
}

/** Medal level 1 (Cross) … 9 (Nation) of an entry, or null for other items. */
export function medalLevelOf(ids: string[]): number | null {
  for (const id of ids) {
    const m = /^hero\.loyalty\.([1-9])$/.exec(id);
    if (m) return Number(m[1]);
  }
  return null;
}
