import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  BuildingType,
  experienceItemGain,
  gearStarCost,
  heroAttributeBuffEnd,
  heroAwardCost,
  heroBuffAmount,
  heroBuffDesc,
  HeroBuffId,
  heroGearBonus,
  heroGearStat,
  heroHireCost,
  heroItemGoldPrice,
  heroPointCap,
  HeroStatus,
  innHeroMaxLevel,
  innOffers,
  itemGoldPrice,
  ItemId,
  levelUpAll,
  lordGear,
  loyaltyAfterMedal,
  medalId,
  msg,
  ref,
  tavernRefreshCost,
  TechType,
  upgradeExpFor,
} from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { getHero, heroesOfCity } from '#/repo.ts';
import { heroBean } from '#/dto.ts';
import { heroes } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addHero, createTestPlayer, giveItems, reloadCity, reloadPlayer, setResearch, setResources, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { heroBuildings, patchHero, patchPlayer, lastHeroPush, pushedHeroes } from '#test/support/heroes.ts';

/** Hero `heroId` of `owner` is held captive in `captor`'s city, as combat leaves it. */
const capture = (g: TestGame, heroId: number, owner: TestPlayer, captor: TestPlayer, loyalty = 70) =>
  patchHero(g, heroId, {
    cityId: captor.cityId,
    status: HeroStatus.SEIZED,
    capturedByPlayerId: captor.id,
    loyalty,
    buffs: [{ id: HeroBuffId.HOME_CITY, desc: msg('buff.homeCity'), endTime: Number.MAX_SAFE_INTEGER, param: owner.cityId }],
  });

const gold = async (g: TestGame, p: TestPlayer) => (await reloadCity(g, p.cityId)).gold;

describe(heroes.listHeroes.name, () => {
  it("lists the city's heroes and its slots", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await heroes.listHeroes(g, p.id, p.cityId)).toEqual({ heroes: [], slots: 0 });
      await heroBuildings(g, p, 1, 2);
      const id = await addHero(g, p);
      const list = await heroes.listHeroes(g, p.id, p.cityId);
      expect(list).toEqual({ heroes: [heroBean(await getHero(g, id))], slots: 2 });
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(heroes.listHeroes(g, a.id, b.cityId), msg('common.invalidCastle'));
    }));
});

describe(heroes.reorderHeroes.name, () => {
  it('puts the listed heroes first, the others after them in their order', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await heroBuildings(g, p, 1, 5);
      const [h1, h2, h3, h4] = [await addHero(g, p), await addHero(g, p), await addHero(g, p), await addHero(g, p)];
      const list = await heroes.reorderHeroes(g, p.id, p.cityId, [h3, h1, h3, 999_999]);
      expect(list.heroes.map((h) => h.id)).toEqual([h3, h1, h2, h4]);
      expect((await heroesOfCity(g, p.cityId)).map((h) => [h.id, h.sortOrder])).toEqual([
        [h3, 1],
        [h1, 2],
        [h2, 3],
        [h4, 4],
      ]);
      // a hero hired later comes after the placed ones
      const h5 = await addHero(g, p);
      expect((await heroes.listHeroes(g, p.id, p.cityId)).heroes.map((h) => h.id)).toEqual([h3, h1, h2, h4, h5]);
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(heroes.reorderHeroes(g, a.id, b.cityId, []), msg('common.invalidCastle'));
    }));
});

describe(heroes.tavern.name, () => {
  it('offers one hero per Inn level, of up to the Inn level allows, and keeps them', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await heroBuildings(g, p, 3, 2);
      await addHero(g, p);
      const t = await heroes.tavern(g, p.id, p.cityId);
      expect(t.heros).toHaveLength(innOffers(3));
      expect(t.posCount).toBe(1);
      expect(t.refreshCost).toBe(tavernRefreshCost(3));
      for (const h of t.heros) expect(h.level).toBeLessThanOrEqual(innHeroMaxLevel(3));
      const stored = await heroesOfCity(g, p.cityId, { tavern: true });
      expect(stored.every((h) => h.playerId == null && h.inTavern)).toBe(true);
      expect((await heroes.tavern(g, p.id, p.cityId)).heros).toEqual(t.heros);
    }));

  it('tops the offers up when the Inn grows and drops the last ones when it shrinks', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await heroBuildings(g, p, 2);
      const first = (await heroes.tavern(g, p.id, p.cityId)).heros.map((h) => h.id);
      await heroBuildings(g, p, 4);
      const grown = (await heroes.tavern(g, p.id, p.cityId)).heros.map((h) => h.id);
      expect(grown).toHaveLength(4);
      expect(grown.slice(0, 2)).toEqual(first);
      await heroBuildings(g, p, 1);
      expect((await heroes.tavern(g, p.id, p.cityId)).heros.map((h) => h.id)).toEqual([first[0]]);
      expect(await heroesOfCity(g, p.cityId, { tavern: true })).toHaveLength(1);
    }));

  it('refuses a city without an Inn, or of another player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(heroes.tavern(g, a.id, a.cityId), msg('hero.needInn', { building: ref.building(BuildingType.INN) }));
      await expectRefused(heroes.tavern(g, a.id, b.cityId), msg('common.invalidCastle'));
    }));
});

