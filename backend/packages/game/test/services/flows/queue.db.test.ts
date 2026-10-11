import { describe, expect, it } from 'vitest';
import { Mission, msg } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { armies, flows, heroes } from '../../../src/index.ts';
import { expectRefused } from '../../support/expect.ts';
import { addCity, createTestPlayer, reloadCity, type TestPlayer } from '../../support/factories.ts';
import { armyPreset, farmingCity, flowOf, loseCity, newFlow, runFlowIn, valleysNear, withHero } from '../../support/flows.ts';
import { game, T0, type TestGame } from '../../support/game.ts';

const mayor = { type: 'setMayor', stat: 'power' };
const waitTime = { type: 'wait', until: 'time', minutes: 5 };

/** Send the hero out from the city at a valley; returns the army id and when it reaches the valley. */
async function heroAway(g: TestGame, p: TestPlayer, heroId: number, cityId = p.cityId) {
  const [valley] = await valleysNear(g, cityId);
  const { armyId } = await armies.sendArmy(g, p.id, cityId, { targetTileId: valley, mission: Mission.ATTACK, troops: { militia: 10 }, heroId });
  return { armyId, reach: g.events('army').find((e) => e.payload?.armyId === armyId)!.dueAt };
}

/** Bring the army home now (recalled at once, it is back in a second). */
async function comeHome(g: TestGame, p: TestPlayer, armyId: number) {
  await armies.recallArmy(g, p.id, armyId);
  await g.runDue(g.now + 1000);
}

describe(flows.setRepeat.name, () => {
  it('switched on, runs an idle flow now and queues its next run a minute after this one started', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      const list = await flows.setRepeat(g, p.id, f.id, true);
      expect(list).toEqual(await flows.listFlows(g, p.id));
      expect(list[0]).toMatchObject({ repeat: true, status: 'queued', runs: 1, queuedAt: T0, notBefore: T0 + 60_000, lastRun: { run: 1, finishedAt: T0 } });
      expect(g.events('flow.queue')).toEqual([{ type: 'flow.queue', dueAt: T0 + 60_000, playerId: p.id, refKey: `flowqueue:${p.id}` }]);
    }));

  it('runs the flow again every minute until switched off', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await flows.setRepeat(g, p.id, f.id, true);
      await g.runDue(T0 + 120_000);
      expect(await flowOf(g, p, f.id)).toMatchObject({ runs: 3, status: 'queued', notBefore: T0 + 180_000, lastRun: { run: 3, startedAt: T0 + 120_000 } });

      g.advance(1000);
      const [off] = await flows.setRepeat(g, p.id, f.id, false);
      expect(off).toMatchObject({ repeat: false, status: 'idle' });
      await g.runDue(T0 + 600_000);
      expect((await flowOf(g, p, f.id)).runs).toBe(3);
    }));

  it('switched off during a run, lets the run finish and then stops', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor] });
      await flows.setRepeat(g, p.id, f.id, true);
      expect((await flowOf(g, p, f.id)).status).toBe('waiting');
      await flows.setRepeat(g, p.id, f.id, false);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'waiting', repeat: false });
      await g.runDue(T0 + 600_000);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', runs: 1, lastRun: { finishedAt: T0 + 300_000 } });
    }));

  it('switched on during a run, queues the flow again when the run ends', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor] });
      await runFlowIn(g, p, f.id);
      const [on] = await flows.setRepeat(g, p.id, f.id, true);
      expect(on).toMatchObject({ status: 'waiting', repeat: true, runs: 1 });
      await g.runDue(T0 + 300_000);
      // the run began more than a minute ago, so the next one starts at once (and waits in turn)
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'waiting', repeat: true, runs: 2, lastRun: { run: 2, startedAt: T0 + 300_000 } });
    }));

  it('clears the last preview', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime] });
      await runFlowIn(g, p, f.id, undefined, true);
      await runFlowIn(g, p, f.id);
      await runFlowIn(g, p, f.id, undefined, true);
      expect((await flowOf(g, p, f.id)).lastPreview).not.toBeNull();
      await flows.setRepeat(g, p.id, f.id, true);
      expect((await flowOf(g, p, f.id)).lastPreview).toBeNull();
    }));

  it('a run that fails switches repeat off', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Bad', actions: [mayor, { type: 'trainTroops', troopId: 3, amount: 1 }] });
      const [after] = await flows.setRepeat(g, p.id, f.id, true);
      expect(after).toMatchObject({ repeat: false, status: 'idle', runs: 1, stopReason: { code: 'flow.runFailed' } });
      expect(g.events('flow.queue')).toEqual([]);
    }));

  it('refuses an unknown flow, and an idle one with no city to run on', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const err = await expectRefused(flows.setRepeat(g, p.id, 'nope', true), msg('flow.notFound'));
      expect(err.status).toBe(404);
      const theirs = await newFlow(g, other, { name: 'Theirs', actions: [mayor] });
      await expectRefused(flows.setRepeat(g, p.id, theirs.id, true), msg('flow.notFound'));

      const all = await newFlow(g, p, { name: 'All', actions: [mayor] });
      await expectRefused(flows.setRepeat(g, p.id, all.id, true), msg('flow.noHeroCities'));
      expect(await flowOf(g, p, all.id)).toMatchObject({ repeat: false, status: 'idle', queuedAt: 0 });

      const second = await addCity(g, p);
      const chosen = await newFlow(g, p, { name: 'Chosen', actions: [mayor], cities: [second] });
      await loseCity(g, second, other);
      await expectRefused(flows.setRepeat(g, p.id, chosen.id, true), msg('flow.noOwnCities'));
      expect(await flowOf(g, p, chosen.id)).toMatchObject({ repeat: false, status: 'idle' });
    }));
});

