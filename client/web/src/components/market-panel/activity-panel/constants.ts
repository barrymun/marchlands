/** What the terminal's bottom strip shows: the player's waiting orders, their latest trades, their goods in transit, or the factions' latest trades. */
export const ActivityView = { ORDERS: 'orders', TRADES: 'trades', SHIPMENTS: 'shipments', FACTIONS: 'factions' } as const;
export type ActivityView = (typeof ActivityView)[keyof typeof ActivityView];
