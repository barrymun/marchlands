import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  FLOW_TRAIN_MAX,
  FlowActionType,
  FlowCities,
  FlowHealWhen,
  FlowStatus,
  FlowWaitUntil,
  FortType,
  HealPayment,
  HeroBuffId,
  msg,
  TimedEventType,
  TroopType,
} from '@marchlands/core';

import { flows } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addCity, createTestPlayer } from '#test/support/factories.ts';
import { armyPreset, flowOf, newFlow, runFlowIn, withHero } from '#test/support/flows.ts';
import { game } from '#test/support/game.ts';

const mayor = { type: FlowActionType.SET_MAYOR, stat: HeroBuffId.POWER };
const waitTime = { type: FlowActionType.WAIT, until: FlowWaitUntil.TIME, minutes: 5 };

describe(flows.listFlows.name, () => {
  it('is empty for a new player', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await flows.listFlows(g, p.id)).toEqual([]);
    }));

  it("lists only the player's own flows, oldest first, every default filled in", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      await newFlow(g, other, { name: 'Theirs', actions: [mayor] });
      await newFlow(g, p, {
        name: 'First',
        actions: [
          { type: FlowActionType.HEAL_TROOPS, payWith: HealPayment.HONOR },
          { type: FlowActionType.WAIT, until: FlowWaitUntil.ARMIES_HOME },
        ],
      });
      g.advance(1000);
      await newFlow(g, p, { name: 'Second', actions: [mayor] });

      const list = await flows.listFlows(g, p.id);
      expect(list.map((f) => f.name)).toEqual(['First', 'Second']);
      expect(list[0]).toMatchObject({
        actions: [
          { type: FlowActionType.HEAL_TROOPS, payWith: HealPayment.HONOR, when: FlowHealWhen.NOW },
          { type: FlowActionType.WAIT, until: FlowWaitUntil.ARMIES_HOME, minutes: 10 },
        ],
        cities: FlowCities.ALL,
        repeat: false,
        status: FlowStatus.IDLE,
        nextAction: 0,
        runs: 0,
        queuedAt: 0,
        notBefore: 0,
        waitUntil: 0,
        heldSince: 0,
        stopReason: null,
        lastRun: null,
        lastPreview: null,
      });
    }));
});

