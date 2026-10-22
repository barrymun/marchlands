import { describe, expect, it } from 'vitest';

import { goldForSpeedup, HOUR, msg, scaled } from '@marchlands/core';

import { market } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import { reloadCity, setResources } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { createTrader, shipWoodTo, withMerchantCurve, withShipmentTime } from '#test/support/market.ts';

describe(market.speedupShipment.name, () => {
  it('delivers now for gold from the receiving city', () =>
    withShipmentTime(HOUR, () =>
      withMerchantCurve(() =>
        game(async (g) => {
          const [a, b] = [await createTrader(g), await createTrader(g, {}, 2)];
          const s = (await shipWoodTo(g, a, b))!;
          expect(s.endTime).toBe(g.now + scaled(Math.floor(HOUR / 2)));
          expect(g.events('shipment')).toMatchObject([{ dueAt: s.endTime, refKey: `shipment:${s.id}`, payload: { shipmentId: s.id } }]);
          const gold0 = (await reloadCity(g, b.cityId)).gold;

          await market.speedupShipment(g, b.id, s.id);
          const cost = goldForSpeedup(s.endTime - g.now);
          expect(cost).toBeGreaterThan(0);
          expect((await reloadCity(g, b.cityId)).gold).toBe(gold0 - cost);
          expect(g._stats.get(`${b.id}|${b.cityId}`)).toMatchObject({ 'spent.speedups.gold': cost });
          expect(await market.myShipments(g, b.id)).toMatchObject([{ id: s.id, endTime: g.now }]);
          expect(g.events('shipment')).toMatchObject([{ dueAt: g.now, refKey: `shipment:${s.id}` }]);

          expect(await g.runDue()).toBe(1);
          expect(await reloadCity(g, b.cityId)).toMatchObject({ wood: 1_001_000 });
        }),
      ),
    ));

  it('rejects an unknown shipment, one of another player, or a city without the gold', () =>
    withShipmentTime(HOUR, () =>
      withMerchantCurve(() =>
        game(async (g) => {
          const [a, b] = [await createTrader(g), await createTrader(g)];
          const s = (await shipWoodTo(g, a, b))!;
          await expectRefused(market.speedupShipment(g, a.id, s.id), msg('market.shipmentNotFound'));
          await expectRefused(market.speedupShipment(g, b.id, s.id + 1000), msg('market.shipmentNotFound'));
          await setResources(g, b, { gold: 0 });
          await expectRefused(market.speedupShipment(g, b.id, s.id), msg('common.notEnoughGoldFor', { amount: goldForSpeedup(s.endTime - g.now) }));
          expect(await market.myShipments(g, b.id)).toMatchObject([{ endTime: s.endTime }]);
        }),
      ),
    ));
});
