/** How far a price has moved since `open`, as a share (0.02 for 2% up); 0 without an opening price. */
export const priceChange = (open: number, price: number) => (open > 0 ? price / open - 1 : 0);
