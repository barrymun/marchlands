import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { FlowActionType, FlowStatus, FlowWaitUntil, HealPayment, msg, TimedEventType } from '@marchlands/core';

import { resumeFlow, runQueue } from '#/engine/flows.ts';
import { armies, flows, heroes } from '#/index.ts';
import { addCity, createTestPlayer, reloadCity, type TestPlayer } from '#test/support/factories.ts';
import { armyPreset, farmingCity, flowOf, heroAway, loseCity, mayor, newFlow, runFlowIn, valleysNear, waitTime, withHero } from '#test/support/flows.ts';
import { game, T0, type TestGame } from '#test/support/game.ts';

/** Bring the army home now (recalled at once, it is back in a second). */
async function comeHome(g: TestGame, p: TestPlayer, armyId: number) {
  await armies.recallArmy(g, p.id, armyId);
  await g.runDue(g.now + 1000);
}

describe(runQueue.name, () => {
  it('starts every queued flow whose time has come', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const a = await newFlow(g, p, { name: 'A', actions: [mayor] });
      const b = await newFlow(g, p, { name: 'B', actions: [{ type: FlowActionType.SET_MAYOR, stat: 'management' }] });
      await flows.setRepeat(g, p.id, a.id, true);
      g.advance(1000);
      await flows.setRepeat(g, p.id, b.id, true);
      g.advance(59_000);
      await runQueue(g, p.id);
      expect(await flowOf(g, p, a.id)).toMatchObject({ runs: 2, lastRun: { startedAt: T0 + 60_000 } });
      expect(await flowOf(g, p, b.id)).toMatchObject({ runs: 1, notBefore: T0 + 61_000 });
      // the next look at the queue: when B may start again
      expect(g.events(TimedEventType.FLOW_QUEUE)).toMatchObject([{ dueAt: T0 + 61_000 }]);
    }));

  it('leaves a queued flow that may not start yet, and looks again when it may', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await flows.setRepeat(g, p.id, f.id, true);
      g.advance(1000);
      await runQueue(g, p.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ runs: 1, status: FlowStatus.QUEUED });
      expect(g.events(TimedEventType.FLOW_QUEUE)).toMatchObject([{ dueAt: T0 + 60_000 }]);
    }));

  it('carries on a flow held for its heroes once they are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      const { armyId, reach } = await heroAway(g, p, heroId);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await runFlowIn(g, p, f.id);
      await runQueue(g, p.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: FlowStatus.WAITING, heldSince: T0, waitUntil: reach + (reach - T0) });

      await comeHome(g, p, armyId);
      await runQueue(g, p.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: FlowStatus.IDLE, heldSince: 0, lastRun: { finishedAt: g.now } });
    }));

  it('keeps flows held later behind one still held, even when their own heroes are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      const { armyId } = await heroAway(g, p, heroId);
      const second = await addCity(g, p);
      await withHero(g, p, second);
      const first = await newFlow(g, p, { name: 'First', actions: [mayor], cities: [p.cityId] });
      const later = await newFlow(g, p, { name: 'Later', actions: [mayor], cities: [second] });
      await runFlowIn(g, p, first.id);
      g.advance(1000);
      await runFlowIn(g, p, later.id);
      expect(await flowOf(g, p, later.id)).toMatchObject({ status: FlowStatus.WAITING, heldSince: T0 + 1000, waitUntil: T0 + 6000 });

      await runQueue(g, p.id);
      expect(await flowOf(g, p, later.id)).toMatchObject({ status: FlowStatus.WAITING, heldSince: T0 + 1000 });

      await comeHome(g, p, armyId);
      await runQueue(g, p.id);
      expect(await flowOf(g, p, first.id)).toMatchObject({ status: FlowStatus.IDLE, runs: 1 });
      expect(await flowOf(g, p, later.id)).toMatchObject({ status: FlowStatus.IDLE, runs: 1 });
    }));

  it('stops a repeating flow that has no city left to run on, and says why', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Heal', actions: [{ type: FlowActionType.HEAL_TROOPS, payWith: HealPayment.RESOURCES }] });
      await flows.setRepeat(g, p.id, f.id, true);
      await heroes.fire(g, p.id, heroId);
      g.advance(60_000);
      await runQueue(g, p.id);
      const { name } = await reloadCity(g, p.cityId);
      expect(await flowOf(g, p, f.id)).toMatchObject({
        status: FlowStatus.IDLE,
        repeat: false,
        runs: 2,
        stopReason: msg('flow.noHeroCities'),
        lastRun: {
          run: 2,
          startedAt: T0 + 60_000,
          finishedAt: T0 + 60_000,
          cities: [],
          skippedCities: [{ cityId: p.cityId, cityName: name, reason: msg('flow.skipNoHero') }],
        },
      });
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)?.data).toMatchObject({
        msg: msg('flow.stopped', { name: 'Heal', reason: msg('flow.noHeroCities') }),
      });
    }));

  it('does nothing with no flow queued or held', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await runQueue(g, p.id);
      expect(g.events()).toEqual([]);
      expect(g.pushes(PushCmd.FLOW_UPDATE)).toEqual([]);
    }));
});

