import { describe, expect, it } from 'vitest';
import { msg } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { flows } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addCity, createTestPlayer } from '#test/support/factories.ts';
import { farmingCity, flowOf, heroAway, loseCity, mayor, newFlow, runFlowIn, waitTime, withHero } from '#test/support/flows.ts';
import { game, T0 } from '#test/support/game.ts';

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
