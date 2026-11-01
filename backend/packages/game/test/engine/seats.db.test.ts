// What holding a state's capital or Atlantis brings beyond drafting: titles and a share of market fees
// (docs/features/historical-cities.md). Tribute is in core's city economy (rules.test.ts).

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BALANCE, stateOf } from '@marchlands/core';
import { marketShipments } from '@marchlands/db';

import { GOLD, payFeeShares } from '#/engine/market.ts';
import { seatTitles } from '#/engine/seats.ts';
import { getCity } from '#/repo.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { makeSeat } from '#test/support/historic.ts';

describe(seatTitles.name, () => {
  it('names the holder of a capital its state’s ruler, and Atlantis’s holder its sovereign', () =>
    game(async (g) => {
      const ruler = await createTestPlayer(g);
      const sovereign = await createTestPlayer(g);
      const nobody = await createTestPlayer(g);
      await makeSeat(g, ruler, { level: 16 });
      await makeSeat(g, sovereign, { level: 18 });
      const titles = await seatTitles(g, [ruler.id, sovereign.id, nobody.id]);
      expect(titles.get(ruler.id)).toEqual({ level: 16, zoneId: stateOf((await getCity(g, ruler.cityId)).tileId) });
      expect(titles.get(sovereign.id)?.level).toBe(18);
      expect(titles.has(nobody.id)).toBe(false);
    }));
});

describe(payFeeShares.name, () => {
  it('ships the capital’s holder a share of a fee its state’s buyers pay, and Atlantis’s holder a share of every fee', () =>
    game(async (g) => {
      const buyer = await createTestPlayer(g, { zone: 3 });
      const ruler = await createTestPlayer(g, { zone: 3 });
      const elsewhere = await createTestPlayer(g, { zone: 9 });
      const sovereign = await createTestPlayer(g, { zone: 9 });
      await makeSeat(g, ruler, { level: 16 });
      await makeSeat(g, elsewhere, { level: 16 });
      await makeSeat(g, sovereign, { level: 18 });
      await payFeeShares(g, buyer.cityId, 1_000_000);
      const fee = 1_000_000 * BALANCE.marketFee;
      const shipped = async (cityId: number) =>
        (await g.tx.select().from(marketShipments).where(eq(marketShipments.cityId, cityId))).map((s) => ({ resType: s.resType, amount: s.amount }));
      expect(await shipped(ruler.cityId)).toEqual([{ resType: GOLD, amount: Math.floor(fee * BALANCE.historic.feeShare.capital) }]);
      expect(await shipped(sovereign.cityId)).toEqual([{ resType: GOLD, amount: Math.floor(fee * BALANCE.historic.feeShare.atlantis) }]);
      expect(await shipped(elsewhere.cityId)).toEqual([]);
    }));
});