describe(flows.stopFlow.name, () => {
  it('ends a waiting run where it is, with no message', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor] });
      await flows.setRepeat(g, p.id, f.id, true);
      g.advance(1000);
      const list = await flows.stopFlow(g, p.id, f.id);
      expect(list[0]).toMatchObject({
        status: 'idle',
        repeat: false,
        nextAction: 0,
        waitUntil: 0,
        heldSince: 0,
        stopReason: null,
        lastRun: { finishedAt: T0 + 1000 },
      });
      expect(g.events('flow.resume')).toEqual([]);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE)).toEqual([]);
      expect(g.pushes(PushCmd.FLOW_UPDATE).at(-1)?.data).toEqual({ flowId: f.id, status: 'idle' });
      // the mayor it appointed stays
      expect((await flowOf(g, p, f.id)).lastRun?.cities[0].steps[0].detail.code).toBe('flow.step.mayor');
    }));

  it('takes a repeating flow out of the queue', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await flows.setRepeat(g, p.id, f.id, true);
      const [stopped] = await flows.stopFlow(g, p.id, f.id);
      expect(stopped).toMatchObject({ status: 'idle', repeat: false, lastRun: { finishedAt: T0 } });
      await g.runDue(T0 + 600_000);
      expect((await flowOf(g, p, f.id)).runs).toBe(1);
    }));

  it('releases a flow held for its heroes', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      await heroAway(g, p, heroId);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await runFlowIn(g, p, f.id);
      expect((await flowOf(g, p, f.id)).heldSince).toBe(T0);
      const [stopped] = await flows.stopFlow(g, p.id, f.id);
      expect(stopped).toMatchObject({ status: 'idle', heldSince: 0, waitUntil: 0 });
      expect(g.events('flow.resume')).toEqual([]);
    }));

  it('leaves an idle flow idle', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      expect((await flows.stopFlow(g, p.id, f.id))[0]).toMatchObject({ status: 'idle', repeat: false, lastRun: null, stopReason: null });
    }));

  it("refuses an unknown flow or another player's", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const theirs = await newFlow(g, other, { name: 'Theirs', actions: [mayor] });
      const err = await expectRefused(flows.stopFlow(g, p.id, 'nope'), msg('flow.notFound'));
      expect(err.status).toBe(404);
      await expectRefused(flows.stopFlow(g, p.id, theirs.id), msg('flow.notFound'));
    }));
});

