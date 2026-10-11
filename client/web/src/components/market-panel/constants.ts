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
