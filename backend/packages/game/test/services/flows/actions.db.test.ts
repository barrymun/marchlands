// What each kind of action does in a run (through runFlow; most of it previewed, which runs the actions for real and rolls back).

import { describe, expect, it } from 'vitest';
import {
  BuildingType,
  healCost,
  healHonorCost,
  heroManagement,
  heroPower,
  HeroStatus,
  Mission,
  msg,
  ref,
  TroopType,
  type FlowCityResult,
  type FlowStepResult,
} from '@marchlands/core';
import { armies, flows, heroesOfCity, player as players, type HeroRow } from '../../../src/index.ts';
import {
  addCity,
  createTestPlayer,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setHonor,
  setInjured,
  setResources,
  type TestPlayer,
} from '../../support/factories.ts';
import { armyPreset, farmingCity, newFlow, runFlowIn, valleysNear, withBarracks, withHero } from '../../support/flows.ts';
import { game, T0, type TestGame } from '../../support/game.ts';

const warrior = ref.troop(TroopType.WARRIOR);

/** Preview (or run) these actions on the player's first city; returns that city's result. */
async function tryActions(g: TestGame, p: TestPlayer, actions: unknown[], preview = true): Promise<FlowCityResult> {
  const f = await newFlow(g, p, { name: `Try ${g.now}`, actions });
  const r = await runFlowIn(g, p, f.id, [p.cityId], preview);
  return r.cities[0];
}

/** The hero with the highest value, the first one on a tie (as the flow chooses). */
const best = (list: HeroRow[], value: (h: HeroRow) => number) => list.reduce((top, h) => (value(h) > value(top) ? h : top));

describe(`${flows.runFlow.name}: setMayor`, () => {
  it('appoints the hero best at the attribute', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (let i = 0; i < 3; i++) await withHero(g, p);
      const top = best(await heroesOfCity(g, p.cityId), heroManagement);
      const city = await tryActions(g, p, [{ type: 'setMayor', stat: 'management' }], false);
      expect(city.steps[0]).toEqual({
        action: msg('flow.action.setMayor', { stat: ref.stat('management') }),
        ok: true,
        detail: msg('flow.step.mayor', { hero: top.name, stat: ref.stat('management'), value: heroManagement(top) }),
      });
      expect((await heroesOfCity(g, p.cityId)).filter((h) => h.status === HeroStatus.MAYOR).map((h) => h.id)).toEqual([top.id]);
    }));

  it('says so when the best hero already is the mayor', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      await withHero(g, p);
      const top = best(await heroesOfCity(g, p.cityId), heroPower);
      await tryActions(g, p, [{ type: 'setMayor', stat: 'power' }], false);
      const again = await tryActions(g, p, [{ type: 'setMayor', stat: 'power' }]);
      expect(again.steps[0].detail).toEqual(msg('flow.step.alreadyMayor', { hero: top.name, stat: ref.stat('power'), value: heroPower(top) }));
    }));

  it('passes over a hero leading an army', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const away = await farmingCity(g, p);
      const home = await withHero(g, p);
      const [valley] = await valleysNear(g, p.cityId);
      await armies.sendArmy(g, p.id, p.cityId, { targetTileId: valley, mission: Mission.ATTACK, troops: { militia: 10 }, heroId: away });
      const city = await tryActions(g, p, [{ type: 'setMayor', stat: 'power' }]);
      expect(city.steps[0].detail).toMatchObject({
        code: 'flow.step.mayor',
        params: { hero: (await heroesOfCity(g, p.cityId)).find((h) => h.id === home)!.name },
      });
    }));

  it('fails the city when no hero is home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const city = await tryActions(g, p, [{ type: 'setMayor', stat: 'stratagem' }]);
      expect(city).toMatchObject({ ok: false, error: msg('flow.noMayorHero'), steps: [{ ok: false, detail: msg('flow.noMayorHero') }] });
    }));
});

