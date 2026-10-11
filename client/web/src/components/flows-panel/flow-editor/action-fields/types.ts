import type { FlowAction } from '@marchlands/core';

export type Stat = Extract<FlowAction, { type: 'setMayor' }>['stat'];
