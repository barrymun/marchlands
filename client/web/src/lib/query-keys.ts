import {
  getMarketByResTypeQueryKey,
  getMarketHistoryQueryKey,
  getMarketOrdersMineQueryKey,
  getMarketQuoteQueryKey,
  getMarketShipmentsQueryKey,
} from '@marchlands/api-client';

// Query keys come from the generated client (`get<Operation>QueryKey`, @marchlands/api-client). A key
// holds the operation's id and its parameters, and TanStack matches keys partially, so a key built
// with fewer parameters matches every cached query of that operation that agrees on the ones given.

/**
 * Every cached query of one operation, e.g. `allOf(getCitiesTroopsQueuesQueryKey)`, or only those
 * matching some parameters: `allOf(getCitiesBuildingsByPositionIdQueryKey, { path: { cityId } })`.
 */
export const allOf = <K extends readonly unknown[]>(keyFn: (options: never) => K, partial: object = {}): K => keyFn(partial as never);

/** Every market query: the order books, price histories, quotes, my orders and shipments. */
export const allMarketQueries = () => [
  allOf(getMarketByResTypeQueryKey),
  allOf(getMarketHistoryQueryKey),
  allOf(getMarketQuoteQueryKey),
  getMarketOrdersMineQueryKey(),
  getMarketShipmentsQueryKey(),
];
