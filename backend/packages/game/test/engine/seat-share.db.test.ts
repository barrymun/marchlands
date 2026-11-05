// Holding a historic city: the alliance's share of its tribute (engine/seat-share.ts,
// docs/features/historical-cities.md).

import { describe, expect, it } from 'vitest';

import { BALANCE, HOUR } from '@marchlands/core';

import { tendSeat } from '#/engine/seat-share.ts';
import { getCity, saveCity } from '#/repo.ts';
import { addMember, createTestAlliance } from '#test/support/alliance.ts';
import { addCity, createTestPlayer, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** A second city of `p` made a level 12 seat, past its truce. */
async function seat(g: TestGame, p: TestPlayer, over: { troops?: Record<string, number>; gold?: number; food?: number } = {}) {
  const id = await addCity(g, p);
  const city = await getCity(g, id);
  await saveCity(g, {
    ...city,
    historicLevel: 12,
    troops: over.troops ?? {},
    loyalty: BALANCE.historic.loyalty,
    loyaltyAt: g.now,
    gold: over.gold ?? 10_000_000,
    food: over.food ?? 100_000_000,
  });
  return id;
}

describe(tendSeat.name, () => {
  it('leaves a seat with no troops, gold or food held, at full loyalty', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await seat(g, p, { gold: 0, food: 0 });
      g.advance(100 * HOUR);
      await tendSeat(g, id);
      expect(await getCity(g, id)).toMatchObject({ playerId: p.id, historicLevel: 12, loyalty: BALANCE.historic.loyalty });
    }));

  it("pays the holder's alliance its share of the tribute every whole real hour, split between the other members", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p = a.host;
      const q = await addMember(g, a);
      const id = await seat(g, p);
      await tendSeat(g, id); // starts the clock
      const before = (await getCity(g, q.cityId)).gold;
      g.advance(2 * HOUR + 1000);
      await tendSeat(g, id);
      const paid = BALANCE.historic.tribute[12] * BALANCE.historic.allianceShare * 2;
      const gained = (await getCity(g, q.cityId)).gold - before;
      // and a little tax of its own
      expect(gained).toBeGreaterThanOrEqual(paid);
      expect(gained).toBeLessThan(paid + 1000);
      expect((await getCity(g, id)).sharedAt).toBe(g.now - 1000);
    }));
});
