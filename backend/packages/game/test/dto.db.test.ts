import { describe, expect, it } from 'vitest';
import { BALANCE, BuffId, BuildingType, heroManagement, HOUR, mayorProductionBonus, msg, TechType, TileType, valleyBonus } from '@marchlands/core';
import { CityBean } from '@marchlands/contracts';
import { cityBean } from '#/dto.ts';
import { getTile, savePlayer } from '#/repo.ts';
import { heroes } from '#/index.ts';
import { setBuff } from '#/helpers.ts';
import { viewOwnCity } from '#/city.ts';
import { holdValley } from '#test/support/city-data.ts';
import { addHero, cityBundle, createTestPlayer, reloadPlayer, setBuildings, setCityStats, setResearch, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** food an archer eats per hour */
const ARCHER_UPKEEP = 9;
/** a bean's whole amount after an hour is within this of the amount before plus the rate it showed */
const within = (after: number, before: number, rate: number) => expect(Math.abs(after - before - rate)).toBeLessThanOrEqual(1);

/** A city with every source of food: a farm, Agriculture (and an Academy), a mayor, a lake, the food item, and archers to feed. */
async function producingCity(g: TestGame, p: TestPlayer) {
  await setBuildings(g, p, [
    [1001, BuildingType.FARM, 2],
    [1, BuildingType.ACADEMY, 1],
  ]);
  await setResearch(g, p, TechType.AGRICULTURE, 1);
  const mayorId = await addHero(g, p);
  await heroes.appointMayor(g, p.id, mayorId);
  const lake = await holdValley(g, p, TileType.LAKE);
  const row = await reloadPlayer(g, p);
  setBuff(g, row, BuffId.FOOD_PRODUCTION, msg('buff.homeCity'), g.now + 24 * HOUR);
  await savePlayer(g, row);
  await setCityStats(g, p, { troops: { archer: 10 } });
  return { mayorId, lake };
}

describe(cityBean.name, () => {
  it("a real city's bean matches the contract", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await producingCity(g, p);
      const bean = cityBean(await cityBundle(g, p), g.now);
      expect(CityBean.parse(bean)).toEqual(bean);
    }));

  it('shows each production bonus at the share the game gives it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const { mayorId, lake } = await producingCity(g, p);
      const b = await cityBundle(g, p);
      const bean = cityBean(b, g.now);
      const mayor = b.heroes.find((h) => h.id === mayorId)!;
      const tile = await getTile(g, lake);
      expect(bean.resource.food.breakdown).toMatchObject({
        techBonus: BALANCE.resourceTechBonusPerLevel,
        mayorBonus: mayorProductionBonus(heroManagement(mayor)),
        valleyBonus: valleyBonus(TileType.LAKE, tile.level),
        buffBonus: BALANCE.resourceBuffBonus,
        upkeep: -10 * ARCHER_UPKEEP,
      });
      expect(bean.resource.wood.breakdown).toMatchObject({
        techBonus: 0,
        valleyBonus: 0,
        buffBonus: 0,
        mayorBonus: mayorProductionBonus(heroManagement(mayor)),
      });
      expect(bean.heros.map((h) => h.id)).toContain(mayorId);
      expect(bean.fields.map((v) => v.id)).toEqual([lake]);
    }));

  it('the rates it shows are what the city makes in an hour', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await producingCity(g, p);
      const before = cityBean(await cityBundle(g, p), g.now).resource;
      g.advance(HOUR);
      const after = cityBean(await viewOwnCity(g, p.id, p.cityId), g.now).resource;
      for (const r of ['food', 'wood', 'stone', 'iron'] as const) within(after[r].amount, before[r].amount, before[r].increaseRate);
      within(after.gold, before.gold, before.goldRate);
      expect(after.updatedAt).toBe(g.now);
    }));
});
