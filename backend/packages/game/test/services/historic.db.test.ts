// The daily draft of a held historic city, by hand (docs/features/historical-cities.md).

import { describe, expect, it } from 'vitest';

import { BALANCE, DAY, historicDay, historicGarrison, msg, nextAutoDraftAt, npcFaction, npcTemplate, ReportBodyKind, TileType, tileXY } from '@marchlands/core';

import { historic, world } from '#/index.ts';
import { getCity, getTile, saveTile } from '#/repo.ts';
import { reportsOf, valleyNear } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { barbariansNear, makeSeat } from '#test/support/historic.ts';

describe(historic.draftNow.name, () => {
  it('takes a fifth of every troop type of a barbarian city in the seat’s area into the seat', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await makeSeat(g, p);
      const [target] = await barbariansNear(g, p, true);
      const full = npcTemplate(target!.level).troops;
      const taken = Object.fromEntries(Object.entries(full).map(([k, n]) => [k, Math.floor(n * BALANCE.historic.draftShare)]));
      expect(Object.keys(taken).length).toBeGreaterThan(1);

      expect(await historic.draftNow(g, p.id, p.cityId, target!.id)).toEqual({ troops: taken });
      const seat = await getCity(g, p.cityId);
      const left = (await getTile(g, target!.id)).troops!;
      for (const [k, n] of Object.entries(taken)) {
        expect(seat.troops[k as 'militia']).toBe(n);
        expect(left[k as 'militia']).toBe(full[k as 'militia']! - n);
      }
      expect(seat.draftsUsed).toBe(1);
      const r = (await reportsOf(g, p.id)).at(-1)!;
      expect(r.title).toEqual(msg('report.title.draft'));
      expect(r.body).toMatchObject({ kind: ReportBodyKind.DRAFT, draft: { cityId: p.cityId, level: target!.level, troops: taken, auto: false } });
    }));

  it('without a barbarian city given, drafts from the one it would pick by itself: the highest level in its area', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await makeSeat(g, p);
      const inside = await barbariansNear(g, p, true);
      const top = Math.max(...inside.map((t) => t.level));
      const { troops } = await historic.draftNow(g, p.id, p.cityId);
      expect(Object.values(troops).every((n) => n > 0)).toBe(true);
      expect((await getCity(g, p.cityId)).draftsUsed).toBe(1);
      const r = (await reportsOf(g, p.id)).at(-1)!;
      expect(r.body).toMatchObject({ kind: ReportBodyKind.DRAFT, draft: { cityId: p.cityId, level: top, troops, auto: false } });
    }));

  it('refuses to pick one when no barbarian city nobody holds is left in its area', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await makeSeat(g, p);
      for (const t of await barbariansNear(g, p, true)) await saveTile(g, { ...t, ownerCityId: p.cityId });
      await expectRefused(historic.draftNow(g, p.id, p.cityId), msg('city.noDraftTarget'));
    }));

  it('costs standing with the drafted city’s faction', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await makeSeat(g, p);
      const target = (await barbariansNear(g, p, true)).find((t) => npcFaction(t.id, t.level))!;
      await historic.draftNow(g, p.id, p.cityId, target.id);
      const r = (await reportsOf(g, p.id)).at(-1)!;
      const change = -BALANCE.reputation.seat.draft;
      expect(r.body).toMatchObject({ draft: { standing: { faction: npcFaction(target.id, target.level)!.id, change, now: change } } });
    }));

  it('refuses a city that isn’t a seat, a barbarian city outside its area, any other tile, and a fifth draft in a day', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const inside = await barbariansNear(g, p, true);
      const [first] = inside;
      await expectRefused(historic.draftNow(g, p.id, p.cityId, first!.id), msg('city.notHistoric'));
      await makeSeat(g, p);
      const [outside] = await barbariansNear(g, p, false);
      await expectRefused(historic.draftNow(g, p.id, p.cityId, outside!.id), msg('city.draftOutOfArea'));
      const valley = await valleyNear(g, p.cityId);
      await expectRefused(historic.draftNow(g, p.id, p.cityId, valley.id), msg('city.draftNotTarget'));
      const targets = inside.slice(0, BALANCE.historic.draftsPerDay + 1);
      expect(targets).toHaveLength(BALANCE.historic.draftsPerDay + 1);
      for (const t of targets.slice(0, -1)) await historic.draftNow(g, p.id, p.cityId, t.id);
      await expectRefused(historic.draftNow(g, p.id, p.cityId, targets.at(-1)!.id), msg('city.noDraftsLeft', { count: BALANCE.historic.draftsPerDay }));
      // a new day, new drafts
      g.advance(86_400_000);
      expect((await historic.draftNow(g, p.id, p.cityId, first!.id)).troops).toBeDefined();
    }));

  it('drafts from each city once a day, and Draft now picks another', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await makeSeat(g, p);
      const [target] = await barbariansNear(g, p, true);
      await historic.draftNow(g, p.id, p.cityId, target!.id);
      expect((await getCity(g, p.cityId)).draftedTiles).toEqual([target!.id]);
      await expectRefused(historic.draftNow(g, p.id, p.cityId, target!.id), msg('city.draftedToday'));
      // the seat's own pick skips the cities it has drafted today
      for (let i = 1; i < BALANCE.historic.draftsPerDay; i++) await historic.draftNow(g, p.id, p.cityId);
      const drafted = (await getCity(g, p.cityId)).draftedTiles;
      expect(new Set(drafted).size).toBe(BALANCE.historic.draftsPerDay);
      // the next day it may draft from them again
      g.advance(86_400_000);
      await historic.draftNow(g, p.id, p.cityId, target!.id);
      expect((await getCity(g, p.cityId)).draftedTiles).toEqual([target!.id]);
    }));

  it('drafts from a lower historic city nobody holds, never from one of its own level', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      // the level 12 historic city nearest the player stands within 18 tiles: in a level 14's area, not a level 12's
      const { x, y } = tileXY((await getCity(g, p.cityId)).tileId);
      const [twelve] = (await world.searchTiles(g, x, y, 18, TileType.HISTORIC)).filter((t) => t.level === 12);
      await makeSeat(g, p, { level: 12 });
      await expectRefused(historic.draftNow(g, p.id, p.cityId, twelve!.id), msg('city.draftNotTarget'));
      await makeSeat(g, p, { level: 14 });
      const { troops } = await historic.draftNow(g, p.id, p.cityId, twelve!.id);
      // a fifth of each of its five troop types: warriors, the day's foot, archers, the day's horse and siege engine
      const full = historicGarrison(12, historicDay(twelve!.id, Math.floor(g.now / DAY))).troops;
      const taken = Object.fromEntries(Object.entries(full).map(([k, n]) => [k, Math.floor(n * BALANCE.historic.draftShare)]));
      expect(Object.keys(taken)).toHaveLength(5);
      expect(troops).toEqual(taken);
      const left = (await getTile(g, twelve!.id)).troops!;
      for (const [k, n] of Object.entries(taken)) expect(left[k as 'militia']).toBe(full[k as 'militia']! - n);
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
      // switched on, it drafts from the next part of the day; switching on again changes nothing
      expect(await getCity(g, p.cityId)).toMatchObject({ draftAuto: true, draftNextAt: nextAutoDraftAt(g.now) });
      g.advance(7 * 3_600_000);
      await historic.setDraftAuto(g, p.id, p.cityId, true);
      expect((await getCity(g, p.cityId)).draftNextAt).toBe(nextAutoDraftAt(g.now - 7 * 3_600_000));
      expect((await getTile(g, (await getCity(g, p.cityId)).tileId)).type).toBe(TileType.CASTLE);
    }));
});