describe(heroes.refreshTavern.name, () => {
  it('replaces every offer for gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await heroBuildings(g, p, 3);
      const before = (await heroes.tavern(g, p.id, p.cityId)).heros.map((h) => h.id);
      await setResources(g, p, { gold: 50_000 });
      const t = await heroes.refreshTavern(g, p.id, p.cityId);
      expect(t.heros).toHaveLength(3);
      expect(t.heros.some((h) => before.includes(h.id))).toBe(false);
      expect((await heroesOfCity(g, p.cityId, { tavern: true })).map((h) => h.id).sort()).toEqual(t.heros.map((h) => h.id).sort());
      expect(await gold(g, p)).toBe(50_000 - tavernRefreshCost(3));
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId });
    }));

  it('refuses without an Inn or the gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(heroes.refreshTavern(g, p.id, p.cityId), msg('hero.needInn', { building: ref.building(BuildingType.INN) }));
      await heroBuildings(g, p, 3);
      await setResources(g, p, { gold: tavernRefreshCost(3) - 1 });
      await expectRefused(heroes.refreshTavern(g, p.id, p.cityId), msg('common.notEnoughGold'));
    }));
});

describe(heroes.hire.name, () => {
  it('hires an offer for its level in gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await heroBuildings(g, p, 3);
      const [offer] = (await heroes.tavern(g, p.id, p.cityId)).heros;
      await setResources(g, p, { gold: 100_000 });
      const bean = await heroes.hire(g, p.id, p.cityId, offer.id);
      expect(bean).toMatchObject({ id: offer.id, status: HeroStatus.IDLE, cityId: p.cityId });
      expect(await getHero(g, offer.id)).toMatchObject({ playerId: p.id, inTavern: false, status: HeroStatus.IDLE });
      expect(await gold(g, p)).toBe(100_000 - heroHireCost(offer.level));
      expect((await heroes.listHeroes(g, p.id, p.cityId)).heroes.map((h) => h.id)).toEqual([offer.id]);
      expect((await heroes.tavern(g, p.id, p.cityId)).heros).toHaveLength(3); // the Inn offers a new hero
      expect(lastHeroPush(g)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId, hero: { id: offer.id }, updateType: 0 } });
    }));

  it('refuses without a free slot', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await heroBuildings(g, p, 2, 1);
      await addHero(g, p);
      const [offer] = (await heroes.tavern(g, p.id, p.cityId)).heros;
      await setResources(g, p, { gold: 100_000 });
      await expectRefused(heroes.hire(g, p.id, p.cityId, offer.id), msg('hero.noVacancy', { building: ref.building(BuildingType.FEASTING_HALL) }));
    }));

  it('refuses a hero that is not on offer in that city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await heroBuildings(g, a, 2);
      await heroBuildings(g, b, 2);
      await setResources(g, a, { gold: 100_000 });
      const [elsewhere] = (await heroes.tavern(g, b.id, b.cityId)).heros;
      const hired = await addHero(g, a);
      await expectRefused(heroes.hire(g, a.id, a.cityId, elsewhere.id), msg('common.heroNotFound'));
      await expectRefused(heroes.hire(g, a.id, a.cityId, hired), msg('common.heroNotFound'));
      await expectRefused(heroes.hire(g, a.id, a.cityId, 999_999_999), msg('common.heroNotFound'));
    }));

  it('refuses without the gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await heroBuildings(g, p, 2);
      const [offer] = (await heroes.tavern(g, p.id, p.cityId)).heros;
      await setResources(g, p, { gold: heroHireCost(offer.level) - 1 });
      await expectRefused(heroes.hire(g, p.id, p.cityId, offer.id), msg('common.notEnoughGold'));
      expect((await getHero(g, offer.id)).inTavern).toBe(true);
    }));
});

