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

/** The Inn's rolls from here on: seeded, and kept under 0.98 so no attribute is born above 70. */
const noGreatHeroes = () => {
  const rng = seededRng('hire');
  vi.spyOn(defaultRng, 'next').mockImplementation(() => rng.next() * 0.98);
};

/** A player whose city has an Inn, a Feasting Hall and gold, its Inn's offers born with these Attack values. */
async function innWith(g: TestGame, powers: number[], opts: { hall?: number; gold?: number } = {}) {
  const p = await createTestPlayer(g);
  await heroBuildings(g, p, INN, opts.hall ?? 5);
  await setResources(g, p, { gold: opts.gold ?? 10_000_000 });
  const { heros } = await heroes.tavern(g, p.id, p.cityId);
  for (const [i, h] of heros.entries()) await patchHero(g, h.id, { basePower: powers[i] ?? 20 });
  return p;
}

async function hire(g: TestGame, p: TestPlayer, action: { min: number; count: number; maxGold: number }, cities: FlowCityChoice = [p.cityId]) {
  const f = await newFlow(g, p, { name: `Hire ${g.now}`, actions: [{ type: FlowActionType.HIRE_HEROES, stat: HeroBuffId.POWER, ...action }] });
  return runFlowIn(g, p, f.id, cities);
}

const hiredOf = async (g: TestGame, p: TestPlayer) => (await heroesOfCity(g, p.cityId)).filter((h) => h.playerId === p.id);

describe(`${flows.runFlow.name}: hireHeroes`, () => {
  it('hires the best offers born with enough of the attribute, names them after it and takes their price', () =>
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
      await patchHero(g, own!.id, { basePower: 75 });

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