describe(resumeFlow.name, () => {
  it('does nothing for an unknown flow or one that is not waiting', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await resumeFlow(g, p.id, 'nope');
      await resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: FlowStatus.IDLE, runs: 0 });
      expect(g.pushes(PushCmd.FLOW_UPDATE)).toEqual([]);
    }));

  it('carries a timed wait on to the end of the run', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor, waitTime] });
      await runFlowIn(g, p, f.id);
      g.advance(300_000);
      await resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: FlowStatus.WAITING, nextAction: 4, waitUntil: T0 + 600_000 });
      g.advance(300_000);
      await resumeFlow(g, p.id, f.id);
      const done = await flowOf(g, p, f.id);
      expect(done).toMatchObject({ status: FlowStatus.IDLE, nextAction: 0, lastRun: { finishedAt: T0 + 600_000 } });
      expect(done.lastRun?.cities[0]!.steps.map((s) => s.detail.code)).toEqual([
        'flow.step.mayor',
        'flow.step.waiting',
        'flow.step.alreadyMayor',
        'flow.step.waiting',
      ]);
    }));

  it('leaves out a city lost during the wait', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const captor = await createTestPlayer(g);
      await withHero(g, p);
      const second = await addCity(g, p);
      await withHero(g, p, second);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor] });
      await runFlowIn(g, p, f.id);
      await loseCity(g, second, captor);
      g.advance(300_000);
      await resumeFlow(g, p.id, f.id);
      const done = await flowOf(g, p, f.id);
      expect(done.status).toBe(FlowStatus.IDLE);
      expect(done.lastRun?.cities.map((c) => [c.cityId, c.steps.map((s) => s.detail.code)])).toEqual([
        [p.cityId, ['flow.step.mayor', 'flow.step.waiting', 'flow.step.alreadyMayor']],
        [second, ['flow.step.mayor', 'flow.step.waiting']],
      ]);
    }));

  it('waits on while armies the run sent are still out', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await farmingCity(g, p);
      const [valley] = await valleysNear(g, p.cityId);
      const preset = await armyPreset(g, p, 'Farm', { militia: 100 });
      const f = await newFlow(g, p, {
        name: 'Farm',
        actions: [
          { type: FlowActionType.ATTACK_TARGETS, presetId: preset, targets: { [p.cityId]: [valley] } },
          { type: FlowActionType.WAIT, until: FlowWaitUntil.ARMIES_HOME },
          mayor,
        ],
      });
      await runFlowIn(g, p, f.id);
      const [army] = g.events(TimedEventType.ARMY);
      const armyId = army!.payload!.armyId as number;
      await armies.recallArmy(g, p.id, armyId); // back at T0 + 1s
      await resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: FlowStatus.WAITING, nextAction: 2, waitUntil: T0 + 5_000 });
      expect(g.events(TimedEventType.FLOW_RESUME)).toMatchObject([{ dueAt: T0 + 5_000 }]);

      await g.runDue(T0 + 5_000);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: FlowStatus.IDLE, runs: 1 });
    }));

  it('a held flow waits on while a hero is away, and goes on once they are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      const { armyId, reach } = await heroAway(g, p, heroId);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await runFlowIn(g, p, f.id);
      g.advance(1000);
      await resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: FlowStatus.WAITING, heldSince: T0, waitUntil: reach + (reach - T0) });

      await comeHome(g, p, armyId);
      await resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: FlowStatus.IDLE, heldSince: 0, runs: 1 });
    }));
});