describe(heroes.fire.name, () => {
  it('dismisses an idle hero', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await heroes.fire(g, p.id, id);
      await expectRefused(getHero(g, id), msg('common.heroNotFound'));
      expect(lastHeroPush(g)).toMatchObject({ playerIds: [p.id], data: { hero: { id }, updateType: 1 } });
    }));

  it("refuses a hero that is busy, locked or not the player's", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const mayor = await addHero(g, a);
      await heroes.appointMayor(g, a.id, mayor);
      await expectRefused(heroes.fire(g, a.id, mayor), msg('hero.notIdle'));
      const locked = await addHero(g, a);
      const h = await heroes.setHeroLocked(g, a.id, locked, true);
      await expectRefused(heroes.fire(g, a.id, locked), msg('hero.locked', { name: h.name }));
      await expectRefused(heroes.fire(g, b.id, locked), msg('common.heroNotFound'));
    }));
});

describe(heroes.setHeroLocked.name, () => {
  it('locks and unlocks a hero', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      expect(await heroes.setHeroLocked(g, p.id, id, true)).toMatchObject({ id, locked: true });
      expect((await getHero(g, id)).locked).toBe(true);
      expect(lastHeroPush(g)).toMatchObject({ data: { hero: { id, locked: true }, updateType: 2 } });
      await heroes.setHeroLocked(g, p.id, id, false);
      expect((await getHero(g, id)).locked).toBe(false);
    }));

  it("refuses another player's hero and an Inn offer", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await heroBuildings(g, a, 1);
      const [offer] = (await heroes.tavern(g, a.id, a.cityId)).heros;
      await expectRefused(heroes.setHeroLocked(g, b.id, await addHero(g, a), true), msg('common.heroNotFound'));
      await expectRefused(heroes.setHeroLocked(g, a.id, offer.id, true), msg('common.heroNotFound'));
    }));
});

describe(heroes.appointMayor.name, () => {
  it('appoints a mayor, replacing the previous one', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const first = await addHero(g, p);
      const second = await addHero(g, p);
      await heroes.appointMayor(g, p.id, first);
      expect((await getHero(g, first)).status).toBe(HeroStatus.MAYOR);
      await heroes.appointMayor(g, p.id, second);
      expect((await getHero(g, first)).status).toBe(HeroStatus.IDLE);
      expect((await getHero(g, second)).status).toBe(HeroStatus.MAYOR);
      expect(
        pushedHeroes(g)
          .slice(-2)
          .map((h) => [h.id, h.status]),
      ).toEqual([
        [first, HeroStatus.IDLE],
        [second, HeroStatus.MAYOR],
      ]);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId });
      // appointing the mayor again changes nothing
      await heroes.appointMayor(g, p.id, second);
      expect((await getHero(g, second)).status).toBe(HeroStatus.MAYOR);
    }));

  it("refuses a busy hero and another player's hero", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addHero(g, a);
      await expectRefused(heroes.appointMayor(g, b.id, id), msg('common.heroNotFound'));
      await patchHero(g, id, { status: HeroStatus.ATTACK });
      await expectRefused(heroes.appointMayor(g, a.id, id), msg('hero.notIdle'));
    }));
});

describe(heroes.dischargeMayor.name, () => {
  it('makes the mayor idle again', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await heroes.appointMayor(g, p.id, id);
      await heroes.dischargeMayor(g, p.id, p.cityId);
      expect((await getHero(g, id)).status).toBe(HeroStatus.IDLE);
      expect(lastHeroPush(g)).toMatchObject({ data: { hero: { id, status: HeroStatus.IDLE }, updateType: 2 } });
    }));

  it("refuses a city without a mayor, or another player's", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await addHero(g, a);
      await expectRefused(heroes.dischargeMayor(g, a.id, a.cityId), msg('hero.noMayor'));
      await expectRefused(heroes.dischargeMayor(g, b.id, a.cityId), msg('common.invalidCastle'));
    }));
});

