import type { Flow, FlowAction } from '@marchlands/api-client';
import type { Draft } from '@/components/flows-panel/types';

let nextKey = 0;

export const keyed = (a: FlowAction): Draft => ({ ...a, key: `a${nextKey++}` });

export const strip = ({ key: _k, ...a }: Draft): FlowAction => a as FlowAction;

export const currentAction = (f: Flow) => (f.status === 'waiting' ? f.nextAction - 1 : f.status === 'running' ? f.nextAction : -1);
