/** What the terminal's narrow column shows: the order book, or the latest trades. */
export const BookView = { BOOK: 'book', TRADES: 'trades' } as const;
export type BookView = (typeof BookView)[keyof typeof BookView];