describe(heroes.resetPoints.name, () => {
  it('returns the assigned points, using Holy Water', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p, 4);
      await giveItems(g, p, { [ItemId.HOLY_WATER]: 2 });
      const before = await gold(g, p);
      const h = await getHero(g, id);
      const bean = await heroes.resetPoints(g, p.id, id);
      expect(bean).toMatchObject({ power: h.basePower, management: h.baseManagement, stratagem: h.baseStratagem, remainPoint: h.level });
      expect((await getHero(g, id)).remainPoint).toBe(h.level);
      expect((await reloadPlayer(g, p)).items[ItemId.HOLY_WATER]).toBe(1);
      expect(await gold(g, p)).toBe(before);
    }));

  it('buys the Holy Water with city gold when there is none', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p, 4);
      const price = itemGoldPrice(ItemId.HOLY_WATER)!;
      await setResources(g, p, { gold: price + 10 });
      await heroes.resetPoints(g, p.id, id);
      expect(await gold(g, p)).toBe(10);
      await expectRefused(heroes.resetPoints(g, p.id, id), msg('common.notEnoughGoldFor', { amount: Math.ceil(price) }));
    }));

  it('resets a mayor, settling the city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p, 4);
      await heroes.appointMayor(g, p.id, id);
      await giveItems(g, p, { [ItemId.HOLY_WATER]: 1 });
      await heroes.resetPoints(g, p.id, id);
      expect((await getHero(g, id)).management).toBe((await getHero(g, id)).baseManagement);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId });
    }));

  it("refuses a busy hero and another player's hero", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addHero(g, a);
      await giveItems(g, a, { [ItemId.HOLY_WATER]: 1 });
      await expectRefused(heroes.resetPoints(g, b.id, id), msg('common.heroNotFound'));
      await patchHero(g, id, { status: HeroStatus.ATTACK });
      await expectRefused(heroes.resetPoints(g, a.id, id), msg('hero.notIdle'));
    }));
});

describe(heroes.assignPoints.name, () => {
  it('sets the new totals; the rest stays unassigned', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p, 4);
      await giveItems(g, p, { [ItemId.HOLY_WATER]: 1 });
      const h = await getHero(g, id);
      await heroes.resetPoints(g, p.id, id); // h.level points to spend
      const v = { power: h.basePower + h.level, management: h.baseManagement, stratagem: h.baseStratagem };
      const bean = await heroes.assignPoints(g, p.id, id, v);
      expect(bean).toMatchObject({ ...v, remainPoint: 0 });
      expect(await getHero(g, id)).toMatchObject({ ...v, remainPoint: heroPointCap(h) - (v.power + v.management + v.stratagem) });
    }));

  it('refuses fractions, more than the cap and lowering an attribute', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addHero(g, a, 4);
      const h = await patchHero(g, id, { power: (await getHero(g, id)).basePower, remainPoint: 1 });
      const cur = { power: h.power, management: h.management, stratagem: h.stratagem };
      const cap = heroPointCap(h);
      const over = cap - (cur.power + cur.management + cur.stratagem) + 1;
      await expectRefused(heroes.assignPoints(g, a.id, id, { ...cur, power: cur.power + 0.5 }), msg('hero.invalidPoints'));
      await expectRefused(heroes.assignPoints(g, a.id, id, { ...cur, power: cur.power + over }), msg('hero.invalidPoints'));
      await expectRefused(heroes.assignPoints(g, a.id, id, { ...cur, management: cur.management - 1, power: cur.power + 1 }), msg('hero.invalidPoints'));
      await expectRefused(heroes.assignPoints(g, b.id, id, cur), msg('common.heroNotFound'));
    }));

  it("settles a mayor's city", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p, 4);
      const h = await patchHero(g, id, { remainPoint: 1, level: (await getHero(g, id)).level + 1 });
      await heroes.appointMayor(g, p.id, id);
      const pushes = g.pushes(PushCmd.RESOURCE_UPDATE).length;
      await heroes.assignPoints(g, p.id, id, { power: h.power, management: h.management + 1, stratagem: h.stratagem });
      expect((await getHero(g, id)).management).toBe(h.management + 1);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE)).toHaveLength(pushes + 1);
    }));
});

describe(heroes.levelUp.name, () => {
  it('takes every level the experience pays for', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      const h = await patchHero(g, id, { level: 3, upgradeExp: upgradeExpFor(3), experience: upgradeExpFor(3) + upgradeExpFor(4) + 5, remainPoint: 0 });
      const expected = { ...h };
      const levels = levelUpAll(expected);
      expect(levels).toBe(2);
      const bean = await heroes.levelUp(g, p.id, id);
      expect(bean).toMatchObject({ level: 5, remainPoint: 2, experience: 5, upgradeExp: upgradeExpFor(5) });
      expect(await getHero(g, id)).toMatchObject({ level: expected.level, remainPoint: expected.remainPoint, experience: expected.experience });
    }));

  it('refuses without the experience, at the maximum level, or for another player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addHero(g, a);
      await patchHero(g, id, { experience: 0 });
      await expectRefused(heroes.levelUp(g, a.id, id), msg('hero.notEnoughExperience'));
      await expectRefused(heroes.levelUp(g, b.id, id), msg('common.heroNotFound'));
      await patchHero(g, id, { level: BALANCE.heroMaxLevel, experience: 1e12 });
      await expectRefused(heroes.levelUp(g, a.id, id), msg('hero.maxLevel', { level: BALANCE.heroMaxLevel }));
    }));
});

