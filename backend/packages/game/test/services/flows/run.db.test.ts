import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { BuildingType, dur, HeroStatus, Mission, msg, ref, TroopType } from '@marchlands/core';

import { armies, flows } from '#/index.ts';
import { heroesOfCity } from '#/repo.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addCity, createTestPlayer, reloadCity } from '#test/support/factories.ts';
import { armyPreset, farmingCity, flowOf, newFlow, runFlowIn, valleysNear, withBarracks, withHero } from '#test/support/flows.ts';
import { game, T0 } from '#test/support/game.ts';

const mayor = { type: 'setMayor', stat: 'power' };
const train5 = { type: 'trainTroops', troopId: TroopType.WARRIOR, amount: 5 };
const waitTime = { type: 'wait', until: 'time', minutes: 5 };
const noBarracks = msg('flow.cannotTrain', {
  troop: ref.troop(TroopType.WARRIOR),
  missing: [msg('flow.req.level', { name: ref.building(BuildingType.BARRACKS), level: 1 })],
});
const codes = (steps: { detail: { code: string } }[]) => steps.map((s) => s.detail.code);

describe(`${flows.runFlow.name} (preview)`, () => {
  it('runs up to the first wait and changes nothing', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      const heroId = await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Morning', actions: [mayor, train5, waitTime, mayor] });
      const before = await reloadCity(g, p.cityId);

      const r = await runFlowIn(g, p, f.id, undefined, true);
      expect(r).toMatchObject({ preview: true, flow: null, skippedCities: [] });
      expect(r.cities).toHaveLength(1);
      expect(r.cities[0]).toMatchObject({ cityId: p.cityId, cityName: before.name, ok: true, error: null });
      expect(codes(r.cities[0].steps)).toEqual(['flow.step.mayor', 'flow.step.training', 'flow.step.moreActions']);
      expect(r.cities[0].steps[2]).toEqual({
        action: msg('flow.action.wait', { time: dur(5 * 60_000) }),
        ok: true,
        detail: msg('flow.step.moreActions', { count: 1 }),
      });

      const after = await reloadCity(g, p.cityId);
      expect(after.troopQueues).toEqual(before.troopQueues);
      expect([after.food, after.wood, after.iron]).toEqual([before.food, before.wood, before.iron]);
      expect((await heroesOfCity(g, p.cityId)).find((h) => h.id === heroId)?.status).toBe(HeroStatus.IDLE);
      expect(g.events()).toEqual([]);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', runs: 0, lastRun: null });
    }));

  it('keeps its report on the flow, so a reload still shows it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      g.advance(5000);
      const r = await runFlowIn(g, p, f.id, undefined, true);
      expect((await flowOf(g, p, f.id)).lastPreview).toEqual({ at: T0 + 5000, cities: r.cities, skippedCities: [] });
      expect(g.pushes(PushCmd.FLOW_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { flowId: f.id, status: 'idle' } });
    }));

  it('ends with "the run ends" when the wait is the last action', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor, waitTime] });
      const r = await runFlowIn(g, p, f.id, undefined, true);
      expect(r.cities[0].steps.at(-1)?.detail).toEqual(msg('flow.step.runEnds'));
    }));

  it('shows a city that fails with its error, the failed step and no wait note', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Bad', actions: [mayor, train5, waitTime, mayor] });
      const [city] = (await runFlowIn(g, p, f.id, undefined, true)).cities;
      expect(city).toMatchObject({ ok: false, error: noBarracks });
      expect(city.steps.map((s) => [s.detail.code, s.ok])).toEqual([
        ['flow.step.mayor', true],
        ['flow.cannotTrain', false],
      ]);
    }));

  it('on all cities, leaves out (and reports) a city with no hero', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const second = await addCity(g, p, 'No Hero Keep');
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      const r = await runFlowIn(g, p, f.id, undefined, true);
      expect(r.cities.map((c) => c.cityId)).toEqual([p.cityId]);
      const skipped = [{ cityId: second, cityName: 'No Hero Keep', reason: msg('flow.skipNoHero') }];
      expect(r.skippedCities).toEqual(skipped);
      expect((await flowOf(g, p, f.id)).lastPreview?.skippedCities).toEqual(skipped);
    }));

  it("runs on the cities given for this run, or else the flow's own", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const second = await addCity(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor], cities: [second] });
      const own = await runFlowIn(g, p, f.id, undefined, true);
      // a chosen city is run even without a hero: the mayor action then fails there
      expect(own.cities).toMatchObject([{ cityId: second, ok: false, error: msg('flow.noMayorHero') }]);
      const given = await runFlowIn(g, p, f.id, [p.cityId], true);
      expect(given.cities).toMatchObject([{ cityId: p.cityId, ok: true }]);
      const all = await runFlowIn(g, p, f.id, 'all', true);
      expect(all.cities.map((c) => c.cityId)).toEqual([p.cityId]);
      expect(all.skippedCities.map((c) => c.cityId)).toEqual([second]);
    }));

  it('refuses an unknown flow, and a run with no city, and keeps no report', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const theirs = await newFlow(g, other, { name: 'Theirs', actions: [mayor] });
      const err = await expectRefused(runFlowIn(g, p, 'nope', undefined, true), msg('flow.notFound'));
      expect(err.status).toBe(404);
      await expectRefused(runFlowIn(g, p, theirs.id, undefined, true), msg('flow.notFound'));

      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await expectRefused(runFlowIn(g, p, f.id, undefined, true), msg('flow.noHeroCities'));
      await expectRefused(runFlowIn(g, p, f.id, [other.cityId], true), msg('flow.chooseCity'));
      expect((await flowOf(g, p, f.id)).lastPreview).toBeNull();
    }));
});

