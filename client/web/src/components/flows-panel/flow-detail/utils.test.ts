import { describe, expect, it } from 'vitest';
import type { Flow } from '@marchlands/api-client';
import { withPreview } from '@/components/flows-panel/flow-detail/utils';

const NOW = 1_800_000_000_000;

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
