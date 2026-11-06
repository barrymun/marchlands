import { describe, expect, it } from 'vitest';
import { countOf, keepsRegularCity, ofCity, queuedCount } from '@/components/city-dialog/city-form/abandon-city/utils';

const city = (id: number, over: { historicLevel?: number | null; abandonAt?: number } = {}) => ({ id, historicLevel: null, abandonAt: 0, ...over });

describe(queuedCount.name, () => {
  it('adds up every batch of every queue, those waiting too', () => {
    expect(queuedCount([{ allProduceQueue: [{ num: 500 }, { num: 20 }] }, { allProduceQueue: [{ num: 3 }] }])).toBe(523);
  });

  it('is 0 with nothing queued, or before the queues have loaded', () => {
    expect(queuedCount([{ allProduceQueue: [] }])).toBe(0);
    expect(queuedCount([])).toBe(0);
    expect(queuedCount(undefined)).toBe(0);
  });
});

describe(keepsRegularCity.name, () => {
  it('is false for a last city', () => {
    expect(keepsRegularCity([city(1)], 1)).toBe(false);
  });

  it('is true with another regular city', () => {
    expect(keepsRegularCity([city(1), city(2)], 1)).toBe(true);
  });

  it('is false for the last regular city, whatever historic cities remain', () => {
    expect(keepsRegularCity([city(1), city(2, { historicLevel: 12 }), city(3, { historicLevel: 18 })], 1)).toBe(false);
  });

  it('is true for a historic city while a regular city remains', () => {
    expect(keepsRegularCity([city(1), city(2, { historicLevel: 12 })], 2)).toBe(true);
  });

  it('does not count a regular city itself being abandoned', () => {
    expect(keepsRegularCity([city(1), city(2, { abandonAt: 5 })], 1)).toBe(false);
    expect(keepsRegularCity([city(1), city(2, { abandonAt: 5 }), city(3)], 1)).toBe(true);
  });

  it('is false with no cities known', () => {
    expect(keepsRegularCity([], 1)).toBe(false);
  });
});

describe(countOf.name, () => {
  it('adds the counts up', () => {
    expect(countOf({ archer: 3, militia: 4 })).toBe(7);
  });

  it('is 0 for nothing, for hidden troops and when nothing is there', () => {
    expect(countOf({})).toBe(0);
    expect(countOf(null)).toBe(0);
    expect(countOf(undefined)).toBe(0);
  });
});

describe(ofCity.name, () => {
  it('keeps only the things of that city', () => {
    expect(
      ofCity(
        [
          { cityId: 1, n: 'a' },
          { cityId: 2, n: 'b' },
        ],
        2,
      ),
    ).toEqual([{ cityId: 2, n: 'b' }]);
  });

  it('is empty before the list has loaded', () => {
    expect(ofCity(undefined, 1)).toEqual([]);
  });
});
