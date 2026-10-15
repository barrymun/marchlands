import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { BALANCE, HOUR, PrestigeAction, prestigeOf, researchHeroExp, TechType } from '@marchlands/core';

import { completeResearch, settleAllCities } from '#/engine/research.ts';
import { heroes, research } from '#/index.ts';
import { getHero } from '#/repo.ts';
import { addCity, addHero, createTestPlayer, reloadCity, reloadPlayer, setResearch, setTownHall } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { res, researchOf, stock, withAcademy } from '#test/support/research.ts';

const { AGRICULTURE, LUMBERING, HERO_ENHANCEMENT } = TechType;

describe(settleAllCities.name, () => {
  it("settles and saves every one of the player's cities", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const second = await addCity(g, p);
      g.advance(HOUR);
      const expected = [await stock(g, p), await stock(g, p, second)];
      const bundles = await settleAllCities(g, await reloadPlayer(g, p));
      expect(bundles.map((b) => b.city.id).sort((x, y) => x - y)).toEqual([p.cityId, second].sort((x, y) => x - y));
      for (const [i, id] of [p.cityId, second].entries()) {
        const city = await reloadCity(g, id);
        expect(city.resourcesAt).toBe(g.now);
        expect(res(city)).toEqual(expected[i]);
        expect(city.food).toBeGreaterThan(BALANCE.startingResources);
      }
    }));
});

describe(completeResearch.name, () => {
  it('raises the level, awards prestige and tells the player', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await setTownHall(g, p, 2);
      const prestige = (await reloadPlayer(g, p)).prestige;
      const out = await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      expect(await g.runDue(out.endTime)).toBe(1);
      const after = await reloadPlayer(g, p);
      expect(after.research[AGRICULTURE]).toEqual({ level: 1 });
      expect(after.prestige).toBe(prestige + prestigeOf(PrestigeAction.RESEARCH, AGRICULTURE, 1, 2));
      expect(g.pushes(PushCmd.RESEARCH_COMPLETE_UPDATE).at(-1)).toMatchObject({
        playerIds: [p.id],
        data: { castleId: p.cityId, typeId: AGRICULTURE, level: 1 },
      });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)?.playerIds).toEqual([p.id]);
      expect((await reloadCity(g, p.cityId)).resourcesAt).toBe(out.endTime);
    }));

  it('settles every city first and resources them all', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const second = await addCity(g, p);
      await withAcademy(g, p, second);
      const out = await research.startResearch(g, p.id, second, AGRICULTURE);
      const pushesBefore = g.pushes(PushCmd.RESOURCE_UPDATE).length;
      await g.runDue(out.endTime);
      for (const id of [p.cityId, second]) expect((await reloadCity(g, id)).resourcesAt).toBe(out.endTime);
      const castleIds = g
        .pushes(PushCmd.RESOURCE_UPDATE)
        .slice(pushesBefore)
        .map((x) => (x.data as { castleId: number }).castleId);
      expect(castleIds).toEqual(expect.arrayContaining([p.cityId, second]));
      expect(g.pushes(PushCmd.RESEARCH_COMPLETE_UPDATE).at(-1)?.data).toMatchObject({ castleId: second });
    }));

  it("gives the researching city's mayor experience", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const mayor = await addHero(g, p, 5);
      await heroes.appointMayor(g, p.id, mayor);
      const exp = (await getHero(g, mayor)).experience;
      const out = await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      await g.runDue(out.endTime);
      expect((await getHero(g, mayor)).experience).toBeCloseTo(exp + researchHeroExp(AGRICULTURE, 1, 1), 6);
      expect(g.pushes(PushCmd.HERO_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, hero: { id: mayor }, updateType: 2 });
    }));

  it("Hero Enhancement raises the heroes' gear", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const hero = await addHero(g, p, 5);
      const before = await getHero(g, hero);
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      await g.runDue(out.endTime);
      const after = await getHero(g, hero);
      expect(after).not.toEqual(before);
      expect(g.pushes(PushCmd.HERO_UPDATE).some((x) => (x.data as { hero: { id: number } }).hero.id === hero)).toBe(true);
    }));

  it('a research that is not due yet is left alone and rescheduled', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      g.unschedule(`research:${p.id}:${AGRICULTURE}`);
      await completeResearch(g, p.id, AGRICULTURE);
      expect(await researchOf(g, p, AGRICULTURE)).toMatchObject({ level: 0, endTime: out.endTime });
      expect(g.events('research')).toMatchObject([{ dueAt: out.endTime, cityId: p.cityId, payload: { techId: AGRICULTURE } }]);
    }));

  it('does nothing for a tech not being researched', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setResearch(g, p, AGRICULTURE, 2);
      await completeResearch(g, p.id, AGRICULTURE);
      await completeResearch(g, p.id, LUMBERING);
      expect((await reloadPlayer(g, p)).research).toEqual({ [AGRICULTURE]: { level: 2 } });
      expect(g.pushes(PushCmd.RESEARCH_COMPLETE_UPDATE)).toEqual([]);
    }));
});
