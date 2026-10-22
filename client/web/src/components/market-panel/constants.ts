import type { MarketPriceLevel } from '@marchlands/api-client';
import { resourceLabel } from '@/lib/format';

/** The tradeable resources by market type; `label` is in the current locale. */
export const RESOURCES = [
  {
    type: 0,
    key: 'food',
    get label() {
      return resourceLabel('food');
    },
  },
  {
    type: 1,
    key: 'wood',
    get label() {
      return resourceLabel('wood');
    },
  },
  {
    type: 2,
    key: 'stone',
    get label() {
      return resourceLabel('stone');
    },
  },
  {
    type: 3,
    key: 'iron',
    get label() {
      return resourceLabel('iron');
    },
  },
] as const;

/** The width from which the terminal fills the viewport and its panes scroll by themselves (Tailwind's `xl`). */
export const TERMINAL_QUERY = '(min-width: 80rem)';

/** Narrower than the terminal, how many rows a long list shows before its Show more. */
export const SHORT_LIST = 12;

/** An empty side of the order book, the same array every render, so the charts don't redraw while the book loads. */
export const NO_LEVELS: MarketPriceLevel[] = [];