describe(heroes.setHeroGearStat.name, () => {
  it("moves the gear's points onto the chosen attribute", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await patchHero(g, id, { level: 20 });
      await setResearch(g, p, TechType.HERO_ENHANCEMENT, 2);
      const bonus = heroGearBonus(20, lordGear(await reloadPlayer(g, p)));
      expect(bonus).toBeGreaterThan(0);
      for (const stat of ['power', 'management', 'stratagem'] as const) {
        const bean = await heroes.setHeroGearStat(g, p.id, id, stat);
        expect(bean.gearStat).toBe(stat);
        const h = await getHero(g, id);
        expect(h.gearStat).toBe(stat);
        expect({ power: h.powerAdded, management: h.managementAdded, stratagem: h.stratagemAdded }).toEqual({
          power: 0,
          management: 0,
          stratagem: 0,
          [stat]: bonus,
        });
      }
    }));

  it("refuses an unknown attribute and another player's hero", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addHero(g, a);
      await expectRefused(heroes.setHeroGearStat(g, a.id, id, 'luck' as 'power'), msg('hero.invalidAttribute'));
      await expectRefused(heroes.setHeroGearStat(g, b.id, id, 'power'), msg('common.heroNotFound'));
    }));
});

describe(heroes.gearState.name, () => {
  it("is the lord's Hero Enhancement level and stars", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await heroes.gearState(g, p.id)).toEqual({ level: 0, stars: {} });
      await setResearch(g, p, TechType.HERO_ENHANCEMENT, 4);
      await patchPlayer(g, p, (row) => {
        row.misc = { ...row.misc, gearStars: { weapon: 2, nonsense: 3 } };
      });
      expect(await heroes.gearState(g, p.id)).toEqual({ level: 4, stars: { weapon: 2 } });
    }));
});

describe(heroes.buyGearStar.name, () => {
  it('adds a star for medals and re-gears the heroes', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await patchHero(g, id, { level: 10 });
      await setResearch(g, p, TechType.HERO_ENHANCEMENT, 1);
      const cost = gearStarCost(1);
      await giveItems(g, p, { [cost.itemId]: cost.count + 1 });
      const before = await getHero(g, id);
      expect(await heroes.buyGearStar(g, p.id, 'weapon')).toEqual({ level: 1, stars: { weapon: 1 } });
      expect((await reloadPlayer(g, p)).items[cost.itemId]).toBe(1);
      const after = await getHero(g, id);
      const stat = heroGearStat(after);
      expect(after[`${stat}Added`]).toBe(before[`${stat}Added`] + BALANCE.heroGear.starPoints);
    }));

  it('charges several Nation Medals for the last star', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setResearch(g, p, TechType.HERO_ENHANCEMENT, BALANCE.heroGear.maxLevel);
      await patchPlayer(g, p, (row) => {
        row.misc = { ...row.misc, gearStars: { ring: BALANCE.heroGear.maxStars - 1 } };
      });
      const cost = gearStarCost(BALANCE.heroGear.maxStars);
      expect(cost).toEqual({ itemId: medalId(9), count: BALANCE.heroGear.lastStarMedals });
      await giveItems(g, p, { [cost.itemId]: cost.count - 1 });
      await expectRefused(heroes.buyGearStar(g, p.id, 'ring'), msg('hero.notEnoughMedals', { item: ref.item(cost.itemId), amount: cost.count }));
      await giveItems(g, p, { [cost.itemId]: 1 });
      expect((await heroes.buyGearStar(g, p.id, 'ring')).stars.ring).toBe(BALANCE.heroGear.maxStars);
      expect((await reloadPlayer(g, p)).items[cost.itemId]).toBeUndefined();
      await expectRefused(heroes.buyGearStar(g, p.id, 'ring'), msg('hero.gearMaxStars'));
    }));

  it('refuses an unknown piece, a star beyond Hero Enhancement and missing medals', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(heroes.buyGearStar(g, p.id, 'hat'), msg('hero.invalidGearPiece'));
      await expectRefused(heroes.buyGearStar(g, p.id, 'weapon'), msg('hero.gearStarLimit', { tech: ref.tech(TechType.HERO_ENHANCEMENT), limit: 0, level: 1 }));
      await setResearch(g, p, TechType.HERO_ENHANCEMENT, 1);
      await expectRefused(heroes.buyGearStar(g, p.id, 'weapon'), msg('hero.notEnoughMedals', { item: ref.item(medalId(1)), amount: 1 }));
    }));
});

