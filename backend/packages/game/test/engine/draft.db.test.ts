// pickDraftTarget: the barbarian city a seat drafting by itself aims at (docs/features/historical-cities.md).

import { describe, expect, it } from 'vitest';

import { npcTemplate } from '@marchlands/core';

import { pickDraftTarget } from '#/engine/draft.ts';
import { getCity, saveTile } from '#/repo.ts';
import { createTestPlayer, setCityStats } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { barbariansNear, makeSeat } from '#test/support/historic.ts';

describe(pickDraftTarget.name, () => {
  it('aims at the highest level in its area; with a scout, at the one of them with the most troops', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setCityStats(g, p, { troops: { scouter: 1 } });
      const seat = await makeSeat(g, p);
      const all = await barbariansNear(g, p, true);
      const top = Math.max(...all.map((t) => t.level));
      const best = all.filter((t) => t.level === top);
      // weaken every one of the strongest but one
      const [keep, ...rest] = best;
      for (const t of rest)
        await saveTile(g, {
          ...t,
          troops: {},
          forts: {},
          state: { regenAt: g.now, refillAt: g.now, loyaltyAt: g.now, loyalty: 50, gold: 0, food: 0, wood: 0, stone: 0, iron: 0, population: 0 },
        });
      const picked = await pickDraftTarget(g, seat, 12);
      expect(picked?.tile.id).toBe(keep!.id);
      expect(picked?.tile.level).toBe(top);
      expect(picked?.scouted).toBe(best.length > 1 ? best.length : 0);
      expect(Object.keys(npcTemplate(top).troops).length).toBeGreaterThan(0);
    }));

  it('without a scout, picks one of the strongest at random', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const seat = await makeSeat(g, p);
      expect((await getCity(g, p.cityId)).troops.scouter ?? 0).toBe(0);
      const all = await barbariansNear(g, p, true);
      const top = Math.max(...all.map((t) => t.level));
      const picked = await pickDraftTarget(g, seat, 12);
      expect(picked?.tile.level).toBe(top);
      expect(picked?.scouted).toBe(0);
    }));
});
