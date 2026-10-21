import type { CityBean, Flow, FlowAction } from '@marchlands/api-client';
import type { Draft } from '@/components/flows-panel/types';

let nextKey = 0;

export const keyed = (a: FlowAction): Draft => ({ ...a, key: `a${nextKey++}` });

export const strip = ({ key: _k, ...a }: Draft): FlowAction => a;

/** A city with a hero of its own (not held captive): "all cities" runs only on these, like the server. */
export const hasHero = (c: Pick<CityBean, 'heros'>) => c.heros.some((h) => !h.seized);

export const currentAction = (f: Flow) => (f.status === 'waiting' ? f.nextAction - 1 : f.status === 'running' ? f.nextAction : -1);
