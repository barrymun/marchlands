// Administration tools (see index.ts).
export const ADMIN_MESSAGES = {
  /** a broadcast an administrator wrote */
  broadcast: ['text'],
  /** an item id the administrator typed */
  unknownItem: ['id'],
  /** a building or research level outside 0..max */
  invalidLevel: ['max'],
} as const;