describe(`${flows.runFlow.name}: trainTroops`, () => {
  const train = (amount: number | 'max') => ({ type: 'trainTroops', troopId: TroopType.WARRIOR, amount });

  /** Resources for exactly `n` warriors (80 food, 100 wood, 50 iron each). */
  const fundsFor = (g: TestGame, p: TestPlayer, n: number) => setResources(g, p, { gold: 0, food: 80 * n, wood: 100 * n, stone: 0, iron: 50 * n });

  it('trains the amount in the barracks', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      const city = await tryActions(g, p, [train(5)], false);
      expect(city.steps[0]).toMatchObject({
        action: msg('flow.action.train', { amount: 5, troop: warrior }),
        ok: true,
        detail: { code: 'flow.step.training', params: { amount: 5, troop: warrior, count: 1 } },
      });
      const [batch] = (await reloadCity(g, p.cityId)).troopQueues[0].queue;
      expect(batch).toMatchObject({ troopId: TroopType.WARRIOR, count: 5, startTime: T0 });
      expect(city.steps[0].detail.params?.time).toEqual({ duration: batch.endTime - T0 });
    }));

  it("trains as many as the city can afford for 'max'", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      await fundsFor(g, p, 40);
      const city = await tryActions(g, p, [train('max')]);
      expect(city.steps[0]).toMatchObject({
        action: msg('flow.action.trainMax', { troop: warrior }),
        detail: { code: 'flow.step.training', params: { amount: 40 } },
      });
    }));

  it('trains what it can afford when that is less than the amount', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      await fundsFor(g, p, 40);
      const city = await tryActions(g, p, [train(500)]);
      expect(city.steps[0].detail).toMatchObject({ code: 'flow.step.trainingPartial', params: { amount: 40, requested: 500, troop: warrior, count: 1 } });
    }));

  it('splits the order over every barracks with room', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      await setBuildings(g, p, [[1, BuildingType.BARRACKS, 1]]);
      const city = await tryActions(g, p, [train(10)]);
      expect(city.steps[0].detail).toMatchObject({ code: 'flow.step.training', params: { amount: 10, count: 2 } });
    }));

  it('skips, and carries on, when the city cannot afford one', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      await withHero(g, p);
      await fundsFor(g, p, 0);
      const city = await tryActions(g, p, [train(5), { type: 'setMayor', stat: 'power' }]);
      expect(city.ok).toBe(true);
      expect(city.steps[0]).toMatchObject({ ok: true, skipped: true, detail: msg('flow.step.cannotAfford', { troop: warrior }) });
      expect(city.steps[1].detail.code).toBe('flow.step.mayor');
    }));

  it('skips when every barracks queue is full', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      const city = await tryActions(g, p, [train(5), train(5)]);
      expect(city.ok).toBe(true);
      expect(city.steps[1]).toMatchObject({ ok: true, skipped: true, detail: msg('flow.step.noBarracksRoom') });
    }));

  it('fails the city, listing what is missing, when the troop cannot be trained there', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p);
      const city = await tryActions(g, p, [{ type: 'trainTroops', troopId: TroopType.CATAPULT, amount: 1 }]);
      expect(city.ok).toBe(false);
      expect(city.error).toMatchObject({ code: 'flow.cannotTrain', params: { troop: ref.troop(TroopType.CATAPULT) } });
      const missing = city.error?.params?.missing as { code: string; params: { name: unknown; level: number } }[];
      expect(missing).toContainEqual(msg('flow.req.level', { name: ref.building(BuildingType.BARRACKS), level: 10 }));
      expect(missing.every((m) => m.code === 'flow.req.level')).toBe(true);
    }));
});

