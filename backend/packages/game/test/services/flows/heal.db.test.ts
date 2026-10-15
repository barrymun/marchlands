import { describe, expect, it } from 'vitest';

import { runScheduledHeal } from '#/engine/flows.ts';
import { armies, flows } from '#/index.ts';
import { createTestPlayer, setInjured } from '#test/support/factories.ts';
import { farmingCity, healed, injured, newFlow, persistEvents, runFlowIn, sendOut, storedEvent } from '#test/support/flows.ts';
import { game } from '#test/support/game.ts';

describe(`${flows.runFlow.name}: a heal still waiting from an earlier run`, () => {
  it('is done now, and no longer waits, once that run’s armies are home', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const heroId = await farmingCity(g, p);
      await setInjured(g, p.cityId, injured);
      const armyId = await sendOut(g, p, heroId);
      await runScheduledHeal(g, p.id, p.cityId, 'resources', [armyId]);
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
