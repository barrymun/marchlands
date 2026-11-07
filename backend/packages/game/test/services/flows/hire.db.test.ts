// The "hire heroes" action: hiring from the Inn by a base attribute, re-rolling it for gold (through runFlow).

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BALANCE,
  BuildingType,
  defaultRng,
  FlowActionType,
  FlowCities,
  type FlowCityChoice,
  HeroBuffId,
  heroHireCost,
  hiredHeroName,
  msg,
  ref,
  seededRng,
  tavernRefreshCost,
} from '@marchlands/core';

import { flows, heroes } from '#/index.ts';
import { heroesOfCity } from '#/repo.ts';
import { addCity, createTestPlayer, reloadCity, setResources, type TestPlayer } from '#test/support/factories.ts';
import { newFlow, runFlowIn, withHero } from '#test/support/flows.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { heroBuildings, patchHero } from '#test/support/heroes.ts';

const INN = 5;
const REROLL = tavernRefreshCost(INN);

afterEach(() => vi.restoreAllMocks());

/** A level 1 hero with this Attack, its level 1 value. */
const levelOne = (power: number) => ({ level: 1, basePower: power, power, remainPoint: 0 });

/** The Inn's rolls from here on: seeded, and kept under 0.98 so no attribute is born above 70. */
const noGreatHeroes = () => {
  const rng = seededRng('hire');
  vi.spyOn(defaultRng, 'next').mockImplementation(() => rng.next() * 0.98);
};

/** A player whose city has an Inn, a Feasting Hall and gold, its Inn's offers level 1 with these Attack values. */
async function innWith(g: TestGame, powers: number[], opts: { hall?: number; gold?: number } = {}) {
  const p = await createTestPlayer(g);
  await heroBuildings(g, p, INN, opts.hall ?? 5);
  await setResources(g, p, { gold: opts.gold ?? 10_000_000 });
  const { heros } = await heroes.tavern(g, p.id, p.cityId);
  for (const [i, h] of heros.entries()) await patchHero(g, h.id, levelOne(powers[i] ?? 20));
  return p;
}

async function hire(g: TestGame, p: TestPlayer, action: { min: number; count: number; maxGold: number }, cities: FlowCityChoice = [p.cityId]) {
  const f = await newFlow(g, p, { name: `Hire ${g.now}`, actions: [{ type: FlowActionType.HIRE_HEROES, stat: HeroBuffId.POWER, ...action }] });
  return runFlowIn(g, p, f.id, cities);
}

const hiredOf = async (g: TestGame, p: TestPlayer) => (await heroesOfCity(g, p.cityId)).filter((h) => h.playerId === p.id);

