import { describe, expect, it } from 'vitest';

import type { CityBean, Flow, FlowAction } from '@marchlands/api-client';
import { FLOW_TROOP_IDS } from '@marchlands/core';

import { currentAction, hasHero, hiresHeroes, keyed, strip } from '@/components/flows-panel/utils';

const ACTIONS: FlowAction[] = [
  { type: 'setMayor', stat: 'management' },
  { type: 'trainTroops', troopId: FLOW_TROOP_IDS[0]!, amount: 'max' },
  { type: 'attackTargets', presetId: 'p1', targets: { '1': [5, 9] } },
  { type: 'healTroops', payWith: 'resources', when: 'armiesHome' },
  { type: 'wait', until: 'time', minutes: 10 },
];

const flow = (status: Flow['status'], nextAction: number): Flow => ({
  id: 'f1',
  name: 'Farming',
  actions: ACTIONS,
  cities: 'all',
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
    const a: FlowAction = { type: 'wait', until: 'armiesHome', minutes: 10 };
    keyed(a);
    expect(a).toEqual({ type: 'wait', until: 'armiesHome', minutes: 10 });
  });

  it('works as a map callback (the index is ignored)', () => {
    const drafts = ACTIONS.map(keyed);
    expect(drafts.map(({ key: _k, ...a }) => a)).toEqual(ACTIONS);
    expect(new Set(drafts.map((d) => d.key)).size).toBe(ACTIONS.length);
  });
});

describe(strip.name, () => {
  it('removes the editor key, leaving the action', () => {
    expect(strip({ type: 'setMayor', stat: 'power', key: 'a7' })).toEqual({ type: 'setMayor', stat: 'power' });
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
    expect(currentAction(flow('running', 0))).toBe(0);
    expect(currentAction(flow('running', 3))).toBe(3);
  });

  it('is the wait action (the one before the next) while waiting', () => {
    expect(currentAction(flow('waiting', 5))).toBe(4);
    expect(currentAction(flow('waiting', 1))).toBe(0);
  });

  it('is -1 when the flow is idle or queued', () => {
    expect(currentAction(flow('idle', 2))).toBe(-1);
    expect(currentAction(flow('queued', 0))).toBe(-1);
  });
});

describe(hasHero.name, () => {
  const city = (...seized: boolean[]) => ({ heros: seized.map((s) => ({ seized: s })) }) as Pick<CityBean, 'heros'>;

  it('is false for a city without heroes (e.g. one just captured)', () => {
    expect(hasHero(city())).toBe(false);
  });

  it('is true with at least one hero not held captive', () => {
    expect(hasHero(city(false))).toBe(true);
    expect(hasHero(city(true, false))).toBe(true);
  });

  it('is false when every hero there is held captive', () => {
    expect(hasHero(city(true, true))).toBe(false);
  });
});

describe(hiresHeroes.name, () => {
  it('is true when any action hires heroes', () => {
    expect(hiresHeroes([{ type: 'setMayor' }, { type: 'hireHeroes' }])).toBe(true);
  });

  it('is false for a flow without a hire action, or none at all', () => {
    expect(hiresHeroes([{ type: 'setMayor' }, { type: 'wait' }])).toBe(false);
    expect(hiresHeroes([])).toBe(false);
  });
});
