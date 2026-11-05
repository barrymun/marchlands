import { describe, expect, it } from 'vitest';

import type { CityBean, Flow, FlowAction } from '@marchlands/api-client';
import {
  FLOW_MAX_HIRES,
  FLOW_MAX_WAIT_MINUTES,
  FLOW_TRAIN_MAX,
  FLOW_TROOP_IDS,
  FlowActionType,
  FlowCities,
  FlowHealWhen,
  FlowStatus,
  FlowWaitUntil,
  HealPayment,
  HERO_BASE_STAT_MAX,
} from '@marchlands/core';

import { actionValid, ago, currentAction, hasHero, hiresHeroes, isActive, keyed, nextDue, strip } from '@/components/flows-panel/utils';

const ACTIONS: FlowAction[] = [
  { type: FlowActionType.SET_MAYOR, stat: 'management' },
  { type: FlowActionType.TRAIN_TROOPS, troopId: FLOW_TROOP_IDS[0]!, amount: FLOW_TRAIN_MAX },
  { type: FlowActionType.ATTACK_TARGETS, presetId: 'p1', targets: { '1': [5, 9] } },
  { type: FlowActionType.HEAL_TROOPS, payWith: HealPayment.RESOURCES, when: FlowHealWhen.ARMIES_HOME },
  { type: FlowActionType.WAIT, until: FlowWaitUntil.TIME, minutes: 10 },
];

const flow = (status: Flow['status'], nextAction: number): Flow => ({
  id: 'f1',
  name: 'Farming',
  actions: ACTIONS,
  cities: FlowCities.ALL,
  repeat: false,
  status,
  nextAction,
  runs: 0,
  queuedAt: 0,
  notBefore: 0,
  waitUntil: 0,
  heldSince: 0,
  stopReason: null,
  lastRun: null,
  lastPreview: null,
});

describe(keyed.name, () => {
  it('keeps every field of the action and adds a key', () => {
    for (const a of ACTIONS) {
      const d = keyed(a);
      expect(d).toMatchObject(a);
      expect(d.key).toMatch(/^a\d+$/);
    }
  });

  it('gives every call a new, increasing key, even for the same action', () => {
    const a = ACTIONS[0]!;
    const keys = [keyed(a), keyed(a), keyed(a)].map((d) => Number(d.key.slice(1)));
    expect(new Set(keys).size).toBe(3);
    expect(keys[1]).toBe(keys[0]! + 1);
    expect(keys[2]).toBe(keys[1]! + 1);
  });

  it('does not change the action it is given', () => {
    const a: FlowAction = { type: FlowActionType.WAIT, until: FlowWaitUntil.ARMIES_HOME, minutes: 10 };
    keyed(a);
    expect(a).toEqual({ type: FlowActionType.WAIT, until: FlowWaitUntil.ARMIES_HOME, minutes: 10 });
  });

  it('works as a map callback (the index is ignored)', () => {
    const drafts = ACTIONS.map(keyed);
    expect(drafts.map(({ key: _k, ...a }) => a)).toEqual(ACTIONS);
    expect(new Set(drafts.map((d) => d.key)).size).toBe(ACTIONS.length);
  });
});

describe(strip.name, () => {
  it('removes the editor key, leaving the action', () => {
    expect(strip({ type: FlowActionType.SET_MAYOR, stat: 'power', key: 'a7' })).toEqual({ type: FlowActionType.SET_MAYOR, stat: 'power' });
  });

  it('undoes keyed for every action type', () => {
    for (const a of ACTIONS) expect(strip(keyed(a))).toEqual(a);
  });

  it('returns a new object without touching the draft', () => {
    const d = keyed(ACTIONS[2]!);
    const a = strip(d);
    expect(a).not.toBe(d);
    expect(d.key).toBeDefined();
    expect('key' in a).toBe(false);
  });
});

describe(currentAction.name, () => {
  it('is the next action while running', () => {
    expect(currentAction(flow(FlowStatus.RUNNING, 0))).toBe(0);
    expect(currentAction(flow(FlowStatus.RUNNING, 3))).toBe(3);
  });

  it('is the wait action (the one before the next) while waiting', () => {
    expect(currentAction(flow(FlowStatus.WAITING, 5))).toBe(4);
    expect(currentAction(flow(FlowStatus.WAITING, 1))).toBe(0);
  });

  it('is -1 when the flow is idle or queued', () => {
    expect(currentAction(flow(FlowStatus.IDLE, 2))).toBe(-1);
    expect(currentAction(flow(FlowStatus.QUEUED, 0))).toBe(-1);
  });
});

describe(hasHero.name, () => {
  const city = (heroes: number) => ({ heros: Array.from({ length: heroes }, () => ({})) }) as Pick<CityBean, 'heros'>;

  it('is false for a city without heroes (e.g. one just captured)', () => {
    expect(hasHero(city(0))).toBe(false);
  });

  it('is true with at least one hero', () => {
    expect(hasHero(city(1))).toBe(true);
  });
});

