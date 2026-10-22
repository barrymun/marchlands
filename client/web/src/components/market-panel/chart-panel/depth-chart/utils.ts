import type { AreaData, WhitespaceData } from 'lightweight-charts';
import type { MarketPriceLevel } from '@marchlands/api-client';
import { DEPTH_MAX_STEPS, PRICE_TICKS } from '@/components/market-panel/chart-panel/depth-chart/constants';

/** A point of the depth chart: a price on the horizontal axis and the amount on offer up to it, or an empty slot. */
type DepthPoint = AreaData<number> | WhitespaceData<number>;

/** The step between the chart's prices, in ticks: 1, 2, 5, 10, 20 … whichever first keeps `span` within DEPTH_MAX_STEPS. */
function stepFor(span: number) {
  const least = Math.max(1, Math.ceil(span / DEPTH_MAX_STEPS));
  for (let scale = 1; ; scale *= 10) {
    const step = [1, 2, 5].map((m) => m * scale).find((s) => s >= least);
    if (step !== undefined) return step;
  }
}

/**
 * The order book added up from the best price outwards: at each buying price, how much players will buy at it or
 * more; at each selling price, how much they will sell at it or less. Lightweight Charts spaces points evenly, so
 * both series get a point at every step from the lowest price to the highest (and at every price on the book), with
 * empty slots where a side has nothing: the distance between two prices on the chart is then true to their difference.
 */
export function depthPoints(buyers: MarketPriceLevel[], sellers: MarketPriceLevel[]) {
  const ticks = (levels: MarketPriceLevel[]) => levels.map((l) => ({ at: Math.round(l.price * PRICE_TICKS), amount: l.amount }));
  const bids = ticks(buyers);
  const asks = ticks(sellers);
  const prices = [...bids, ...asks].map((l) => l.at);
  if (prices.length === 0) return { bids: [], asks: [] };
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const step = stepFor(hi - lo);
  const slots = new Set(prices);
  for (let at = lo; at <= hi; at += step) slots.add(at);
  const bestBid = Math.max(...bids.map((l) => l.at));
  const bestAsk = Math.min(...asks.map((l) => l.at));
  const sum = (levels: typeof bids) => levels.reduce((total, l) => total + l.amount, 0);
  const points = (has: (at: number) => boolean, depth: (at: number) => number): DepthPoint[] =>
    [...slots].sort((a, b) => a - b).map((at) => (has(at) ? { time: at / PRICE_TICKS, value: depth(at) } : { time: at / PRICE_TICKS }));
  return {
    bids: points(
      (at) => at <= bestBid,
      (at) => sum(bids.filter((l) => l.at >= at)),
    ),
    asks: points(
      (at) => at >= bestAsk,
      (at) => sum(asks.filter((l) => l.at <= at)),
    ),
  };
}
