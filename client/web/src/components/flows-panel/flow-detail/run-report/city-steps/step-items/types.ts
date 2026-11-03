import type { FlowRunReport } from '@marchlands/api-client';

export type StepItem = NonNullable<FlowRunReport['cities'][number]['steps'][number]['items']>[number];