describe(`${flows.runFlow.name}: hireHeroes`, () => {
  it('counts an offer by its level 1 value, whatever its stored base', () =>
    game(async (g) => {
      noGreatHeroes();
      const p = await innWith(g, []);
      const [levelled, born] = await heroesOfCity(g, p.cityId, { tavern: true });
      // base 77 at level 4 with Attack 78: its other points went elsewhere, so it counts as 75; a level 1 with 76 beats it
      await patchHero(g, levelled!.id, { level: 4, basePower: 77, power: 78 });
      await patchHero(g, born!.id, { level: 1, basePower: 76, power: 76 });

      await hire(g, p, { min: 75, count: 1, maxGold: 1_000_000 });

      expect(await hiredOf(g, p)).toEqual([expect.objectContaining({ id: born!.id, name: hiredHeroName(HeroBuffId.POWER, 76) })]);
    }));

  it('leaves an offer with a high enough stat or base whose level 1 value falls short, re-rolling instead', () =>
    game(async (g) => {
      noGreatHeroes();
      const p = await innWith(g, []);
      const [low, stray] = await heroesOfCity(g, p.cityId, { tavern: true });
      await patchHero(g, low!.id, { level: 4, basePower: 74, power: 77 });
      await patchHero(g, stray!.id, { level: 4, basePower: 77, power: 77 });

      const step = (await hire(g, p, { min: 77, count: 1, maxGold: REROLL })).cities[0]!.steps[0]!;

      expect(await hiredOf(g, p)).toEqual([]);
      expect(step.detail).toMatchObject({ params: { rerolls: msg('flow.rerolls', { count: 1 }) } });
    }));

  it('hires a higher level offer with all it can have in the attribute, named after its level 1 value', () =>
    game(async (g) => {
      noGreatHeroes();
      const p = await innWith(g, []);
      const [best] = await heroesOfCity(g, p.cityId, { tavern: true });
      // level 4, base 77, three of its four points in Attack (the fourth always goes to Intelligence)
      await patchHero(g, best!.id, { level: 4, basePower: 77, power: 80 });

      await hire(g, p, { min: 77, count: 1, maxGold: 1_000_000 });

      expect(await hiredOf(g, p)).toEqual([expect.objectContaining({ id: best!.id, name: hiredHeroName(HeroBuffId.POWER, 77) })]);
    }));

  it('names a hire after the attribute asked for, by Politics too', () =>
    game(async (g) => {
      noGreatHeroes();
      const p = await innWith(g, []);
      const [best] = await heroesOfCity(g, p.cityId, { tavern: true });
      await patchHero(g, best!.id, { level: 2, baseManagement: 76, management: 77 });
      const f = await newFlow(g, p, {
        name: `Hire ${g.now}`,
        actions: [{ type: FlowActionType.HIRE_HEROES, stat: HeroBuffId.MANAGEMENT, min: 76, count: 1, maxGold: 1_000_000 }],
      });

      await runFlowIn(g, p, f.id, [p.cityId]);

      expect(await hiredOf(g, p)).toEqual([expect.objectContaining({ id: best!.id, name: hiredHeroName(HeroBuffId.MANAGEMENT, 76) })]);
    }));

  it('counts a hero already there with its unspent points', () =>
    game(async (g) => {
      const p = await innWith(g, []);
      await withHero(g, p);
      const [own] = await hiredOf(g, p);
      // level 86 with 83 unspent and Attack 78: 76
      await patchHero(g, own!.id, { level: 86, basePower: 78, power: 78, remainPoint: 83 });

      const met = (await hire(g, p, { min: 76, count: 1, maxGold: 1 })).cities[0]!.steps[0]!;
      expect(met).toMatchObject({ skipped: true, detail: msg('flow.step.hireTargetMet', { count: 1, stat: ref.stat(HeroBuffId.POWER), min: 76 }) });

      const short = (await hire(g, p, { min: 77, count: 1, maxGold: 1 })).cities[0]!.steps[0]!;
      expect(short.detail).not.toMatchObject({ code: 'flow.step.hireTargetMet' });
    }));

  it('hires the best offers with enough of the attribute, names them after it and takes their price', () =>
    game(async (g) => {
      const p = await innWith(g, [30, 72, 65, 75, 40]);
      const offers = await heroesOfCity(g, p.cityId, { tavern: true });
      const [top, second] = [75, 72].map((v) => offers.find((h) => h.basePower === v)!);
      const gold = (await reloadCity(g, p.cityId)).gold;

      const r = await hire(g, p, { min: 60, count: 2, maxGold: 1_000_000 });

      const spent = heroHireCost(top!.level) + heroHireCost(second!.level);
      expect(r.cities[0]!.steps[0]).toEqual({
        action: msg('flow.action.hireHeroes', { count: 2, stat: ref.stat(HeroBuffId.POWER), min: 60, gold: 1_000_000 }),
        ok: true,
        detail: msg('flow.step.hired', { count: 2, stat: ref.stat(HeroBuffId.POWER), min: 60, gold: spent, rerolls: msg('flow.rerolls', { count: 0 }) }),
      });
      expect(new Map((await hiredOf(g, p)).map((h) => [h.id, h.name]))).toEqual(
        new Map([
          [top!.id, hiredHeroName(HeroBuffId.POWER, 75)],
          [second!.id, hiredHeroName(HeroBuffId.POWER, 72)],
        ]),
      );
      expect((await reloadCity(g, p.cityId)).gold).toBe(gold - spent);
    }));

  it('re-rolls the Inn until the gold limit, then says so and carries on', () =>
    game(async (g) => {
      const p = await innWith(g, []);
      noGreatHeroes();
      const r = await hire(g, p, { min: 75, count: 1, maxGold: 2 * REROLL });
      const step = r.cities[0]!.steps[0]!;
      expect(step).toMatchObject({
        ok: true,
        skipped: true,
        detail: msg('flow.step.hiredSome', {
          count: 0,
          requested: 1,
          stat: ref.stat(HeroBuffId.POWER),
          min: 75,
          gold: 2 * REROLL,
          rerolls: msg('flow.rerolls', { count: 2 }),
          reason: msg('flow.hireStop.cap', { gold: 2 * REROLL }),
        }),
      });
      expect(r.cities[0]!.ok).toBe(true);
      expect(await hiredOf(g, p)).toEqual([]);
    }));

  it('stops when the city runs out of gold, and after the most re-rolls a run allows', () =>
    game(async (g) => {
      const p = await innWith(g, [], { gold: REROLL });
      noGreatHeroes();
      const poor = (await hire(g, p, { min: 75, count: 1, maxGold: 1_000_000 })).cities[0]!.steps[0]!;
      expect(poor.detail).toMatchObject({ params: { reason: msg('flow.hireStop.gold'), rerolls: msg('flow.rerolls', { count: 1 }) } });

      await setResources(g, p, { gold: 100_000_000 });
      const many = (await hire(g, p, { min: 75, count: 1, maxGold: 100_000_000 })).cities[0]!.steps[0]!;
      const most = BALANCE.flowHireMaxRerolls;
      expect(many.detail).toMatchObject({ params: { reason: msg('flow.hireStop.rerolls', { count: most }), gold: most * REROLL } });
    }));

  it('hires only what the city still needs, counting the heroes already there, and nothing once it has enough', () =>
    game(async (g) => {
      const p = await innWith(g, [76, 77, 78, 20, 20]);
      await withHero(g, p);
      const [own] = await hiredOf(g, p);
      await patchHero(g, own!.id, levelOne(75));

      const r = await hire(g, p, { min: 75, count: 3, maxGold: 1_000_000 });
      // the hero already there with 75 counts: two more, the best two
      expect(r.cities[0]!.steps[0]!.detail).toMatchObject({ code: 'flow.step.hired', params: { count: 2 } });
      expect((await hiredOf(g, p)).map((h) => h.name).sort()).toEqual(
        [own!.name, hiredHeroName(HeroBuffId.POWER, 77), hiredHeroName(HeroBuffId.POWER, 78)].sort(),
      );

      const again = (await hire(g, p, { min: 75, count: 3, maxGold: 1_000_000 })).cities[0]!.steps[0]!;
      expect(again).toMatchObject({ skipped: true, detail: msg('flow.step.hireTargetMet', { count: 3, stat: ref.stat(HeroBuffId.POWER), min: 75 }) });
      // only the hero with 78 counts towards a bar of 78: one more is needed
      noGreatHeroes();
      const higher = (await hire(g, p, { min: 78, count: 2, maxGold: 1_000_000 })).cities[0]!.steps[0]!;
      expect(higher.detail).toMatchObject({ code: 'flow.step.hiredSome', params: { count: 0, requested: 1 } });
    }));

  it("is skipped when the Feasting Hall is full or there's no Inn, and hires no more than the hall has room for", () =>
    game(async (g) => {
      const p = await innWith(g, [70, 71, 72, 73, 74], { hall: 2 });
      const r = await hire(g, p, { min: 1, count: 5, maxGold: 1_000_000 });
      expect(r.cities[0]!.steps[0]!.detail).toMatchObject({ code: 'flow.step.hired', params: { count: 2 } });
      // the best two
      expect((await hiredOf(g, p)).map((h) => h.name).sort()).toEqual([hiredHeroName(HeroBuffId.POWER, 73), hiredHeroName(HeroBuffId.POWER, 74)]);

      const full = (await hire(g, p, { min: 1, count: 3, maxGold: 1_000_000 })).cities[0]!.steps[0]!;
      expect(full).toMatchObject({ skipped: true, detail: msg('flow.step.hallFull', { building: ref.building(BuildingType.FEASTING_HALL) }) });

      const q = await createTestPlayer(g);
      const none = (await hire(g, q, { min: 1, count: 1, maxGold: 1_000_000 })).cities[0]!.steps[0]!;
      expect(none).toMatchObject({ skipped: true, detail: msg('hero.needInn', { building: ref.building(BuildingType.INN) }) });
    }));

  it('runs on every city, those without a hero too, when it runs on all cities', () =>
    game(async (g) => {
      const p = await innWith(g, []);
      const second = await addCity(g, p);
      const r = await hire(g, p, { min: 1, count: 1, maxGold: 1 }, FlowCities.ALL);
      expect(r.cities.map((c) => c.cityId).sort()).toEqual([p.cityId, second].sort());
      expect(r.skippedCities).toEqual([]);
    }));
});
