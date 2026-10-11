// Using, buying and opening items (see index.ts).
export const ITEM_MESSAGES = {
  notForSale: [],
  dailyLimit: [],
  cannotUse: [],
  /** items used through another action, by what that action is */
  'useFrom.speedup': [],
  'useFrom.hero': [],
  'useFrom.elsewhere': [],
  chooseCity: [],
  /** a chest needs its key item */
  needKey: ['key'],
} as const;
