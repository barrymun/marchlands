import type { FlowRunReport } from '@marchlands/api-client';

type Step = FlowRunReport['cities'][number]['steps'][number];

/** A city's run in one line: the step that failed, if one did, else what each step did, in order. */
export function citySummary(steps: readonly Step[]): { failed: Step | null; details: Step['detail'][] } {
  return { failed: steps.find((s) => !s.ok) ?? null, details: steps.map((s) => s.detail) };
}