describe(flows.saveFlow.name, () => {
  it('creates a flow on all cities, the name trimmed, and returns the list', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const list = await flows.saveFlow(g, p.id, {
        name: '  Morning  ',
        actions: [mayor, { type: FlowActionType.TRAIN_TROOPS, troopId: TroopType.WARRIOR, amount: FLOW_TRAIN_MAX }],
      });
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ name: 'Morning', cities: FlowCities.ALL, repeat: false, status: FlowStatus.IDLE });
      expect(list[0]!.id).toMatch(/^[0-9a-z]+$/);
      expect(list[0]!.actions).toEqual([mayor, { type: FlowActionType.TRAIN_TROOPS, troopId: TroopType.WARRIOR, amount: FLOW_TRAIN_MAX }]);
    }));

  it('keeps only chosen cities that are the player’s own, once each', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const second = await addCity(g, p);
      const f = await newFlow(g, p, { name: 'Two', actions: [mayor], cities: [second, p.cityId, second, other.cityId] });
      expect(f.cities).toEqual([second, p.cityId]);
    }));

  it('refuses chosen cities none of which are the player’s', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      await expectRefused(flows.saveFlow(g, p.id, { name: 'X', actions: [mayor], cities: [other.cityId] }), msg('flow.chooseCities'));
      await expectRefused(flows.saveFlow(g, p.id, { name: 'X', actions: [mayor], cities: [] }), msg('flow.chooseCities'));
      expect(await flows.listFlows(g, p.id)).toEqual([]);
    }));

  it('replaces the flow with that id and tells the player', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const f = await newFlow(g, p, { name: 'Old', actions: [mayor] });
      const list = await flows.saveFlow(g, p.id, { id: f.id, name: 'New', actions: [waitTime, mayor], cities: [p.cityId] });
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: f.id, name: 'New', actions: [waitTime, mayor], cities: [p.cityId] });
      expect(g.pushes(PushCmd.FLOW_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { flowId: f.id, status: FlowStatus.IDLE } });
    }));

  it('keeps the last preview when only the name changes, and drops it when the actions or cities change', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Preview', actions: [mayor] });
      await runFlowIn(g, p, f.id, undefined, true);
      expect((await flowOf(g, p, f.id)).lastPreview).not.toBeNull();

      await flows.saveFlow(g, p.id, { id: f.id, name: 'Renamed', actions: [mayor] });
      expect((await flowOf(g, p, f.id)).lastPreview).not.toBeNull();

      await flows.saveFlow(g, p.id, { id: f.id, name: 'Renamed', actions: [mayor], cities: [p.cityId] });
      expect((await flowOf(g, p, f.id)).lastPreview).toBeNull();

      await runFlowIn(g, p, f.id, undefined, true);
      await flows.saveFlow(g, p.id, {
        id: f.id,
        name: 'Renamed',
        actions: [{ type: FlowActionType.SET_MAYOR, stat: HeroBuffId.MANAGEMENT }],
        cities: [p.cityId],
      });
      expect((await flowOf(g, p, f.id)).lastPreview).toBeNull();
    }));

  it('lets a running flow change its settings but not the number or order of its actions', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor] });
      await runFlowIn(g, p, f.id);
      expect((await flowOf(g, p, f.id)).status).toBe(FlowStatus.WAITING);

      await expectRefused(flows.saveFlow(g, p.id, { id: f.id, name: 'Waits', actions: [mayor, waitTime] }), msg('flow.runningLocked'));
      await expectRefused(flows.saveFlow(g, p.id, { id: f.id, name: 'Waits', actions: [waitTime, mayor, mayor] }), msg('flow.runningLocked'));
      const longer = { type: FlowActionType.WAIT, until: FlowWaitUntil.TIME, minutes: 30 };
      await flows.saveFlow(g, p.id, { id: f.id, name: 'Waits', actions: [{ type: FlowActionType.SET_MAYOR, stat: HeroBuffId.STRATAGEM }, longer, mayor] });
      expect((await flowOf(g, p, f.id)).actions[1]).toEqual(longer);
    }));

  it('refuses a name that is empty or too long', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(flows.saveFlow(g, p.id, { name: '   ', actions: [mayor] }), msg('flow.nameLength', { max: 40 }));
      await expectRefused(flows.saveFlow(g, p.id, { name: 'x'.repeat(41), actions: [mayor] }), msg('flow.nameLength', { max: 40 }));
      expect((await newFlow(g, p, { name: 'x'.repeat(40), actions: [mayor] })).name).toHaveLength(40);
    }));

  it('refuses no actions or more than 20', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const tooMany = msg('flow.actionCount', { min: 1, max: 20 });
      await expectRefused(flows.saveFlow(g, p.id, { name: 'X', actions: [] }), tooMany);
      await expectRefused(flows.saveFlow(g, p.id, { name: 'X', actions: Array(21).fill(mayor) }), tooMany);
      expect((await newFlow(g, p, { name: 'X', actions: Array(20).fill(mayor) })).actions).toHaveLength(20);
    }));

  it('refuses an action that does not match the schema', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (const bad of [
        { type: 'fly' },
        { type: FlowActionType.SET_MAYOR, stat: 'luck' },
        { type: FlowActionType.TRAIN_TROOPS, troopId: TroopType.WARRIOR, amount: 0 },
        { type: FlowActionType.WAIT, until: FlowWaitUntil.TIME, minutes: 0 },
        { type: FlowActionType.HEAL_TROOPS, payWith: 'gems' },
        'setMayor',
      ])
        await expectRefused(flows.saveFlow(g, p.id, { name: 'X', actions: [bad] }), msg('flow.invalidAction'));
    }));

  it('refuses to train a fortification or an unknown troop', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (const troopId of [FortType.TRAP, 99])
        await expectRefused(
          flows.saveFlow(g, p.id, { name: 'X', actions: [{ type: FlowActionType.TRAIN_TROOPS, troopId, amount: 1 }] }),
          msg('common.invalidTroopType'),
        );
    }));

  it('saves attack targets once each, and allows a list with no army chosen yet', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const preset = await armyPreset(g, p, 'Farm', { militia: 10 });
      const f = await newFlow(g, p, { name: 'Farm', actions: [{ type: FlowActionType.ATTACK_TARGETS, presetId: preset, targets: { [p.cityId]: [5, 7, 5] } }] });
      expect(f.actions[0]).toEqual({ type: FlowActionType.ATTACK_TARGETS, presetId: preset, targets: { [p.cityId]: [5, 7] } });
      const later = await newFlow(g, p, { name: 'Later', actions: [{ type: FlowActionType.ATTACK_TARGETS, presetId: '', targets: { [p.cityId]: [5] } }] });
      expect(later.actions[0]).toMatchObject({ presetId: '' });
    }));

  it('refuses an unknown army, targets under a city that is not the player’s, and tiles off the map', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const preset = await armyPreset(g, p, 'Farm', { militia: 10 });
      const attack = (presetId: string, targets: Record<string, number[]>) => ({
        name: 'X',
        actions: [{ type: FlowActionType.ATTACK_TARGETS, presetId, targets }],
      });
      await expectRefused(flows.saveFlow(g, p.id, attack('nope', { [p.cityId]: [5] })), msg('flow.chooseArmy'));
      await expectRefused(flows.saveFlow(g, p.id, attack(preset, { [other.cityId]: [5] })), msg('flow.targetsOwnCities'));
      await expectRefused(flows.saveFlow(g, p.id, attack(preset, { [p.cityId]: [-1] })), msg('common.invalidCoordinates'));
      await expectRefused(flows.saveFlow(g, p.id, attack(preset, { [p.cityId]: [BALANCE.mapSize * BALANCE.mapSize] })), msg('common.invalidCoordinates'));
      await expectRefused(flows.saveFlow(g, p.id, attack(preset, { [p.cityId]: Array.from({ length: 11 }, (_, i) => i) })), msg('flow.invalidAction'));
    }));

  it('forgets targets under a city that no longer exists', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const preset = await armyPreset(g, p, 'Farm', { militia: 10 });
      const f = await newFlow(g, p, {
        name: 'X',
        actions: [{ type: FlowActionType.ATTACK_TARGETS, presetId: preset, targets: { [p.cityId]: [5], 999999999: [6] } }],
      });
      expect(f.actions).toEqual([expect.objectContaining({ targets: { [p.cityId]: [5] } })]);
    }));

  it("refuses an unknown id, or another player's flow", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const theirs = await newFlow(g, other, { name: 'Theirs', actions: [mayor] });
      const err = await expectRefused(flows.saveFlow(g, p.id, { id: 'nope', name: 'X', actions: [mayor] }), msg('flow.notFound'));
      expect(err.status).toBe(404);
      await expectRefused(flows.saveFlow(g, p.id, { id: theirs.id, name: 'Mine now', actions: [mayor] }), msg('flow.notFound'));
      expect((await flowOf(g, other, theirs.id)).name).toBe('Theirs');
    }));

  it('refuses a 31st flow, but still lets the 30 be edited', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (let i = 0; i < 30; i++) await flows.saveFlow(g, p.id, { name: `F${i}`, actions: [mayor] });
      await expectRefused(flows.saveFlow(g, p.id, { name: 'One more', actions: [mayor] }), msg('flow.tooMany', { count: 30 }));
      const [first] = await flows.listFlows(g, p.id);
      expect((await flows.saveFlow(g, p.id, { id: first!.id, name: 'Edited', actions: [mayor] }))[0]!.name).toBe('Edited');
    }));
});

