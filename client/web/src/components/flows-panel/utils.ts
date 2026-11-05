import type { CityBean, Flow, FlowAction } from '@marchlands/api-client';
import { FLOW_TRAIN_MAX, FlowActionType, FlowStatus, FlowWaitUntil } from '@marchlands/core';

import { ACTION_RANGES } from '@/components/flows-panel/constants';
import type { Draft } from '@/components/flows-panel/types';
import { duration } from '@/lib/format';
import { i18n } from '@/lib/i18n';
import { inRange } from '@/lib/ranges';

let nextKey = 0;

export const keyed = (a: FlowAction): Draft => ({ ...a, key: `a${nextKey++}` });

export const strip = ({ key: _k, ...a }: Draft): FlowAction => a;

/** A city with a hero: "all cities" runs only on these, like the server. */
export const hasHero = (c: Pick<CityBean, 'heros'>) => c.heros.length > 0;

/** Whether a flow hires heroes: then "all cities" runs on every city, those without a hero too, like the server. */
export const hiresHeroes = (actions: readonly Pick<FlowAction, 'type'>[]) => actions.some((a) => a.type === FlowActionType.HIRE_HEROES);

/** Whether a flow is active: running, waiting between steps, or queued to go (again); anything but idle. */
export const isActive = (f: Pick<Flow, 'status'>) => f.status !== FlowStatus.IDLE;

export const currentAction = (f: Flow) => (f.status === FlowStatus.WAITING ? f.nextAction - 1 : f.status === FlowStatus.RUNNING ? f.nextAction : -1);

/** Whether an action is ready to save: its numbers in range (ACTION_RANGES), an attack's army chosen. */
export function actionValid(a: FlowAction): boolean {
  switch (a.type) {
    case FlowActionType.WAIT:
      return a.until !== FlowWaitUntil.TIME || inRange(a.minutes, ACTION_RANGES.waitMinutes);
    case FlowActionType.HIRE_HEROES:
      return inRange(a.count, ACTION_RANGES.hireCount) && inRange(a.min, ACTION_RANGES.hireMin) && inRange(a.maxGold, ACTION_RANGES.hireGold);
    case FlowActionType.TRAIN_TROOPS:
      return a.amount === FLOW_TRAIN_MAX || inRange(a.amount, ACTION_RANGES.trainAmount);
    case FlowActionType.ATTACK_TARGETS:
      return !!a.presetId;
    default:
      return true;
  }
}

/** How long ago `t` was, for a report title: "just now" under a minute, else the largest unit ("5m ago", "2h ago"). */
export const ago = (now: number, t: number) =>
  now - t < 60_000 ? i18n.t('common:time.justNow') : i18n.t('common:time.ago', { time: duration(now - t).split(' ')[0] });

/** How many flows are not idle, and the soonest moment one carries on (a wait ending, a repeat starting), if any is ahead. */
export function nextDue(flows: readonly Pick<Flow, 'status' | 'waitUntil' | 'notBefore'>[], now: number) {
  const ahead = flows.map((f) => (f.status === FlowStatus.WAITING ? f.waitUntil : f.status === FlowStatus.QUEUED ? f.notBefore : 0)).filter((at) => at > now);
  return { active: flows.filter(isActive).length, next: ahead.length ? Math.min(...ahead) : null };
}