describe(heroes.reward.name, () => {
  it('raises loyalty for gold, up to the maximum', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      const h = await patchHero(g, id, { loyalty: BALANCE.heroMaxLoyalty - 2 });
      await setResources(g, p, { gold: 10_000 });
      expect(await heroes.reward(g, p.id, id)).toMatchObject({ loyalty: BALANCE.heroMaxLoyalty });
      expect((await getHero(g, id)).loyalty).toBe(BALANCE.heroMaxLoyalty);
      expect(await gold(g, p)).toBe(10_000 - heroAwardCost(h.level));
      await expectRefused(heroes.reward(g, p.id, id), msg('hero.fullyLoyal'));
    }));

  it('adds 5 loyalty', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await patchHero(g, id, { loyalty: 50 });
      await setResources(g, p, { gold: 100_000 });
      expect((await heroes.reward(g, p.id, id)).loyalty).toBe(55);
    }));

  it("refuses without the gold, or another player's hero", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addHero(g, a);
      const h = await patchHero(g, id, { loyalty: 50 });
      await expectRefused(heroes.reward(g, b.id, id), msg('common.heroNotFound'));
      await setResources(g, a, { gold: heroAwardCost(h.level) - 1 });
      await expectRefused(heroes.reward(g, a.id, id), msg('common.notEnoughGold'));
    }));
});

