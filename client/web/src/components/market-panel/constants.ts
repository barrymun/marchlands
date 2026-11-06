import type { MarketPriceLevel } from '@marchlands/api-client';
import { ResourceKey } from '@marchlands/core';
import { resourceLabel } from '@/lib/format';

/** The tradeable resources by market type; `label` is in the current locale. */
export const RESOURCES = [
  {
    type: 0,
    key: ResourceKey.FOOD,
    get label() {
      return resourceLabel(ResourceKey.FOOD);
    },
  },
  {
    type: 1,
    key: ResourceKey.WOOD,
    get label() {
      return resourceLabel(ResourceKey.WOOD);
    },
  },
  {
    type: 2,
    key: ResourceKey.STONE,
    get label() {
      return resourceLabel(ResourceKey.STONE);
    },
  },
  {
    type: 3,
    key: ResourceKey.IRON,
    get label() {
      return resourceLabel(ResourceKey.IRON);
    },
  },
] as const;

/** The width from which the terminal fills the viewport and its panes scroll by themselves (Tailwind's `xl`). */
export const TERMINAL_QUERY = '(min-width: 80rem)';

/** Narrower than the terminal, how many rows a long list shows before its Show more. */
export const SHORT_LIST = 12;

/** An empty side of the order book, the same array every render, so the charts don't redraw while the book loads. */
export const NO_LEVELS: MarketPriceLevel[] = [];
