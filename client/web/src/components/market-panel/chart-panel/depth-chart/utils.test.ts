import { describe, expect, it } from 'vitest';
import { DEPTH_MAX_STEPS } from '@/components/market-panel/chart-panel/depth-chart/constants';
import { depthPoints } from '@/components/market-panel/chart-panel/depth-chart/utils';

const at = (points: { time: number }[], time: number) => points.find((p) => p.time === time);

describe(depthPoints.name, () => {
  it('adds up buyers from the highest price down, at every thousandth between their prices', () => {
    const { bids } = depthPoints(
      [
        { price: 0.9, amount: 100 },
        { price: 1.1, amount: 50 },
        { price: 0.8, amount: 10 },
      ],
      [],
    );
    expect(bids).toHaveLength(301);
    expect(bids[0]).toEqual({ time: 0.8, value: 160 });
    expect(at(bids, 0.85)).toEqual({ time: 0.85, value: 150 });
    expect(at(bids, 0.9)).toEqual({ time: 0.9, value: 150 });
    expect(at(bids, 0.901)).toEqual({ time: 0.901, value: 50 });
    expect(bids.at(-1)).toEqual({ time: 1.1, value: 50 });
  });

  it('adds up sellers from the lowest price up', () => {
    const { asks } = depthPoints(
      [],
      [
        { price: 1.2, amount: 30 },
        { price: 1.15, amount: 20 },
      ],
    );
    expect(asks).toHaveLength(51);
    expect(asks[0]).toEqual({ time: 1.15, value: 20 });
    expect(at(asks, 1.199)).toEqual({ time: 1.199, value: 20 });
    expect(asks.at(-1)).toEqual({ time: 1.2, value: 50 });
  });

  it('spaces prices evenly, with empty slots between the best bid and the best offer', () => {
    const { bids, asks } = depthPoints([{ price: 0.9, amount: 10 }], [{ price: 1.1, amount: 20 }]);
    expect(bids.map((p) => p.time)).toEqual(asks.map((p) => p.time));
    const times = bids.map((p) => Math.round(p.time * 1000));
    expect(times.every((t, i) => i === 0 || t - (times[i - 1] ?? 0) === 1)).toBe(true);
    expect(at(bids, 1)).toEqual({ time: 1 });
    expect(at(asks, 1)).toEqual({ time: 1 });
    expect(at(bids, 0.9)).toEqual({ time: 0.9, value: 10 });
    expect(at(asks, 0.9)).toEqual({ time: 0.9 });
    expect(at(asks, 1.1)).toEqual({ time: 1.1, value: 20 });
  });

  it('takes coarser steps on a wide book, keeping every price on it', () => {
    const { bids, asks } = depthPoints([{ price: 0.001, amount: 5 }], [{ price: 1000, amount: 7 }]);
    expect(bids.length).toBeLessThanOrEqual(DEPTH_MAX_STEPS + 2);
    expect(at(bids, 0.001)).toEqual({ time: 0.001, value: 5 });
    expect(at(asks, 1000)).toEqual({ time: 1000, value: 7 });
    expect(at(asks, 500.001)).toEqual({ time: 500.001 });
  });

  it('gives nothing for an empty book', () => {
    expect(depthPoints([], [])).toEqual({ bids: [], asks: [] });
  });
});
