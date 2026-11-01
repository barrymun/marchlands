// Holding a historic city: unrest, rising up, and the alliance's share of its tribute (engine/unrest.ts,
// docs/features/historical-cities.md). Upkeep itself is in core's city economy (rules.test.ts).

import { describe, expect, it } from 'vitest';

import { BALANCE, HOUR, msg, TileType } from '@marchlands/core';

import { tendSeat } from '#/engine/unrest.ts';
import { findCity, getCity, getTile, saveCity } from '#/repo.ts';
import { addMember, createTestAlliance } from '#test/support/alliance.ts';
import { reportsOf } from '#test/support/armies.ts';
import { addCity, createTestPlayer, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

const U = BALANCE.historic.unrest;

/** A second city of `p` made a level 12 seat, past its truce, with these troops at home and plenty to pay its upkeep. */
async function seat(g: TestGame, p: TestPlayer, over: { troops?: Record<string, number>; loyalty?: number; food?: number } = {}) {
  const id = await addCity(g, p);
  const city = await getCity(g, id);
  await saveCity(g, {
    ...city,
    historicLevel: 12,
    troops: over.troops ?? { militia: U.garrison[12] },
    loyalty: over.loyalty ?? BALANCE.historic.loyalty,
    loyaltyAt: g.now,
    gold: 10_000_000,
    food: over.food ?? 100_000_000,
  });
  return id;
}

describe(tendSeat.name, () => {
  it('keeps a garrisoned, paid seat at full loyalty', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await seat(g, p);
      g.advance(HOUR);
      await tendSeat(g, id);
      expect((await getCity(g, id)).loyalty).toBe(BALANCE.historic.loyalty);
    }));

  it('loses a point every unrest step without its garrison at home, twice as fast out of food for its upkeep too', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const short = await seat(g, p, { troops: { militia: U.garrison[12] - 1 } });
      // its tribute pays its gold, but a new city's farms can't feed its upkeep
      const broke = await seat(g, p, { troops: {}, food: 0 });
      g.advance(U.msPerPoint * 3);
      await tendSeat(g, short);
      await tendSeat(g, broke);
      expect((await getCity(g, short)).loyalty).toBe(BALANCE.historic.loyalty - 3);
      expect((await getCity(g, broke)).loyalty).toBe(BALANCE.historic.loyalty - 6);
    }));

  it('has no unrest under its truce', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await seat(g, p, { troops: {} });
      await saveCity(g, { ...(await getCity(g, id)), truceUntil: g.now + BALANCE.historic.truceMs });
      g.advance(U.msPerPoint * 3);
      await tendSeat(g, id);
      expect((await getCity(g, id)).loyalty).toBe(BALANCE.historic.loyalty);
    }));

  it('rises up at 0: the city is gone, its tile a whole historic city again, and its holder is told', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await seat(g, p, { troops: {}, loyalty: 1 });
      const { tileId, name } = await getCity(g, id);
      g.advance(U.msPerPoint);
      await tendSeat(g, id);
      expect(await findCity(g, id)).toBeFalsy();
      expect(await getTile(g, tileId)).toMatchObject({ type: TileType.HISTORIC, level: 12, cityId: null, ownerPlayerId: null, state: null });
      const r = (await reportsOf(g, p.id)).at(-1)!;
      expect(r.title).toEqual(msg('report.title.seatRebelled'));
      expect(r.body).toEqual({ kind: 'text', text: msg('report.seatRebelled', { name, level: 12 }) });
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
