import { describe, expect, it } from 'vitest';
import type { FlowRunReport } from '@marchlands/api-client';
import { citySummary } from '@/components/flows-panel/flow-detail/run-report/utils';

type Step = FlowRunReport['cities'][number]['steps'][number];
const step = (ok: boolean, code: string): Step => ({ ok, action: { code: 'flow.action.healHonour' }, detail: { code } }) as Step;

describe(citySummary.name, () => {
  it('lists what each step did, in order, when none failed', () => {
    const steps = [step(true, 'flow.step.noInjured'), step(true, 'flow.step.waiting')];
    expect(citySummary(steps)).toEqual({ failed: null, details: [steps[0]!.detail, steps[1]!.detail] });
  });

  it('picks out the step that failed', () => {
    const steps = [step(true, 'flow.step.noInjured'), step(false, 'flow.step.failed'), step(true, 'flow.step.waiting')];
    expect(citySummary(steps).failed).toBe(steps[1]);
  });

  it('is empty with no steps', () => {
    expect(citySummary([])).toEqual({ failed: null, details: [] });
  });
});
