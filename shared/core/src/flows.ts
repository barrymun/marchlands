// (marchlands) Flows: a lord's saved series of actions, run on any of their cities (backend services/flows.ts).

import { TROOPS } from '#/data/index.ts';
import { dur, type Message, msg, ref } from '#/messages/index.ts';
import type { FlowAction } from '#/types.ts';

/** Troops a flow can train (everything trained in barracks; fortifications are not troops). */
export const FLOW_TROOP_IDS: readonly number[] = TROOPS.filter((t) => t.inside === 1).map((t) => t.troopId);

/** A flow between runs ('idle'), waiting its turn ('queued'), running its actions, or paused on a wait action. */
export type FlowStatus = 'idle' | 'queued' | 'running' | 'waiting';

export interface FlowStepResult {
  action: Message;
  ok: boolean;
  /** what happened, or why it failed */
  detail: Message;
  /** the city could not do it right now (e.g. train with nothing affordable): the run carried on */
  skipped?: boolean;
  /** per-target outcomes of an attack action, e.g. "(204,406)" sent with a hero or skipped and why */
  items?: { label: string; ok: boolean; detail: Message }[];
}
export interface FlowCityResult {
  cityId: number;
  cityName: string;
  ok: boolean;
  /** the failure that rolled back this city's part of the run since the last wait */
  error: Message | null;
  steps: FlowStepResult[];
}
/** A city a run left out, and why (e.g. "all cities" skips a city with no hero). */
export interface FlowSkippedCity {
  cityId: number;
  cityName: string;
  reason: Message;
}
/** What a flow's latest run did, city by city (kept on the flow). */
export interface FlowRunLog {
  /** 1 for the first run of the flow, counting up with every run */
  run: number;
  startedAt: number;
  finishedAt: number | null;
  cities: FlowCityResult[];
  /** cities the run left out (absent in logs from before it was recorded) */
  skippedCities?: FlowSkippedCity[];
}
/** The flow's latest preview (kept on the flow until it runs, is edited or repeat is switched). */
export interface FlowPreviewLog {
  at: number;
  cities: FlowCityResult[];
  skippedCities: FlowSkippedCity[];
}

/** One line for an action, e.g. "Set mayor: highest Attack" or "Train max Archer". */
export function flowActionMessage(a: FlowAction): Message {
  if (a.type === 'setMayor') return msg('flow.action.setMayor', { stat: ref.stat(a.stat) });
  if (a.type === 'healTroops') {
    const home = a.when === 'armiesHome';
    if (a.payWith === 'honor') return msg(home ? 'flow.action.healHonourHome' : 'flow.action.healHonour');
    return msg(home ? 'flow.action.healResourcesHome' : 'flow.action.healResources');
  }
  if (a.type === 'wait') return a.until === 'armiesHome' ? msg('flow.action.waitArmiesHome') : msg('flow.action.wait', { time: dur(a.minutes * 60_000) });
  if (a.type === 'attackTargets') {
    const lists = Object.values(a.targets).filter((t) => t.length);
    const count = lists.reduce((s, t) => s + t.length, 0);
    return lists.length > 1
      ? msg('flow.action.attackFrom', { count, cities: msg('flow.cityCount', { count: lists.length }) })
      : msg('flow.action.attack', { count });
  }
  return a.amount === 'max'
    ? msg('flow.action.trainMax', { troop: ref.troop(a.troopId) })
    : msg('flow.action.train', { amount: a.amount, troop: ref.troop(a.troopId) });
}
