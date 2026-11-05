import type { FlowAction } from '@marchlands/api-client';
import type { FlowActionType } from '@marchlands/core';

export type AttackAction = Extract<FlowAction, { type: typeof FlowActionType.ATTACK_TARGETS }>;
