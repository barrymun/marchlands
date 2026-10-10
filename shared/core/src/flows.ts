// (marchlands) Flows: a lord's saved series of actions, run on any of their cities (backend services/flows.ts).

import { TROOP_NAMES } from './constants.ts';
import { TROOPS } from './data/index.ts';
import type { FlowAction } from './types.ts';

export const FLOW_STAT_LABEL = { power: 'Attack', management: 'Politics', stratagem: 'Intelligence' } as const;

/** Troops a flow can train (everything trained in barracks; fortifications are not troops). */
export const FLOW_TROOP_IDS: readonly number[] = TROOPS.filter((t) => t.inside === 1).map((t) => t.troopId);

/** A flow between runs ('idle'), waiting its turn ('queued'), running its actions, or paused on a wait action. */
export type FlowStatus = 'idle' | 'queued' | 'running' | 'waiting';

export interface FlowStepResult {
  action: string;
  ok: boolean;
  /** what happened, or why it failed */
  detail: string;
  /** the city could not do it right now (e.g. train with nothing affordable): the run carried on */
  skipped?: boolean;
  /** per-target outcomes of an attack action, e.g. "(204,406)" sent with a hero or skipped and why */
  items?: { label: string; ok: boolean; detail: string }[];
}
export interface FlowCityResult {
  cityId: number;
  cityName: string;
  ok: boolean;
  /** the failure that rolled back this city's part of the run since the last wait */
  error: string | null;
  steps: FlowStepResult[];
}
/** A city a run left out, and why (e.g. "all cities" skips a city with no hero). */
export interface FlowSkippedCity {
  cityId: number;
  cityName: string;
  reason: string;
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

/** One line for an action, e.g. "Set mayor: highest Attack" or "Train max Archer". */
export function describeFlowAction(a: FlowAction): string {
  if (a.type === 'setMayor') return `Set mayor: highest ${FLOW_STAT_LABEL[a.stat]}`;
  if (a.type === 'healTroops') return `Heal all troops (${a.payWith}${a.when === 'armiesHome' ? ', when armies are home' : ''})`;
  if (a.type === 'wait') return a.until === 'armiesHome' ? 'Wait until the armies sent are home' : `Wait ${formatFlowMinutes(a.minutes)}`;
  if (a.type === 'attackTargets') {
    const lists = Object.values(a.targets).filter((t) => t.length);
    const n = lists.reduce((s, t) => s + t.length, 0);
    return `Attack ${n} target${n === 1 ? '' : 's'}${lists.length > 1 ? ` from ${lists.length} cities` : ''}`;
  }
  const name = TROOP_NAMES[a.troopId] ?? `Unit ${a.troopId}`;
  return `Train ${a.amount === 'max' ? 'max' : a.amount.toLocaleString('en')} ${name}`;
}

/** "45m", "2h", "1h 30m", "1d 2h". */
export function formatFlowMinutes(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m';
}