describe(hiresHeroes.name, () => {
  it('is true when any action hires heroes', () => {
    expect(hiresHeroes([{ type: FlowActionType.SET_MAYOR }, { type: FlowActionType.HIRE_HEROES }])).toBe(true);
  });

  it('is false for a flow without a hire action, or none at all', () => {
    expect(hiresHeroes([{ type: FlowActionType.SET_MAYOR }, { type: FlowActionType.WAIT }])).toBe(false);
    expect(hiresHeroes([])).toBe(false);
  });
});

describe(actionValid.name, () => {
  const hire = { type: FlowActionType.HIRE_HEROES, count: 3, stat: 'power', min: 50, maxGold: 100_000 } as const satisfies FlowAction;

  it('takes every action with its numbers in range', () => {
    for (const a of [...ACTIONS, hire]) expect(actionValid(a), a.type).toBe(true);
  });

  it('refuses a hire with a count, minimum or gold cleared or out of range', () => {
    expect(actionValid({ ...hire, count: Number.NaN })).toBe(false);
    expect(actionValid({ ...hire, count: FLOW_MAX_HIRES + 1 })).toBe(false);
    expect(actionValid({ ...hire, count: FLOW_MAX_HIRES })).toBe(true);
    expect(actionValid({ ...hire, min: HERO_BASE_STAT_MAX + 1 })).toBe(false);
    expect(actionValid({ ...hire, min: 0 })).toBe(false);
    expect(actionValid({ ...hire, maxGold: Number.NaN })).toBe(false);
  });

  it('checks a wait’s minutes only when it waits for a time', () => {
    expect(actionValid({ type: FlowActionType.WAIT, until: FlowWaitUntil.TIME, minutes: FLOW_MAX_WAIT_MINUTES + 1 })).toBe(false);
    expect(actionValid({ type: FlowActionType.WAIT, until: FlowWaitUntil.TIME, minutes: Number.NaN })).toBe(false);
    expect(actionValid({ type: FlowActionType.WAIT, until: FlowWaitUntil.ARMIES_HOME, minutes: Number.NaN })).toBe(true);
  });

  it('takes a train amount or max, and wants an attack’s army', () => {
    expect(actionValid({ type: FlowActionType.TRAIN_TROOPS, troopId: FLOW_TROOP_IDS[0]!, amount: Number.NaN })).toBe(false);
    expect(actionValid({ type: FlowActionType.TRAIN_TROOPS, troopId: FLOW_TROOP_IDS[0]!, amount: FLOW_TRAIN_MAX })).toBe(true);
    expect(actionValid({ type: FlowActionType.ATTACK_TARGETS, presetId: '', targets: {} })).toBe(false);
  });
});

const NOW = 1_800_000_000_000;

describe(ago.name, () => {
  it('is just now under a minute', () => {
    expect(ago(NOW, NOW)).toBe('just now');
    expect(ago(NOW, NOW - 59_999)).toBe('just now');
  });

  it('is the largest unit from a minute on', () => {
    expect(ago(NOW, NOW - 60_000)).toBe('1m ago');
    expect(ago(NOW, NOW - 5 * 60_000 - 9_000)).toBe('5m ago');
    expect(ago(NOW, NOW - 2 * 3_600_000 - 60_000)).toBe('2h ago');
    expect(ago(NOW, NOW - 3 * 86_400_000)).toBe('3d ago');
  });

  it('is just now for a time in the future (clock skew)', () => {
    expect(ago(NOW, NOW + 5_000)).toBe('just now');
  });
});

describe(nextDue.name, () => {
  const flow = (status: Flow['status'], times: Partial<Pick<Flow, 'waitUntil' | 'notBefore'>> = {}) =>
    ({ status, waitUntil: 0, notBefore: 0, ...times }) as Flow;

  it('counts the flows not idle and finds the soonest wait or repeat ahead', () => {
    expect(
      nextDue(
        [
          flow(FlowStatus.WAITING, { waitUntil: NOW + 600_000 }),
          flow(FlowStatus.QUEUED, { notBefore: NOW + 60_000 }),
          flow(FlowStatus.IDLE),
          flow(FlowStatus.RUNNING),
        ],
        NOW,
      ),
    ).toEqual({
      active: 3,
      next: NOW + 60_000,
    });
  });

  it('has nothing ahead when none waits or repeats later', () => {
    expect(nextDue([flow(FlowStatus.RUNNING), flow(FlowStatus.QUEUED)], NOW)).toEqual({ active: 2, next: null });
    expect(nextDue([flow(FlowStatus.IDLE)], NOW)).toEqual({ active: 0, next: null });
    expect(nextDue([], NOW)).toEqual({ active: 0, next: null });
  });

  it('leaves out times already past', () => {
    expect(nextDue([flow(FlowStatus.WAITING, { waitUntil: NOW - 1 })], NOW)).toEqual({ active: 1, next: null });
  });
});

describe(isActive.name, () => {
  it('is true for a flow running, waiting or queued', () => {
    expect(isActive({ status: FlowStatus.RUNNING })).toBe(true);
    expect(isActive({ status: FlowStatus.WAITING })).toBe(true);
    expect(isActive({ status: FlowStatus.QUEUED })).toBe(true);
  });

  it('is false for an idle flow', () => {
    expect(isActive({ status: FlowStatus.IDLE })).toBe(false);
  });
});
