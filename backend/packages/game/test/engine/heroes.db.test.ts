import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { createRandomHero, HeroBuffId, heroGearBonus, heroGearStat, ItemId, lordGear, seededRng, TechType } from '@marchlands/core';

import { heroBean } from '#/dto.ts';
import { clearTavern, expireHeroBuff, heroSlots, heroValues, pushHero, resyncHeroGear } from '#/engine/heroes.ts';
import { heroes } from '#/index.ts';
import { getHero, heroesOfCity } from '#/repo.ts';
import { addHero, cityBundle, createTestPlayer, giveItems, reloadPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { heroBuildings, lastHeroPush, patchHero, patchPlayer, pushedHeroes } from '#test/support/heroes.ts';

describe(heroValues.name, () => {
  it('takes the stored columns of a generated hero', () => {
    const generated = createRandomHero(3, seededRng('values'), { state: 0 });
    const v = heroValues(generated);
    expect(v).toEqual({
      name: generated.name,
      sex: generated.sex,
      logoUrl: generated.logoUrl,
      level: generated.level,
      experience: generated.experience,
      upgradeExp: generated.upgradeExp,
      loyalty: generated.loyalty,
      basePower: generated.basePower,
      baseManagement: generated.baseManagement,
      baseStratagem: generated.baseStratagem,
      power: generated.power,
      management: generated.management,
      stratagem: generated.stratagem,
      remainPoint: generated.remainPoint,
    });
  });
});

describe(heroSlots.name, () => {
  it('is the Feasting Hall level', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(heroSlots(await cityBundle(g, p))).toBe(0);
      await heroBuildings(g, p, 1, 4);
      expect(heroSlots(await cityBundle(g, p))).toBe(4);
    }));
});

describe(pushHero.name, () => {
  it('pushes the hero to its player with the update type', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const h = await getHero(g, await addHero(g, p));
      pushHero(g, p.id, h, 2);
      expect(lastHeroPush(g)).toEqual({ playerIds: [p.id], cmd: PushCmd.HERO_UPDATE, data: { castleId: p.cityId, hero: heroBean(h), updateType: 2 } });
    }));
});

describe(clearTavern.name, () => {
  it("removes the Inn's offers and keeps the hired heroes", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await heroBuildings(g, p, 3);
      const hired = await addHero(g, p);
      await heroes.tavern(g, p.id, p.cityId);
      expect(await heroesOfCity(g, p.cityId, { tavern: true })).toHaveLength(3);
      await clearTavern(g, p.cityId);
      expect(await heroesOfCity(g, p.cityId, { tavern: true })).toHaveLength(0);
      expect((await heroesOfCity(g, p.cityId)).map((h) => h.id)).toEqual([hired]);
    }));
});

describe(resyncHeroGear.name, () => {
  it("puts the lord's gear on every hero whose gear changed", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const geared = await addHero(g, p);
      const low = await addHero(g, p);
      await patchHero(g, geared, { level: 30 });
      await patchHero(g, low, { level: 5 }); // gear tier 0: no gear to wear
      await patchPlayer(g, p, (row) => {
        row.research = { ...row.research, [TechType.HERO_ENHANCEMENT]: { level: 3 } };
      });
      const h = await getHero(g, geared);
      expect(h.powerAdded + h.managementAdded + h.stratagemAdded).toBe(0); // not yet applied
      const pushes = g.pushes(PushCmd.HERO_UPDATE).length;
      await resyncHeroGear(g, p.id);
      const after = await getHero(g, geared);
      expect(after[`${heroGearStat(after)}Added`]).toBe(heroGearBonus(30, lordGear(await reloadPlayer(g, p))));
      expect(
        pushedHeroes(g)
          .slice(pushes)
          .map((h) => h.id),
      ).toEqual([geared]);
    }));
});

describe(expireHeroBuff.name, () => {
  it('removes a boost that has run out, and only then', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await giveItems(g, p, { [ItemId.STRATAGEMS]: 1 });
      await heroes.useHeroItem(g, p.id, id, ItemId.STRATAGEMS);
      const end = (await getHero(g, id)).buffs[0]!.endTime;
      await expireHeroBuff(g, id, HeroBuffId.STRATAGEM);
      expect((await getHero(g, id)).buffs).toHaveLength(1);
      await expireHeroBuff(g, id, HeroBuffId.POWER); // no such boost
      expect((await getHero(g, id)).buffs).toHaveLength(1);
      g.advance(end - g.now);
      await expireHeroBuff(g, id, HeroBuffId.STRATAGEM);
      expect(await getHero(g, id)).toMatchObject({ buffs: [], stratagemBuffAdded: 0 });
    }));

  it('ignores a hero that is gone', () =>
    game(async (g) => {
      await expect(expireHeroBuff(g, 999_999_999, HeroBuffId.POWER)).resolves.toBeUndefined();
    }));
});
