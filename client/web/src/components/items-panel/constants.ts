import { ITEM_CATEGORY_IDS } from '@marchlands/core';
import { SLOT_BUFFS } from '@/components/active-effects/constants';
import { param, type SearchSchema } from '@/lib/search-state';

/** The category filter's value for every category (shown as common:actions.all). */
export const ALL = 'All';

/** The longest search the box takes. */
export const ITEM_SEARCH_MAX = 60;

/**
 * The panel's place in the address, under `items.` (lib/search-state.ts): the category (none for all), the search,
 * owned only, and the bonus an Active effects slot asked for (only the items giving it).
 */
export const ITEMS_SEARCH = {
  category: param.int((n) => (ITEM_CATEGORY_IDS as readonly number[]).includes(n)),
  q: param.text(ITEM_SEARCH_MAX),
  owned: param.flag(),
  effect: param.maybe([...SLOT_BUFFS]),
} satisfies SearchSchema;