describe(flows.deleteFlow.name, () => {
  it('deletes the flow and returns the rest', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const a = await newFlow(g, p, { name: 'A', actions: [mayor] });
      await newFlow(g, p, { name: 'B', actions: [mayor] });
      expect((await flows.deleteFlow(g, p.id, a.id)).map((f) => f.name)).toEqual(['B']);
      expect((await flows.listFlows(g, p.id)).map((f) => f.name)).toEqual(['B']);
    }));

  it('cancels the wait of a running flow', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor] });
      await runFlowIn(g, p, f.id);
      expect(g.events(TimedEventType.FLOW_RESUME)).toHaveLength(1);
      await flows.deleteFlow(g, p.id, f.id);
      expect(g.events(TimedEventType.FLOW_RESUME)).toEqual([]);
      expect(await flows.listFlows(g, p.id)).toEqual([]);
    }));

  it("does nothing for an unknown id or another player's flow", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const theirs = await newFlow(g, other, { name: 'Theirs', actions: [mayor] });
      const mine = await newFlow(g, p, { name: 'Mine', actions: [mayor] });
      expect((await flows.deleteFlow(g, p.id, 'nope')).map((f) => f.id)).toEqual([mine.id]);
      expect((await flows.deleteFlow(g, p.id, theirs.id)).map((f) => f.id)).toEqual([mine.id]);
      expect(await flows.listFlows(g, other.id)).toHaveLength(1);
    }));
});
