import { useQuery } from '@tanstack/react-query';
import { getMarketSummaryOptions } from '@marchlands/api-client';
import { RESOURCES } from '@/components/market-panel/constants';

/**
 * Every resource's market at a glance, in one request: its price now (the factions' world price, or the merchant's
 * before they trade), the merchant's prices, and its last 24 hours.
 */
export function useMarkets() {
  const summary = useQuery(getMarketSummaryOptions()).data;
  return RESOURCES.map((r) => {
    const s = summary?.find((x) => x.resType === r.type);
    return { type: r.type, key: r.key, price: s?.price ?? null, merchant: s?.merchant ?? null, day: s?.day ?? null };
  });
}