describe(heroes.useHeroItem.name, () => {
  it('an experience book adds its experience', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      const h = await patchHero(g, id, { experience: 0 });
      await giveItems(g, p, { [ItemId.ANABASIS]: 1 });
      const before = await gold(g, p);
      const bean = await heroes.useHeroItem(g, p.id, id, ItemId.ANABASIS);
      expect(bean.experience).toBe(experienceItemGain(ItemId.ANABASIS, h.upgradeExp));
      expect((await reloadPlayer(g, p)).items[ItemId.ANABASIS]).toBeUndefined();
      expect(await gold(g, p)).toBe(before);
      expect(lastHeroPush(g)).toMatchObject({ data: { hero: { id }, updateType: 2 } });
    }));

  it("buys a book with the hero's city gold when there is none, or when asked to", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      const h = await patchHero(g, id, { experience: 0 });
      const price = heroItemGoldPrice(ItemId.EPITOME_OF_MILITARY_SCIENCE, h.upgradeExp)!;
      const gain = experienceItemGain(ItemId.EPITOME_OF_MILITARY_SCIENCE, h.upgradeExp);
      await setResources(g, p, { gold: 2 * price });
      await heroes.useHeroItem(g, p.id, id, ItemId.EPITOME_OF_MILITARY_SCIENCE);
      expect(await gold(g, p)).toBe(price);
      await giveItems(g, p, { [ItemId.EPITOME_OF_MILITARY_SCIENCE]: 1 });
      await heroes.useHeroItem(g, p.id, id, ItemId.EPITOME_OF_MILITARY_SCIENCE, 'gold');
      expect(await gold(g, p)).toBe(0);
      expect((await reloadPlayer(g, p)).items[ItemId.EPITOME_OF_MILITARY_SCIENCE]).toBe(1);
      expect((await getHero(g, id)).experience).toBe(2 * gain);
      await expectRefused(heroes.useHeroItem(g, p.id, id, ItemId.EPITOME_OF_MILITARY_SCIENCE, 'gold'), msg('common.notEnoughGoldFor', { amount: price }));
    }));

  it('refuses a book for a hero at the maximum level', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await patchHero(g, id, { level: BALANCE.heroMaxLevel, upgradeExp: upgradeExpFor(BALANCE.heroMaxLevel), experience: 0 });
      await giveItems(g, p, { [ItemId.ON_WAR]: 1 });
      await expectRefused(heroes.useHeroItem(g, p.id, id, ItemId.ON_WAR), msg('hero.maxLevelNoExperience', { level: BALANCE.heroMaxLevel }));
    }));

  it('a medal adds its loyalty and cannot be bought', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await patchHero(g, id, { loyalty: 60 });
      const medal = medalId(3);
      await expectRefused(heroes.useHeroItem(g, p.id, id, medal), msg('common.insufficientItems'));
      await expectRefused(heroes.useHeroItem(g, p.id, id, medal, 'gold'), msg('hero.itemNotForGold'));
      await giveItems(g, p, { [medal]: 2, [medalId(9)]: 1 });
      expect((await heroes.useHeroItem(g, p.id, id, medal)).loyalty).toBe(loyaltyAfterMedal(60, medal));
      expect((await heroes.useHeroItem(g, p.id, id, medalId(9))).loyalty).toBe(BALANCE.heroMaxLoyalty);
      expect((await reloadPlayer(g, p)).items[medal]).toBe(1);
    }));

  it('an attribute item boosts the attribute for a day, stacking, until it expires', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await giveItems(g, p, { [ItemId.EXCALIBUR]: 2 });
      const h = await getHero(g, id);
      const amount = heroBuffAmount(h.power + h.powerAdded);
      const start = g.now;
      const bean = await heroes.useHeroItem(g, p.id, id, ItemId.EXCALIBUR);
      const end = heroAttributeBuffEnd(start);
      expect(bean.powerBuffAdded).toBe(amount);
      expect(bean.buffs).toEqual([{ id: HeroBuffId.POWER, desc: heroBuffDesc('power'), endTime: end, param: amount }]);
      expect(g.events('hero.buff')).toMatchObject([{ dueAt: end, playerId: p.id, refKey: `herobuff:${id}:power`, payload: { heroId: id, attr: 'power' } }]);

      g.advance(60_000);
      await heroes.useHeroItem(g, p.id, id, ItemId.EXCALIBUR);
      const stacked = heroAttributeBuffEnd(g.now, end);
      expect((await getHero(g, id)).buffs).toMatchObject([{ id: HeroBuffId.POWER, endTime: stacked }]);
      expect(g.events('hero.buff')).toMatchObject([{ dueAt: stacked }]);

      await g.runDue(end);
      expect((await getHero(g, id)).powerBuffAdded).toBe(amount);
      await g.runDue(stacked);
      expect(await getHero(g, id)).toMatchObject({ buffs: [], powerBuffAdded: 0 });
      expect(lastHeroPush(g)).toMatchObject({ data: { hero: { id, powerBuffAdded: 0 } } });
    }));

  it("a management boost settles the mayor's city, and can be bought", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await heroes.appointMayor(g, p.id, id);
      const price = heroItemGoldPrice(ItemId.WEALTH_OF_NATIONS, 0)!;
      await setResources(g, p, { gold: price });
      const pushes = g.pushes(PushCmd.RESOURCE_UPDATE).length;
      const bean = await heroes.useHeroItem(g, p.id, id, ItemId.WEALTH_OF_NATIONS);
      expect(bean.managementBuffAdded).toBeGreaterThan(0);
      expect(await gold(g, p)).toBe(0);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE)).toHaveLength(pushes + 1);
      await g.runDue(g.events('hero.buff')[0].dueAt);
      expect((await getHero(g, id)).managementBuffAdded).toBe(0);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE)).toHaveLength(pushes + 2);
    }));

  it("refuses an item that does nothing for a hero, and another player's hero", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addHero(g, a);
      await giveItems(g, a, { [ItemId.HOLY_WATER]: 1 });
      await expectRefused(heroes.useHeroItem(g, a.id, id, ItemId.HOLY_WATER), msg('hero.invalidItem'));
      await expectRefused(heroes.useHeroItem(g, a.id, id, 'no.such.item'), msg('hero.invalidItem'));
      await expectRefused(heroes.useHeroItem(g, b.id, id, ItemId.ANABASIS), msg('common.heroNotFound'));
    }));
});

describe(heroes.renameHero.name, () => {
  it('renames a hero, tidying the spaces', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      expect((await heroes.renameHero(g, p.id, id, '  Sir   Robin ')).name).toBe('Sir Robin');
      expect((await getHero(g, id)).name).toBe('Sir Robin');
    }));

  it("refuses bad names and another player's hero", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addHero(g, a);
      const what = msg('common.heroName');
      await expectRefused(heroes.renameHero(g, a.id, id, '  '), msg('common.nameLength', { what, min: 1, max: 20 }));
      await expectRefused(heroes.renameHero(g, a.id, id, 'x'.repeat(21)), msg('common.nameLength', { what, min: 1, max: 20 }));
      await expectRefused(heroes.renameHero(g, a.id, id, 'Bob<b>'), msg('common.nameInvalid', { what }));
      await expectRefused(heroes.renameHero(g, a.id, id, 'Shithead'), msg('common.nameNotAllowed'));
      await expectRefused(heroes.renameHero(g, b.id, id, 'Robin'), msg('common.heroNotFound'));
    }));
});

