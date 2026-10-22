import { describe, expect, it } from 'vitest';
import type { Flow } from '@marchlands/api-client';
import { ago, withPreview } from '@/components/flows-panel/run-flow/utils';

const NOW = 1_800_000_000_000;

describe(ago.name, () => {
  it('is just now under a minute', () => {
    expect(ago(NOW, NOW)).toBe('just now');
    expect(ago(NOW, NOW - 59_999)).toBe('just now');
  });

  it('is the largest unit from a minute on', () => {
    expect(ago(NOW, NOW - 60_000)).toBe('1m ago');
    expect(ago(NOW, NOW - 5 * 60_000 - 9_000)).toBe('5m ago');
    expect(ago(NOW, NOW - 2 * 3_600_000 - 60_000)).toBe('2h ago');
    expect(ago(NOW, NOW - 3 * 86_400_000)).toBe('3d ago');
  });

  it('is just now for a time in the future (clock skew)', () => {
    expect(ago(NOW, NOW + 5_000)).toBe('just now');
  });
});

describe(withPreview.name, () => {
  const flow = (id: string) => ({ id, lastPreview: null }) as unknown as Flow;
  const report = { cities: [], skippedCities: [{ cityId: 2, cityName: 'Keep', reason: { code: 'flow.skipNoHero' as const } }] };

  it('puts the report on that flow only, with the time it ran', () => {
    const [a, b] = withPreview([flow('a'), flow('b')], 'b', report, NOW)!;
    expect(a!.lastPreview).toBeNull();
    expect(b!.lastPreview).toEqual({ at: NOW, cities: [], skippedCities: report.skippedCities });
  });

  it('leaves an empty cache empty', () => {
    expect(withPreview(undefined, 'a', report, NOW)).toBeUndefined();
  });
});