describe(flows.runFlow.name, () => {
  it('runs a flow with no wait to the end at once', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      const heroId = await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Morning', actions: [mayor, train5] });
      await runFlowIn(g, p, f.id, undefined, true);

      const r = await runFlowIn(g, p, f.id);
      expect(r.preview).toBe(false);
      expect(r.skippedCities).toEqual([]);
      expect(r.flow).toEqual(await flowOf(g, p, f.id));
      expect(r.flow).toMatchObject({ status: 'idle', runs: 1, nextAction: 0, queuedAt: T0, lastPreview: null, stopReason: null });
      expect(r.flow?.lastRun).toEqual({ run: 1, startedAt: T0, finishedAt: T0, cities: r.cities, skippedCities: [] });
      expect(codes(r.cities[0].steps)).toEqual(['flow.step.mayor', 'flow.step.training']);

      expect((await heroesOfCity(g, p.cityId)).find((h) => h.id === heroId)?.status).toBe(HeroStatus.MAYOR);
      expect(g.events('train')).toHaveLength(1);
      expect(g.pushes(PushCmd.FLOW_UPDATE).at(-1)).toMatchObject({ data: { flowId: f.id, status: 'idle' } });
    }));

  it('counts its runs', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await runFlowIn(g, p, f.id);
      g.advance(1000);
      const r = await runFlowIn(g, p, f.id);
      expect(r.flow).toMatchObject({ runs: 2, lastRun: { run: 2, startedAt: T0 + 1000 } });
      expect(codes(r.cities[0].steps)).toEqual(['flow.step.alreadyMayor']);
    }));

  it('pauses at a timed wait and carries on when it ends', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, { type: 'setMayor', stat: 'management' }] });
      const r = await runFlowIn(g, p, f.id);
      expect(r.flow).toMatchObject({ status: 'waiting', nextAction: 2, waitUntil: T0 + 300_000 });
      const wait = { action: msg('flow.action.wait', { time: dur(300_000) }), ok: true, detail: msg('flow.step.waiting', { time: dur(300_000) }) };
      expect(r.cities[0].steps[1]).toEqual(wait);
      expect(r.flow?.lastRun?.finishedAt).toBeNull();
      expect(g.events('flow.resume')).toMatchObject([{ dueAt: T0 + 300_000, playerId: p.id, payload: { flowId: f.id } }]);

      await g.runDue(T0 + 300_000);
      const done = await flowOf(g, p, f.id);
      expect(done).toMatchObject({ status: 'idle', nextAction: 0, waitUntil: 0, runs: 1 });
      expect(done.lastRun?.finishedAt).toBe(T0 + 300_000);
      expect(codes(done.lastRun!.cities[0].steps)).toEqual(['flow.step.mayor', 'flow.step.waiting', 'flow.step.alreadyMayor']);
    }));

  it('carries straight on past an armies-home wait when no army is out', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const f = await newFlow(g, p, { name: 'Waits', actions: [mayor, { type: 'wait', until: 'armiesHome' }, mayor] });
      const r = await runFlowIn(g, p, f.id);
      expect(r.flow?.status).toBe('idle');
      expect(codes(r.cities[0].steps)).toEqual(['flow.step.mayor', 'flow.step.noArmiesOut', 'flow.step.alreadyMayor']);
      expect(g.events('flow.resume')).toEqual([]);
    }));

  it('waits for the armies the run sent when it waits until they are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await farmingCity(g, p);
      const [valley] = await valleysNear(g, p.cityId);
      const preset = await armyPreset(g, p, 'Farm', { militia: 100 });
      const f = await newFlow(g, p, {
        name: 'Farm',
        actions: [{ type: 'attackTargets', presetId: preset, targets: { [p.cityId]: [valley] } }, { type: 'wait', until: 'armiesHome' }, mayor],
      });
      const r = await runFlowIn(g, p, f.id);
      const [army] = g.events('army');
      const march = army.dueAt - T0;
      // an army still marching out needs about as long again to come back
      expect(r.flow).toMatchObject({ status: 'waiting', nextAction: 2, waitUntil: T0 + 2 * march });
      expect(r.cities[0].steps[1].detail).toEqual(msg('flow.step.waiting', { time: dur(Math.ceil((2 * march) / 60_000) * 60_000) }));
      expect(g.events('flow.resume')).toMatchObject([{ dueAt: T0 + 2 * march }]);

      await g.runDue(T0 + 2 * march + 10_000);
      expect(g.events('flow.resume')).toEqual([]);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', runs: 1 });
    }));

  it('refuses a flow that is already running or queued', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const waits = await newFlow(g, p, { name: 'Waits', actions: [mayor, waitTime, mayor] });
      await runFlowIn(g, p, waits.id);
      await expectRefused(runFlowIn(g, p, waits.id), msg('flow.alreadyRunning'));

      const repeats = await newFlow(g, p, { name: 'Repeats', actions: [mayor] });
      await flows.setRepeat(g, p.id, repeats.id, true);
      expect((await flowOf(g, p, repeats.id)).status).toBe('queued');
      await expectRefused(runFlowIn(g, p, repeats.id), msg('flow.alreadyQueued'));
    }));

  it('refuses an unknown flow, or one with no city to run on, and leaves it idle', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const err = await expectRefused(runFlowIn(g, p, 'nope'), msg('flow.notFound'));
      expect(err.status).toBe(404);
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      await expectRefused(runFlowIn(g, p, f.id), msg('flow.noHeroCities'));
      await expectRefused(runFlowIn(g, p, f.id, [other.cityId]), msg('flow.chooseCity'));
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', queuedAt: 0, runs: 0 });
    }));

  it('rolls back a city that fails, keeps what the others did, and stops the flow', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      await withHero(g, p);
      const second = await addCity(g, p, 'Bare Keep');
      const secondHero = await withHero(g, p, second);
      const f = await newFlow(g, p, { name: 'Morning', actions: [mayor, train5] });

      const r = await runFlowIn(g, p, f.id);
      expect(r.cities.map((c) => [c.cityId, c.ok])).toEqual([
        [p.cityId, true],
        [second, false],
      ]);
      expect(r.cities[1]).toMatchObject({ error: noBarracks, steps: [{ ok: true }, { ok: false, detail: noBarracks }] });
      // the failed city's mayor is undone, the other city's stays
      expect((await heroesOfCity(g, second)).find((h) => h.id === secondHero)?.status).toBe(HeroStatus.IDLE);
      expect((await heroesOfCity(g, p.cityId)).some((h) => h.status === HeroStatus.MAYOR)).toBe(true);
      expect(g.events('train').map((e) => e.cityId)).toEqual([p.cityId]);

      const reason = msg('flow.runFailed', { cities: [msg('flow.failedCity', { city: 'Bare Keep', error: noBarracks })] });
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', repeat: false, stopReason: reason, lastRun: { finishedAt: T0 } });
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)).toMatchObject({
        playerIds: [p.id],
        data: { msg: msg('flow.stopped', { name: 'Morning', reason }) },
      });
    }));

  it('on all cities, skips a city with no hero and reports it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const second = await addCity(g, p, 'No Hero Keep');
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });
      const r = await runFlowIn(g, p, f.id);
      const skipped = [{ cityId: second, cityName: 'No Hero Keep', reason: msg('flow.skipNoHero') }];
      expect(r.cities.map((c) => c.cityId)).toEqual([p.cityId]);
      expect(r.skippedCities).toEqual(skipped);
      expect((await flowOf(g, p, f.id)).lastRun?.skippedCities).toEqual(skipped);
    }));

  it('holds the run while a hero of its cities is away, until the heroes are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      await withHero(g, p);
      const [valley] = await valleysNear(g, p.cityId);
      await armies.sendArmy(g, p.id, p.cityId, { targetTileId: valley, mission: Mission.ATTACK, troops: { militia: 100 }, heroId });
      const march = g.events('army')[0].dueAt - T0;
      const f = await newFlow(g, p, { name: 'Mayor', actions: [mayor] });

      const r = await runFlowIn(g, p, f.id);
      expect(r.cities).toEqual([]);
      expect(r.flow).toMatchObject({ status: 'waiting', heldSince: T0, waitUntil: T0 + 2 * march, nextAction: 0, runs: 1 });
      expect(g.events('flow.resume')).toMatchObject([{ dueAt: T0 + 2 * march, payload: { flowId: f.id } }]);

      await g.runDue(T0 + 2 * march + 10_000);
      expect(await flowOf(g, p, f.id)).toMatchObject({ status: 'idle', heldSince: 0, lastRun: { finishedAt: expect.any(Number) } });
      expect(codes((await flowOf(g, p, f.id)).lastRun!.cities[0].steps)).toEqual(['flow.step.mayor']);
    }));
});
