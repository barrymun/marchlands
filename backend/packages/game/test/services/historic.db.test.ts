// The daily draft of a held historic city, by hand (docs/features/historical-cities.md).

import { describe, expect, it } from 'vitest';

import { BALANCE, msg, npcTemplate, TileType } from '@marchlands/core';

import { historic } from '#/index.ts';
import { getCity, getTile } from '#/repo.ts';
import { reportsOf, valleyNear } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { barbariansNear, makeSeat } from '#test/support/historic.ts';

describe(historic.draftNow.name, () => {
  it('takes a fifth of a barbarian city’s largest troop type in the seat’s area into the seat', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await makeSeat(g, p);
      const [target] = await barbariansNear(g, p, true);
      const full = npcTemplate(target!.level).troops;
      const [key, most] = Object.entries(full).sort((a, b) => b[1] - a[1])[0]!;
      const taken = Math.floor(most * BALANCE.historic.draftShare);

      expect(await historic.draftNow(g, p.id, p.cityId, target!.id)).toEqual({ troops: { [key]: taken } });
      expect((await getCity(g, p.cityId)).troops[key as 'militia']).toBe(taken);
      expect((await getCity(g, p.cityId)).draftsUsed).toBe(1);
      expect((await getTile(g, target!.id)).troops![key as 'militia']).toBe(most - taken);
      const r = (await reportsOf(g, p.id)).at(-1)!;
      expect(r.title).toEqual(msg('report.title.draft'));
      expect(r.body).toMatchObject({ kind: 'draft', draft: { cityId: p.cityId, level: target!.level, troops: { [key]: taken }, auto: false } });
    }));

  it('refuses a city that isn’t a seat, a barbarian city outside its area, any other tile, and a fifth draft in a day', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const [inside] = await barbariansNear(g, p, true);
      await expectRefused(historic.draftNow(g, p.id, p.cityId, inside!.id), msg('city.notHistoric'));
      await makeSeat(g, p);
      const [outside] = await barbariansNear(g, p, false);
      await expectRefused(historic.draftNow(g, p.id, p.cityId, outside!.id), msg('city.draftOutOfArea'));
      const valley = await valleyNear(g, p.cityId);
      await expectRefused(historic.draftNow(g, p.id, p.cityId, valley.id), msg('city.draftNotBarbarian'));
      for (let i = 0; i < BALANCE.historic.draftsPerDay; i++) await historic.draftNow(g, p.id, p.cityId, inside!.id);
      await expectRefused(historic.draftNow(g, p.id, p.cityId, inside!.id), msg('city.noDraftsLeft', { count: BALANCE.historic.draftsPerDay }));
      // a new day, new drafts
      g.advance(86_400_000);
      expect((await historic.draftNow(g, p.id, p.cityId, inside!.id)).troops).toBeDefined();
    }));
});

describe(historic.setDraftAuto.name, () => {
  it('turns drafting by itself off and on, for a seat only', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(historic.setDraftAuto(g, p.id, p.cityId, false), msg('city.notHistoric'));
      await makeSeat(g, p);
      await historic.setDraftAuto(g, p.id, p.cityId, false);
      expect((await getCity(g, p.cityId)).draftAuto).toBe(false);
      await historic.setDraftAuto(g, p.id, p.cityId, true);
      expect((await getCity(g, p.cityId)).draftAuto).toBe(true);
      expect((await getTile(g, (await getCity(g, p.cityId)).tileId)).type).toBe(TileType.CASTLE);
    }));
});