describe(heroes.releaseCaptive.name, () => {
  it('sends the hero home idle with loyalty 70', () =>
    game(async (g) => {
      const owner = await createTestPlayer(g);
      const captor = await createTestPlayer(g);
      const id = await addHero(g, owner);
      await capture(g, id, owner, captor, 10);
      await heroes.releaseCaptive(g, captor.id, id);
      expect(await getHero(g, id)).toMatchObject({
        cityId: owner.cityId,
        playerId: owner.id,
        status: HeroStatus.IDLE,
        capturedByPlayerId: null,
        loyalty: 70,
        buffs: [],
      });
      const [toCaptor, toOwner] = g.pushes(PushCmd.HERO_UPDATE).slice(-2);
      expect(toCaptor).toMatchObject({ playerIds: [captor.id], data: { castleId: captor.cityId, hero: { id }, updateType: 1 } });
      expect(toOwner).toMatchObject({ playerIds: [owner.id], data: { castleId: owner.cityId, hero: { id }, updateType: 0 } });
    }));

  it('a hero with no home city of its lord left is dismissed', () =>
    game(async (g) => {
      const owner = await createTestPlayer(g);
      const captor = await createTestPlayer(g);
      const id = await addHero(g, owner);
      await capture(g, id, owner, captor);
      await patchHero(g, id, { buffs: [{ id: HeroBuffId.HOME_CITY, desc: msg('buff.homeCity'), endTime: Number.MAX_SAFE_INTEGER, param: captor.cityId }] });
      await heroes.releaseCaptive(g, captor.id, id);
      await expectRefused(getHero(g, id), msg('common.heroNotFound'));
      expect(lastHeroPush(g)).toMatchObject({ playerIds: [captor.id], data: { hero: { id }, updateType: 1 } });
    }));

  it('refuses a hero that is not your prisoner', () =>
    game(async (g) => {
      const owner = await createTestPlayer(g);
      const captor = await createTestPlayer(g);
      const id = await addHero(g, owner);
      await expectRefused(heroes.releaseCaptive(g, captor.id, id), msg('hero.notPrisoner'));
      await capture(g, id, owner, captor);
      await expectRefused(heroes.releaseCaptive(g, owner.id, id), msg('hero.notPrisoner'));
    }));
});

describe(heroes.persuadeCaptive.name, () => {
  it('a captive with no loyalty left joins the captor', () =>
    game(async (g) => {
      const owner = await createTestPlayer(g);
      const captor = await createTestPlayer(g);
      await heroBuildings(g, captor, 1, 1);
      const id = await addHero(g, owner);
      await capture(g, id, owner, captor, 0);
      const bean = await heroes.persuadeCaptive(g, captor.id, id);
      expect(bean).toMatchObject({ id, status: HeroStatus.IDLE, loyalty: 50, seized: false, buffs: [] });
      expect(await getHero(g, id)).toMatchObject({ playerId: captor.id, cityId: captor.cityId, capturedByPlayerId: null });
      const [toOwner, toCaptor] = g.pushes(PushCmd.HERO_UPDATE).slice(-2);
      expect(toOwner).toMatchObject({ playerIds: [owner.id], data: { hero: { id }, updateType: 1 } });
      expect(toCaptor).toMatchObject({ playerIds: [captor.id], data: { hero: { id }, updateType: 0 } });
    }));

  it('refuses a loyal captive, a full Feasting Hall and a hero that is not your prisoner', () =>
    game(async (g) => {
      const owner = await createTestPlayer(g);
      const captor = await createTestPlayer(g);
      await heroBuildings(g, captor, 1, 1);
      const id = await addHero(g, owner);
      await expectRefused(heroes.persuadeCaptive(g, captor.id, id), msg('hero.notPrisoner'));
      await capture(g, id, owner, captor, 1);
      await expectRefused(heroes.persuadeCaptive(g, captor.id, id), msg('hero.stillLoyal'));
      await patchHero(g, id, { loyalty: 0 });
      await addHero(g, captor);
      await expectRefused(heroes.persuadeCaptive(g, captor.id, id), msg('hero.noVacancy', { building: ref.building(BuildingType.FEASTING_HALL) }));
    }));
});