describe(`${flows.runFlow.name}: healTroops`, () => {
  const injured = { militia: 10, archer: 4 };

  it('passes when nothing is injured', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const city = await tryActions(g, p, [{ type: 'healTroops', payWith: 'resources' }]);
      expect(city.steps[0]).toEqual({ action: msg('flow.action.healResources'), ok: true, detail: msg('flow.step.noInjured') });
    }));

  it('heals every injured troop for resources', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setInjured(g, p.cityId, injured);
      const before = await reloadCity(g, p.cityId);
      const city = await tryActions(g, p, [{ type: 'healTroops', payWith: 'resources' }], false);
      const cost = healCost(injured);
      const amounts = (['food', 'wood', 'iron'] as const).map((k) => msg('flow.resourceAmount', { amount: Math.ceil(cost[k]), resource: ref.resource(k) }));
      expect(cost.gold + cost.stone).toBe(0);
      expect(city.steps[0].detail).toEqual(msg('flow.step.healed', { count: 14, cost: amounts }));
      const after = await reloadCity(g, p.cityId);
      expect(after.injuredTroops).toEqual({});
      expect(after.troops).toMatchObject(injured);
      expect(after.food).toBe(before.food - cost.food);
    }));

  it('heals every injured troop for honour', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setInjured(g, p.cityId, injured);
      await setHonor(g, p, 1000);
      const city = await tryActions(g, p, [{ type: 'healTroops', payWith: 'honor' }], false);
      expect(city.steps[0]).toEqual({
        action: msg('flow.action.healHonour'),
        ok: true,
        detail: msg('flow.step.healedHonour', { count: 14, honour: healHonorCost(injured) }),
      });
      expect((await reloadPlayer(g, p)).honor).toBe(1000 - healHonorCost(injured));
    }));

  it('fails the city when it cannot pay for them all', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setInjured(g, p.cityId, injured);
      const city = await tryActions(g, p, [{ type: 'healTroops', payWith: 'honor' }], false);
      const error = msg('training.notEnoughHonor', { amount: healHonorCost(injured) });
      expect(city).toMatchObject({ ok: false, error });
      expect((await reloadCity(g, p.cityId)).injuredTroops).toEqual(injured);
    }));

  it('once the armies are home: heals now when the run sent none', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setInjured(g, p.cityId, injured);
      const city = await tryActions(g, p, [{ type: 'healTroops', payWith: 'resources', when: 'armiesHome' }]);
      expect(city.steps[0]).toMatchObject({ action: msg('flow.action.healResourcesHome'), detail: { code: 'flow.step.healed', params: { count: 14 } } });
      expect(g.events('flow.heal')).toEqual([]);
    }));

  it('once the armies are home: waits for the armies the run sent', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await farmingCity(g, p);
      await setInjured(g, p.cityId, injured);
      const [valley] = await valleysNear(g, p.cityId);
      const preset = await armyPreset(g, p, 'Farm', { militia: 100 });
      const city = await tryActions(
        g,
        p,
        [
          { type: 'attackTargets', presetId: preset, targets: { [p.cityId]: [valley] } },
          { type: 'healTroops', payWith: 'honor', when: 'armiesHome' },
        ],
        false,
      );
      const [army] = g.events('army');
      const homeBy = army.dueAt + (army.dueAt - T0);
      expect(city.steps[1]).toEqual({
        action: msg('flow.action.healHonourHome'),
        ok: true,
        detail: msg('flow.step.healScheduled', { count: 1, time: { duration: Math.ceil((homeBy - T0) / 60_000) * 60_000 } }),
      });
      expect(g.events('flow.heal')).toEqual([
        {
          type: 'flow.heal',
          dueAt: homeBy,
          playerId: p.id,
          cityId: p.cityId,
          refKey: `flowheal:${p.cityId}`,
          payload: { payWith: 'honor', armyIds: [army.payload!.armyId] },
        },
      ]);
      expect((await reloadCity(g, p.cityId)).injuredTroops).toEqual(injured);
    }));
});

