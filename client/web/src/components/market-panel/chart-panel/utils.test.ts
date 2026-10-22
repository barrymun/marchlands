import { describe, expect, it } from 'vitest';
import { chartData } from '@/components/market-panel/chart-panel/utils';

const MIN = 60_000;
const T = 1_767_225_600_000; // a whole day, so a whole minute too
const candle = (t: number, close: number, volume = 10) => ({ t, open: 1, high: Math.max(1, close), low: Math.min(1, close), close, volume });

describe(chartData.name, () => {
  it('times candles in seconds, with their volumes', () => {
    const { prices, volumes } = chartData([candle(T, 1.25, 7)], MIN, T, T);
    expect(prices).toEqual([{ time: T / 1000, open: 1, high: 1.25, low: 1, close: 1.25 }]);
    expect(volumes).toEqual([{ time: T / 1000, value: 7 }]);
  });

  it('leaves an empty slot for every bucket without trades from `from` to `to`', () => {
    const { prices, volumes } = chartData([candle(T + MIN, 0.75)], MIN, T, T + 3 * MIN);
    expect(prices.map((p) => ('close' in p ? p.close : null))).toEqual([null, 0.75, null, null]);
    expect(prices.map((p) => p.time)).toEqual([0, 1, 2, 3].map((i) => (T + i * MIN) / 1000));
    expect(volumes).toEqual([{ time: T / 1000 }, { time: (T + MIN) / 1000, value: 10 }, { time: (T + 2 * MIN) / 1000 }, { time: (T + 3 * MIN) / 1000 }]);
  });

  it('starts the slots at the bucket `from` falls in', () => {
    const { prices } = chartData([], MIN, T + 30_000, T + MIN);
    expect(prices).toEqual([{ time: T / 1000 }, { time: (T + MIN) / 1000 }]);
  });

  it('keeps older candles in order, without slots between them', () => {
    const { prices } = chartData([candle(T - 10 * MIN, 1.1), candle(T - 5 * MIN, 0.9), candle(T, 1)], MIN, T, T);
    expect(prices.map((p) => p.time)).toEqual([(T - 10 * MIN) / 1000, (T - 5 * MIN) / 1000, T / 1000]);
  });

  it('gives nothing for no candles and an empty range', () => {
    expect(chartData([], MIN, T + MIN, T)).toEqual({ prices: [], volumes: [] });
  });
});
