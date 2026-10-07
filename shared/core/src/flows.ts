// (evony-re) Flows: a lord's saved series of actions, run on any of their cities (backend services/flows.ts).

import { TROOP_NAMES } from './constants.ts';
import { TROOPS } from './data/index.ts';
import type { FlowAction } from './types.ts';

export const FLOW_STAT_LABEL = { power: 'Attack', management: 'Politics', stratagem: 'Intelligence' } as const;

/** Troops a flow can train (everything trained in barracks; fortifications are not troops). */
export const FLOW_TROOP_IDS: readonly number[] = TROOPS.filter((t) => t.inside === 1).map((t) => t.troopId);

/** One line for an action, e.g. "Set mayor: highest Attack" or "Train max Archer". */
export function describeFlowAction(a: FlowAction): string {
  if (a.type === 'setMayor') return `Set mayor: highest ${FLOW_STAT_LABEL[a.stat]}`;
  if (a.type === 'healTroops') return `Heal all troops (${a.payWith}${a.when === 'armiesHome' ? ', when armies are home' : ''})`;
  if (a.type === 'attackTargets') {
    const lists = Object.values(a.targets).filter((t) => t.length);
    const n = lists.reduce((s, t) => s + t.length, 0);
    return `Attack ${n} target${n === 1 ? '' : 's'}${lists.length > 1 ? ` from ${lists.length} cities` : ''}`;
  }
  const name = TROOP_NAMES[a.troopId] ?? `Unit ${a.troopId}`;
  return `Train ${a.amount === 'max' ? 'max' : a.amount.toLocaleString('en')} ${name}`;
}