describe(`${flows.runFlow.name}: attackTargets`, () => {
  const attack = (presetId: string, targets: Record<string, number[]>) => ({ type: 'attackTargets', presetId, targets });
  const items = (step: FlowStepResult) => step.items!.map((i) => [i.label, i.ok, i.detail]);
  const at = (tile: number) => `(${tile % 800},${Math.floor(tile / 800)})`;

  it('sends the saved army at each target, the strongest idle hero first', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await farmingCity(g, p);
      await withHero(g, p);
      const [h1, h2] = [...(await heroesOfCity(g, p.cityId))].sort((x, y) => heroPower(y) - heroPower(x));
      const valleys = await valleysNear(g, p.cityId, 2);
      const preset = await armyPreset(g, p, 'Farm', { militia: 100 });
      const city = await tryActions(g, p, [attack(preset, { [p.cityId]: valleys })], false);
      expect(city.steps[0].action).toEqual(msg('flow.action.attack', { count: 2 }));
      expect(city.steps[0].detail).toEqual(msg('flow.step.sent', { sent: 2, total: 2, army: 'Farm' }));
      expect(items(city.steps[0])).toEqual([
        [at(valleys[0]), true, msg('flow.target.sent', { hero: h1.name })],
        [at(valleys[1]), true, msg('flow.target.sent', { hero: h2.name })],
      ]);
      expect(g.events('army')).toHaveLength(2);
      expect((await reloadCity(g, p.cityId)).troops.militia).toBe(800);
    }));

  it('skips a target it cannot attack and lets its hero lead the next one', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      const own = (await reloadCity(g, p.cityId)).tileId;
      const [valley] = await valleysNear(g, p.cityId);
      const preset = await armyPreset(g, p, 'Farm', { militia: 100 });
      const city = await tryActions(g, p, [attack(preset, { [p.cityId]: [own, valley] })]);
      const name = (await heroesOfCity(g, p.cityId)).find((h) => h.id === heroId)!.name;
      expect(city.ok).toBe(true);
      expect(city.steps[0].detail).toEqual(msg('flow.step.sent', { sent: 1, total: 2, army: 'Farm' }));
      expect(items(city.steps[0])).toEqual([
        [at(own), false, msg('flow.target.refused', { reason: msg('army.invalidTarget') })],
        [at(valley), true, msg('flow.target.sent', { hero: name })],
      ]);
    }));

  it('skips targets when the troops or the idle heroes run out', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await farmingCity(g, p, p.cityId, 150);
      await withHero(g, p);
      await withHero(g, p);
      const valleys = await valleysNear(g, p.cityId, 3);
      const preset = await armyPreset(g, p, 'Farm', { militia: 100 });
      const city = await tryActions(g, p, [attack(preset, { [p.cityId]: valleys })]);
      expect(items(city.steps[0]).map(([, ok, detail]) => [ok, detail])).toEqual([
        [true, expect.objectContaining({ code: 'flow.target.sent' })],
        [false, msg('flow.target.notEnoughTroops', { army: 'Farm' })],
        [false, msg('flow.target.notEnoughTroops', { army: 'Farm' })],
      ]);

      const q = await createTestPlayer(g);
      await farmingCity(g, q);
      const more = await valleysNear(g, q.cityId, 2);
      const qPreset = await armyPreset(g, q, 'Farm', { militia: 100 });
      const qCity = await tryActions(g, q, [attack(qPreset, { [q.cityId]: more })]);
      expect(items(qCity.steps[0])[1]).toEqual([at(more[1]), false, msg('flow.target.noIdleHero')]);
    }));

  it('passes over a city with no targets, a list with no army chosen, and an army since deleted', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await farmingCity(g, p);
      const preset = await armyPreset(g, p, 'Farm', { militia: 100 });
      const [valley] = await valleysNear(g, p.cityId);
      const noTargets = await tryActions(g, p, [attack(preset, { [p.cityId]: [] })]);
      expect(noTargets.steps[0]).toMatchObject({ ok: true, detail: msg('flow.step.noTargets') });
      const noArmy = await tryActions(g, p, [attack('', { [p.cityId]: [valley] })]);
      expect(noArmy.steps[0]).toMatchObject({ ok: true, detail: msg('flow.step.noArmy') });
      const f = await newFlow(g, p, { name: 'Gone', actions: [attack(preset, { [p.cityId]: [valley] })] });
      await players.deleteArmyPreset(g, p.id, preset);
      const gone = await runFlowIn(g, p, f.id, [p.cityId], true);
      expect(gone.cities[0].steps[0]).toMatchObject({ ok: true, detail: msg('flow.step.armyGone') });
    }));

  it('names the number of cities when targets are listed under several', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withHero(g, p);
      const second = await addCity(g, p);
      const f = await newFlow(g, p, { name: 'Two', actions: [attack('', { [p.cityId]: [1, 2], [second]: [3] })] });
      const r = await runFlowIn(g, p, f.id, [p.cityId], true);
      expect(r.cities[0].steps[0].action).toEqual(msg('flow.action.attackFrom', { count: 3, cities: msg('flow.cityCount', { count: 2 }) }));
    }));
});
