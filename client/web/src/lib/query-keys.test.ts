import { describe, expect, it } from 'vitest';
import { getCitiesByCityIdQueryKey, getPlayerQueryKey } from '@marchlands/api-client';
import { allMarketQueries, allOf } from '@/lib/query-keys';

describe(allOf.name, () => {
  it('builds the key of an operation without its parameters', () => {
    const [key] = allOf(getCitiesByCityIdQueryKey);
    expect(key._id).toBe('getCitiesByCityId');
    expect(key).not.toHaveProperty('path');
  });
  it('is a prefix of every key of that operation (TanStack partial matching)', () => {
    const [all] = allOf(getCitiesByCityIdQueryKey);
    const [one] = getCitiesByCityIdQueryKey({ path: { cityId: 7 } });
    expect(one).toMatchObject(all);
  });
  it('keeps the parameters it is given', () => {
    const [some] = allOf(getCitiesByCityIdQueryKey, { path: { cityId: 7 } });
    expect(some).toMatchObject({ _id: 'getCitiesByCityId', path: { cityId: 7 } });
  });
  it('does not match another operation', () => {
    expect(allOf(getPlayerQueryKey)[0]._id).not.toBe(allOf(getCitiesByCityIdQueryKey)[0]._id);
  });
});

describe(allMarketQueries.name, () => {
  it('covers every market operation', () => {
    expect(allMarketQueries().map(([k]) => k._id)).toEqual([
      'getMarketByResType',
      'getMarketHistory',
      'getMarketQuote',
      'getMarketOrdersMine',
      'getMarketShipments',
    ]);
  });
  it('matches the books of every resource (no parameters on the per-resource keys)', () => {
    const [book] = allMarketQueries()[0]!;
    expect(book).not.toHaveProperty('path');
  });
});
