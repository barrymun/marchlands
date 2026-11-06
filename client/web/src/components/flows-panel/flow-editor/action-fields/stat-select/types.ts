import type { FlowAction, FlowActionType } from '@marchlands/core';

export type Stat = Extract<FlowAction, { type: typeof FlowActionType.SET_MAYOR }>['stat'];
