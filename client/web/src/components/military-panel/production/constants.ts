import { param, type SearchSchema } from '@/lib/search-state';

export const RES_KEYS = ['gold', 'food', 'wood', 'stone', 'iron'] as const;

/** A production card's tabs: what can be ordered, and the queue. */
export const ProductionTab = { TRAIN: 'train', QUEUE: 'queue' } as const;
export type ProductionTab = (typeof ProductionTab)[keyof typeof ProductionTab];

/** The panel's place in the address, under `military.` (lib/search-state.ts): the tab of each production card. */
export const MILITARY_SEARCH = {
  troops: param.oneOf(Object.values(ProductionTab), ProductionTab.TRAIN),
  forts: param.oneOf(Object.values(ProductionTab), ProductionTab.TRAIN),
} satisfies SearchSchema;
