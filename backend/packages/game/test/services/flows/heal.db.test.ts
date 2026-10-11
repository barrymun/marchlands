import { describe, expect, it } from 'vitest';
import { healCost, healHonorCost, Mission, msg, ref } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { armies, flows } from '../../../src/index.ts';
import { createTestPlayer, reloadCity, setHonor, setInjured, type TestPlayer } from '../../support/factories.ts';
import { armyPreset, farmingCity, loseCity, newFlow, persistEvents, runFlowIn, storedEvent, valleysNear } from '../../support/flows.ts';
import { game, T0, type TestGame } from '../../support/game.ts';

const injured = { militia: 10 };
const healed = () => {
  const cost = healCost(injured);
  const amounts = (['food', 'wood', 'iron'] as const).map((k) => msg('flow.resourceAmount', { amount: Math.ceil(cost[k]), resource: ref.resource(k) }));
  return msg('flow.step.healed', { count: 10, cost: amounts });
};

/** Send 10 militia from the city at a valley with the hero; returns the army id. */
async function sendOut(g: TestGame, p: TestPlayer, heroId: number) {
  const [valley] = await valleysNear(g, p.cityId);
  return (await armies.sendArmy(g, p.id, p.cityId, { targetTileId: valley, mission: Mission.ATTACK, troops: { militia: 10 }, heroId })).armyId;
}

describe(flows.runScheduledHeal.name, () => {
  it('heals once the armies are home and tells the player', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setInjured(g, p.cityId, injured);
      const { name } = await reloadCity(g, p.cityId);
      await flows.runScheduledHeal(g, p.id, p.cityId, 'resources', []);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)).toMatchObject({
        playerIds: [p.id],
        data: { msg: msg('flow.healDone', { city: name, result: healed() }) },
      });
      const c = await reloadCity(g, p.cityId);
      expect(c.injuredTroops).toEqual({});
      expect(c.troops.militia).toBe(10);
    }));

  it('says so when nothing is injured', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await flows.runScheduledHeal(g, p.id, p.cityId, 'honor', []);
      const { name } = await reloadCity(g, p.cityId);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)?.data).toMatchObject({
        msg: msg('flow.healDone', { city: name, result: msg('flow.step.noInjured') }),
      });
    }));

  it('tells the player when the city cannot pay, and heals nothing', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setInjured(g, p.cityId, injured);
      await setHonor(g, p, 0);
      await flows.runScheduledHeal(g, p.id, p.cityId, 'honor', []);
      const { name, injuredTroops } = await reloadCity(g, p.cityId);
      const error = msg('training.notEnoughHonor', { amount: healHonorCost(injured) });
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)?.data).toMatchObject({ msg: msg('flow.healFailed', { city: name, error }) });
      expect(injuredTroops).toEqual(injured);
    }));

  it('waits longer while an army is still out', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      await setInjured(g, p.cityId, injured);
      const armyId = await sendOut(g, p, heroId);
      const reach = g.events('army')[0].dueAt;
      await flows.runScheduledHeal(g, p.id, p.cityId, 'resources', [armyId]);
      expect(g.events('flow.heal')).toEqual([
        // still marching out: about as long again to come back
        {
          type: 'flow.heal',
          dueAt: reach + (reach - T0),
          playerId: p.id,
          cityId: p.cityId,
          refKey: `flowheal:${p.cityId}`,
          payload: { payWith: 'resources', armyIds: [armyId] },
        },
      ]);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE)).toEqual([]);
      expect((await reloadCity(g, p.cityId)).injuredTroops).toEqual(injured);
    }));

  it('looks again no sooner than 5 seconds later', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      const armyId = await sendOut(g, p, heroId);
      await armies.recallArmy(g, p.id, armyId); // home in a second
      await flows.runScheduledHeal(g, p.id, p.cityId, 'honor', [armyId]);
      expect(g.events('flow.heal')).toMatchObject([{ dueAt: T0 + 5_000, payload: { payWith: 'honor', armyIds: [armyId] } }]);
    }));

  it('does nothing in a city that changed hands', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const captor = await createTestPlayer(g);
      await setInjured(g, p.cityId, injured);
      await loseCity(g, p.cityId, captor);
      const pushed = g.pushes().length;
      await flows.runScheduledHeal(g, p.id, p.cityId, 'resources', []);
      expect(g.pushes()).toHaveLength(pushed);
      expect(g.events('flow.heal')).toEqual([]);
      expect((await reloadCity(g, p.cityId)).injuredTroops).toEqual(injured);
    }));

  it('runs as the timed event a flow scheduled, once its armies are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await farmingCity(g, p);
      await setInjured(g, p.cityId, injured);
      const [valley] = await valleysNear(g, p.cityId);
      const preset = await armyPreset(g, p, 'Farm', { militia: 100 });
      const f = await newFlow(g, p, {
        name: 'Farm',
        actions: [
          { type: 'attackTargets', presetId: preset, targets: { [p.cityId]: [valley] } },
          { type: 'healTroops', payWith: 'resources', when: 'armiesHome' },
        ],
      });
      await runFlowIn(g, p, f.id);
      const [heal] = g.events('flow.heal');
      await armies.recallArmy(g, p.id, (heal.payload as { armyIds: number[] }).armyIds[0]);
      await g.runDue(heal.dueAt);
      expect(g.events()).toEqual([]);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)?.data).toMatchObject({ msg: { code: 'flow.healDone' } });
      expect((await reloadCity(g, p.cityId)).injuredTroops).toEqual({});
    }));
});

describe(`${flows.runFlow.name}: a heal still waiting from an earlier run`, () => {
  it('is done now, and no longer waits, once that run’s armies are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      await setInjured(g, p.cityId, injured);
      const armyId = await sendOut(g, p, heroId);
      await flows.runScheduledHeal(g, p.id, p.cityId, 'resources', [armyId]);
      await persistEvents(g);
      await armies.recallArmy(g, p.id, armyId);
      await g.runDue(g.events('army')[0].dueAt);
      expect(await storedEvent(g, `flowheal:${p.cityId}`)).toBeDefined();

      const f = await newFlow(g, p, { name: 'Heal', actions: [{ type: 'healTroops', payWith: 'resources', when: 'armiesHome' }] });
      const r = await runFlowIn(g, p, f.id);
      expect(r.cities[0].steps[0].detail).toEqual(healed());
      expect(await storedEvent(g, `flowheal:${p.cityId}`)).toBeUndefined();
    }));
});
