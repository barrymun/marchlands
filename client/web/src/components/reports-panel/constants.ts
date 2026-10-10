export const TABS = [
  { id: 'all', label: 'All', type: null, count: 'count' },
  { id: 'army', label: 'Military', type: 1, count: 'army_count' },
  { id: 'trade', label: 'Trade', type: 0, count: 'trade_count' },
  { id: 'other', label: 'Other', type: 2, count: 'other_count' },
] as const;
export const PAGE_SIZE = 20;
