import type { CandlestickData, HistogramData, UTCTimestamp, WhitespaceData } from 'lightweight-charts';
import type { MarketCandle } from '@marchlands/api-client';

type Slot<T> = T | WhitespaceData<UTCTimestamp>;

/**
 * The chart's prices and volumes from candles (oldest first), timed in seconds as the chart wants. Every `bucketMs`
 * from `from` to `to` without a candle gets an empty slot, so time runs evenly along the chart and a quiet hour shows
 * as a gap; candles before `from` are kept, without slots between them.
 */
export function chartData(candles: MarketCandle[], bucketMs: number, from: number, to: number) {
  const byStart = new Map(candles.map((c) => [c.t, c]));
  const starts = new Set(byStart.keys());
  for (let t = from - (from % bucketMs); t <= to; t += bucketMs) starts.add(t);
  const prices: Slot<CandlestickData<UTCTimestamp>>[] = [];
  const volumes: Slot<HistogramData<UTCTimestamp>>[] = [];
  for (const t of [...starts].sort((a, b) => a - b)) {
    const time = (t / 1000) as UTCTimestamp;
    const c = byStart.get(t);
    prices.push(c ? { time, open: c.open, high: c.high, low: c.low, close: c.close } : { time });
    volumes.push(c ? { time, value: c.volume } : { time });
  }
  return { prices, volumes };
}
