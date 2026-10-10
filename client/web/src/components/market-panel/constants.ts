export const RESOURCES = [
  { type: 0, key: 'food', label: 'Food' },
  { type: 1, key: 'wood', label: 'Lumber' },
  { type: 2, key: 'stone', label: 'Stone' },
  { type: 3, key: 'iron', label: 'Iron' },
] as const;

export const mk = {
  book: (t: number) => ['market', 'book', t] as const,
  history: (t: number) => ['market', 'history', t] as const,
  orders: ['market', 'orders'] as const,
  shipments: ['market', 'shipments'] as const,
};
