// Market orders and shipments (see index.ts).
export const MARKET_MESSAGES = {
  invalidResource: [],
  invalidSide: [],
  invalidPrice: [],
  /** the city has no Marketplace */
  needMarketplace: ['building'],
  /** a market order found nothing to trade with */
  nothingToTrade: [],
  /** the city has as many open orders as its Marketplace level allows */
  tooManyOrders: ['building'],
  /** not enough of the resource being sold */
  notEnoughResource: ['resource'],
  /** the player placed or cancelled orders too quickly (BALANCE.marketOrderLimit) */
  slowDown: ['wait'],
  orderNotFound: [],
  shipmentNotFound: [],
} as const;
