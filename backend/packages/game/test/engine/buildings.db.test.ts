import { describe, expect, it } from 'vitest';
import { BALANCE, BuildingStatus, BuildingType, buildingHeroExp, buildingMaxLevel, prestigeOf, PrestigeAction } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { buildings, heroes } from '#/index.ts';
import { getHero, heroesOfCity } from '#/repo.ts';
import { createTestPlayer, reloadPlayer, setBuildings, setResources, setTownHall } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { completeBuilding } from '#/engine/buildings.ts';
import { buildingAt, appointMayor } from '#test/support/buildings.ts';

const { COTTAGE, INN, TOWN_HALL, WALLS } = BuildingType;

describe(completeBuilding.name, () => {
  it('raises the level, awards prestige and tells the player', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const prestige = (await reloadPlayer(g, p)).prestige;
      const built = await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      await g.runDue(built.endTime);
      const done = { positionId: 0, typeId: COTTAGE, level: 1, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 };
      expect(await buildingAt(g, p, 0)).toEqual(done);
      expect((await reloadPlayer(g, p)).prestige).toBe(prestige + prestigeOf(PrestigeAction.BUILDING, COTTAGE, 1, 1));
      expect(g.pushes(PushCmd.BUILD_COMPLETE).at(-1)?.data).toEqual({ castleId: p.cityId, buildingBean: done });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)?.playerIds).toEqual([p.id]);
      expect(g.events()).toEqual([]);
    }));

  it('gives the mayor experience', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const mayor = await appointMayor(g, p);
      const exp = (await getHero(g, mayor)).experience;
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      await g.runDue(built.endTime);
      expect((await getHero(g, mayor)).experience).toBeCloseTo(exp + buildingHeroExp(TOWN_HALL, 2, 2), 6);
      expect(g.pushes(PushCmd.HERO_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, hero: { id: mayor }, updateType: 2 });
    }));

  it('a Town Hall reaching the beginner limit ends beginner protection', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect((await reloadPlayer(g, p)).beginner).toBe(true);
      await setTownHall(g, p, BALANCE.beginnerTownHallLevel - 1);
      await setBuildings(g, p, [[-2, WALLS, buildingMaxLevel(WALLS)]]);
      await setResources(g, p, { food: 1e7, wood: 1e7, stone: 1e7, iron: 1e7 });
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      await g.runDue(built.endTime);
      expect((await reloadPlayer(g, p)).beginner).toBe(false);
    }));

  it('a finished Inn clears its offers', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [
        [0, INN, 1],
        [1, COTTAGE, 2],
      ]);
      await heroes.tavern(g, p.id, p.cityId);
      expect((await heroesOfCity(g, p.cityId, { tavern: true })).length).toBeGreaterThan(0);
      const built = await buildings.upgrade(g, p.id, p.cityId, 0);
      await g.runDue(built.endTime);
      expect(await heroesOfCity(g, p.cityId, { tavern: true })).toEqual([]);
    }));

  it('a job that is not due yet is left alone and rescheduled', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const built = await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      g.unschedule(`building:${p.cityId}:0`);
      await completeBuilding(g, p.cityId, 0);
      expect(await buildingAt(g, p, 0)).toMatchObject({ level: 0, status: BuildingStatus.BUILDING });
      expect(g.events('building')).toMatchObject([{ dueAt: built.endTime, payload: { positionId: 0 } }]);
    }));

  it('does nothing for an idle building or a missing city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await completeBuilding(g, p.cityId, -1);
      await completeBuilding(g, p.cityId, 0);
      await completeBuilding(g, 2_000_000_000, 0);
      expect(await buildingAt(g, p, -1)).toMatchObject({ level: 1, status: BuildingStatus.IDLE });
      expect(g.pushes(PushCmd.BUILD_COMPLETE)).toEqual([]);
    }));
});
