import type { FlowAction } from '@marchlands/api-client';

export type AttackAction = Extract<FlowAction, { type: 'attackTargets' }>;