describe(flows.runQueue.name, () => {
  it('starts every queued flow whose time has come', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const a = await newFlow(g, p, { name: 'A', actions: [mayor] });
      const b = await newFlow(g, p, { name: 'B', actions: [{ type: 'setMayor', stat: 'management' }] });
      await flows.setRepeat(g, p.id, a.id, true);
      g.advance(1000);
      await flows.setRepeat(g, p.id, b.id, true);
      g.advance(59_000);
      await flows.runQueue(g, p.id);
      expect(await flowOf(g, p, a.id)).toMatchObject({ runs: 2, lastRun: { startedAt: T0 + 60_000 } });
      expect(await flowOf(g, p, b.id)).toMatchObject({ runs: 1, notBefore: T0 + 61_000 });
      // the next look at the queue: when B may start again
      expect(g.events('flow.queue')).toMatchObject([{ dueAt: T0 + 61_000 }]);
    }));

  it('leaves a queued flow that may not start yet, and looks again when it may', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await flows.setRepeat(g, p.id, f.id, true);
      g.advance(1000);
      await flows.runQueue(g, p.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ runs: 1, status: 'queued' });
      expect(g.events('flow.queue')).toMatchObject([{ dueAt: T0 + 60_000 }]);
    }));

  it('carries on a flow held for its heroes once they are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      const { armyId, reach } = await heroAway(g, p, heroId);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await runFlowIn(g, p, f.id);
      await flows.runQueue(g, p.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'waiting', heldSince: T0, waitUntil: reach + (reach - T0) });

      await comeHome(g, p, armyId);
      await flows.runQueue(g, p.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', heldSince: 0, lastRun: { finishedAt: g.now } });
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
      expect(await flowOf(g, p, later.id)).toMatchObject({ status: 'waiting', heldSince: T0 + 1000, waitUntil: T0 + 6000 });

      await flows.runQueue(g, p.id);
      expect(await flowOf(g, p, later.id)).toMatchObject({ status: 'waiting', heldSince: T0 + 1000 });

      await comeHome(g, p, armyId);
      await flows.runQueue(g, p.id);
      expect(await flowOf(g, p, first.id)).toMatchObject({ status: 'idle', runs: 1 });
      expect(await flowOf(g, p, later.id)).toMatchObject({ status: 'idle', runs: 1 });
    }));

  it('stops a repeating flow that has no city left to run on, and says why', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Heal', actions: [{ type: 'healTroops', payWith: 'resources' }] });
      await flows.setRepeat(g, p.id, f.id, true);
      await heroes.fire(g, p.id, heroId);
      g.advance(60_000);
      await flows.runQueue(g, p.id);
      const { name } = await reloadCity(g, p.cityId);
      expect(await flowOf(g, p, f.id)).toMatchObject({
        status: 'idle',
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
      await flows.runQueue(g, p.id);
      expect(g.events()).toEqual([]);
      expect(g.pushes(PushCmd.FLOW_UPDATE)).toEqual([]);
    }));
});

describe(flows.resumeFlow.name, () => {
  it('does nothing for an unknown flow or one that is not waiting', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await flows.resumeFlow(g, p.id, 'nope');
      await flows.resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', runs: 0 });
      expect(g.pushes(PushCmd.FLOW_UPDATE)).toEqual([]);
    }));

  it('carries a timed wait on to the end of the run', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor, waitTime] });
      await runFlowIn(g, p, f.id);
      g.advance(300_000);
      await flows.resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'waiting', nextAction: 4, waitUntil: T0 + 600_000 });
      g.advance(300_000);
      await flows.resumeFlow(g, p.id, f.id);
      const done = await flowOf(g, p, f.id);
      expect(done).toMatchObject({ status: 'idle', nextAction: 0, lastRun: { finishedAt: T0 + 600_000 } });
      expect(done.lastRun?.cities[0].steps.map((s) => s.detail.code)).toEqual([
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
      await flows.resumeFlow(g, p.id, f.id);
      const done = await flowOf(g, p, f.id);
      expect(done.status).toBe('idle');
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
        actions: [{ type: 'attackTargets', presetId: preset, targets: { [p.cityId]: [valley] } }, { type: 'wait', until: 'armiesHome' }, mayor],
      });
      await runFlowIn(g, p, f.id);
      const [army] = g.events('army');
      const armyId = army.payload!.armyId as number;
      await armies.recallArmy(g, p.id, armyId); // back at T0 + 1s
      await flows.resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'waiting', nextAction: 2, waitUntil: T0 + 5_000 });
      expect(g.events('flow.resume')).toMatchObject([{ dueAt: T0 + 5_000 }]);

      await g.runDue(T0 + 5_000);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', runs: 1 });
    }));

  it('a held flow waits on while a hero is away, and goes on once they are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      const { armyId, reach } = await heroAway(g, p, heroId);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await runFlowIn(g, p, f.id);
      g.advance(1000);
      await flows.resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'waiting', heldSince: T0, waitUntil: reach + (reach - T0) });

      await comeHome(g, p, armyId);
      await flows.resumeFlow(g, p.id, f.id);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', heldSince: 0, runs: 1 });
    }));
});
