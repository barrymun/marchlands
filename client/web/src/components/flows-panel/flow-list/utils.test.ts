import { describe, expect, it } from 'vitest';
import type { Flow } from '@marchlands/api-client';
import { lastRunSummary } from '@/components/flows-panel/flow-list/utils';

type Run = NonNullable<Flow['lastRun']>;
const city = (ok: boolean): Run['cities'][number] => ({ cityId: 1, cityName: 'Rome', ok, error: null, steps: [] });
const run = (r: Partial<Run>): Run => ({ run: 7, cities: [], skippedCities: [], startedAt: 1_000, finishedAt: 2_000, ...r });

describe(lastRunSummary.name, () => {
  it('is nothing for a flow never run', () => {
    expect(lastRunSummary({ lastRun: null })).toBeNull();
  });

  it('is ok when every city got through, at the time it ended', () => {
    expect(lastRunSummary({ lastRun: run({ cities: [city(true), city(true)] }) })).toEqual({ run: 7, ok: true, at: 2_000 });
  });

  it('is not ok when any city failed', () => {
    expect(lastRunSummary({ lastRun: run({ cities: [city(true), city(false)] }) })?.ok).toBe(false);
  });

  it('is at its start while it is still going', () => {
    expect(lastRunSummary({ lastRun: run({ finishedAt: null }) })).toEqual({ run: 7, ok: true, at: 1_000 });
  });
});
