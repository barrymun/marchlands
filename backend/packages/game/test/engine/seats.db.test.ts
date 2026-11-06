// What holding a state's capital or Atlantis brings beyond drafting: titles, a share of market fees, and rule over the
// state, cut off from its faction (docs/features/historical-cities.md). Tribute is in core's city economy (rules.test.ts).

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BALANCE, npcFaction, ReportBodyKind, stateOf, stateTribute } from '@marchlands/core';
import { marketShipments } from '@marchlands/db';

import { GOLD, payFeeShares } from '#/engine/market.ts';
import { loadNpcEconomy, npcGroups, npcTradeTick } from '#/engine/npc-economy.ts';
import { seatTitles, stateRulers } from '#/engine/seats.ts';
import { factions, historic } from '#/index.ts';
import { getCity } from '#/repo.ts';
import { reportsOf } from '#test/support/armies.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { barbariansNear, makeSeat } from '#test/support/historic.ts';

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

describe(stateRulers.name, () => {
  it('cuts a ruled state out of the factions’ trade and pays its capital the state’s tribute', () =>
    game(async (g) => {
      const ruler = await createTestPlayer(g, { zone: 3 });
      await makeSeat(g, ruler, { level: 16 });
      expect([...(await stateRulers(g)).keys()]).toEqual([3]);
      await npcTradeTick(g);
      const all = await npcGroups(g);
      const econ = await loadNpcEconomy(g, false);
      expect(econ?.groups).toEqual(all.filter((x) => x.zone !== 3));
      const tribute = Math.round(stateTribute(all.filter((x) => x.zone === 3)));
      expect(tribute).toBeGreaterThan(0);
      expect((await getCity(g, ruler.cityId)).stateTribute).toBe(tribute);
      expect(await factions.rulers(g)).toEqual([{ zoneId: 3, cityId: ruler.cityId, playerId: ruler.id, player: ruler.name, tribute }]);
    }));

  it('drafting from a ruled state’s members costs no standing', () =>
    game(async (g) => {
      const ruler = await createTestPlayer(g, { zone: 3 });
      const drafter = await createTestPlayer(g, { zone: 3 });
      await makeSeat(g, ruler, { level: 16 });
      await makeSeat(g, drafter);
      const target = (await barbariansNear(g, drafter, true)).find((t) => npcFaction(t.id, t.level))!;
      await historic.draftNow(g, drafter.id, drafter.cityId, target.id);
      const r = (await reportsOf(g, drafter.id)).at(-1)!;
      expect(r.body).toMatchObject({ kind: ReportBodyKind.DRAFT });
      expect(r.body.kind === ReportBodyKind.DRAFT && r.body.draft.standing).toBeFalsy();
    }));
});
