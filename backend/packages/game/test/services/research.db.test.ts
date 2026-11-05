import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BuildingType,
  dur,
  goldForSpeedup,
  HOUR,
  ItemId,
  MINUTE,
  msg,
  ref,
  researchCost,
  researchMaxLevel,
  researchTimeMs,
  RESOURCE_KEYS,
  type Resources,
  scaled,
  SpeedupId,
  speedupItemGold,
  TECH_IDS,
  TechType,
  TimedEventType,
} from '@marchlands/core';

import { mayorStats } from '#/city.ts';
import { heroes, research } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import {
  addCity,
  addHero,
  cityBundle,
  createTestPlayer,
  giveItems,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setResearch,
  setResources,
} from '#test/support/factories.ts';
import { game, T0, type TestGame } from '#test/support/game.ts';
import { res, researchOf, stock, withAcademy } from '#test/support/research.ts';

const { AGRICULTURE, LUMBERING, HERO_ENHANCEMENT, CONSTRUCTION } = TechType;
const plus = (a: Resources, b: Partial<Resources>, mult = 1): Resources =>
  Object.fromEntries(RESOURCE_KEYS.map((k) => [k, a[k] + (b[k] ?? 0) * mult])) as Resources;
const minus = (a: Resources, b: Partial<Resources>): Resources => Object.fromEntries(RESOURCE_KEYS.map((k) => [k, a[k] - (b[k] ?? 0)])) as Resources;
/** The city's resources as stored. */
const stored = async (g: TestGame, cityId: number) => res(await reloadCity(g, cityId));

/** A second city for the player, on a free flat, made like the starting city (initialCity). */

describe(research.researchList.name, () => {
  it('lists every tech with its level, next cost and whether it may start', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await setBuildings(g, p, [[1002, BuildingType.SAWMILL, 0]]);
      const list = await research.researchList(g, p.id, p.cityId);
      expect(list).toMatchObject({ academyLevel: 1, researching: null, researchingIds: [], slots: BALANCE.researchQueues });
      expect(list.techs.map((t) => t.typeId)).toEqual(TECH_IDS);

      const agri = list.techs.find((t) => t.typeId === AGRICULTURE)!;
      expect(agri).toMatchObject({ level: 0, maxLevel: researchMaxLevel(AGRICULTURE), upgrading: false, castleId: null, permission: true });
      expect(agri.next).toMatchObject({ ...researchCost(AGRICULTURE, 1), time: Math.ceil(researchTimeMs(AGRICULTURE, 1, null) / 1000) });
      const lumber = list.techs.find((t) => t.typeId === LUMBERING)!;
      expect(lumber.permission).toBe(false);
      expect(lumber.next!.requirements).toContainEqual({ kind: 'building', id: BuildingType.SAWMILL, required: 1, current: 0, ok: false });
    }));

  it('shows what is being researched, and nothing may start once the queues are full', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const started = await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      let list = await research.researchList(g, p.id, p.cityId);
      expect(list).toMatchObject({ researching: AGRICULTURE, researchingIds: [AGRICULTURE] });
      expect(list.techs.find((t) => t.typeId === AGRICULTURE)).toMatchObject({
        upgrading: true,
        castleId: p.cityId,
        startTime: T0,
        endTime: started.endTime,
        permission: false,
      });
      expect(list.techs.find((t) => t.typeId === LUMBERING)!.permission).toBe(true);

      for (const t of [LUMBERING, HERO_ENHANCEMENT].slice(0, BALANCE.researchQueues - 1)) await research.startResearch(g, p.id, p.cityId, t);
      list = await research.researchList(g, p.id, p.cityId);
      expect(list.techs.every((t) => !t.permission)).toBe(true);
    }));

  it('a tech counts only up to the Academy level', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await setResearch(g, p, AGRICULTURE, 3);
      const agri = (await research.researchList(g, p.id, p.cityId)).techs.find((t) => t.typeId === AGRICULTURE)!;
      expect(agri).toMatchObject({ level: 3, effectiveLevel: 1 });
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(research.researchList(g, a.id, b.cityId), msg('common.invalidCastle'));
    }));
});

describe(research.startResearch.name, () => {
  it('starts the next level, pays for it and schedules its completion', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const before = await stock(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, AGRICULTURE);

      const end = T0 + researchTimeMs(AGRICULTURE, 1, null);
      expect(out).toEqual({ typeId: AGRICULTURE, level: 0, startTime: T0, endTime: end, castleId: p.cityId });
      expect(await researchOf(g, p, AGRICULTURE)).toEqual({ level: 0, cityId: p.cityId, startTime: T0, endTime: end });
      expect(await stored(g, p.cityId)).toEqual(minus(before, researchCost(AGRICULTURE, 1)));
      expect(g.events(TimedEventType.RESEARCH)).toEqual([
        {
          type: TimedEventType.RESEARCH,
          dueAt: end,
          playerId: p.id,
          cityId: p.cityId,
          refKey: `research:${p.id}:${AGRICULTURE}`,
          payload: { techId: AGRICULTURE },
        },
      ]);
      expect(g.pushes(PushCmd.RESEARCH_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId, typeId: AGRICULTURE, endTime: end } });
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId } });
    }));

  it('researches the level after the current one', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await setResearch(g, p, HERO_ENHANCEMENT, 2);
      await setBuildings(g, p, [[0, BuildingType.ACADEMY, 3]]); // level 3 needs Academy 3
      const before = await stock(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      expect(out).toMatchObject({ level: 2, endTime: T0 + researchTimeMs(HERO_ENHANCEMENT, 3, null) });
      expect(await stored(g, p.cityId)).toEqual(minus(before, researchCost(HERO_ENHANCEMENT, 3)));
    }));

  it("the mayor's stratagem shortens it", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await heroes.appointMayor(g, p.id, await addHero(g, p, 5));
      const b = await cityBundle(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      expect(out.endTime - out.startTime).toBe(researchTimeMs(HERO_ENHANCEMENT, 1, mayorStats(b.heroes)));
    }));

  it('refuses without an Academy, with unmet requirements, at the top level and for an unknown tech', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(
        research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT),
        msg('building.academyNeeded', { building: ref.building(BuildingType.ACADEMY) }),
      );
      await setBuildings(g, p, [[0, BuildingType.ACADEMY, 1]]);
      await expectRefused(research.startResearch(g, p.id, p.cityId, AGRICULTURE), msg('building.techRequirementsNotMet'));
      await expectRefused(research.startResearch(g, p.id, p.cityId, CONSTRUCTION), msg('building.techRequirementsNotMet'));
      await setResearch(g, p, HERO_ENHANCEMENT, researchMaxLevel(HERO_ENHANCEMENT));
      await expectRefused(research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT), msg('building.invalidTech'));
      await expectRefused(research.startResearch(g, p.id, p.cityId, 999), msg('building.invalidTech'));
      expect(g.events(TimedEventType.RESEARCH)).toEqual([]);
    }));

  it('refuses when the city cannot pay', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await setResources(g, p, { gold: 0 });
      await expectRefused(research.startResearch(g, p.id, p.cityId, AGRICULTURE), msg('common.notEnoughResources'));
      expect(await researchOf(g, p, AGRICULTURE)).toBeUndefined();
    }));

  it('refuses a tech already being researched, here or in another city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const second = await addCity(g, p);
      await withAcademy(g, p);
      await withAcademy(g, p, second);
      await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      const busy = msg('research.alreadyResearching', { tech: ref.tech(AGRICULTURE) });
      await expectRefused(research.startResearch(g, p.id, p.cityId, AGRICULTURE), busy);
      await expectRefused(research.startResearch(g, p.id, second, AGRICULTURE), busy);
      expect(await research.startResearch(g, p.id, second, LUMBERING)).toMatchObject({ castleId: second });
    }));

  it('runs BALANCE.researchQueues techs per city at once', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const second = await addCity(g, p);
      await withAcademy(g, p);
      await withAcademy(g, p, second);
      const techs = [AGRICULTURE, LUMBERING, HERO_ENHANCEMENT];
      for (const t of techs.slice(0, BALANCE.researchQueues)) await research.startResearch(g, p.id, p.cityId, t);
      await expectRefused(
        research.startResearch(g, p.id, p.cityId, techs[BALANCE.researchQueues]!),
        msg('research.queueFull', { count: BALANCE.researchQueues }),
      );
      // the queues are per city
      expect(await research.startResearch(g, p.id, second, techs[BALANCE.researchQueues]!)).toMatchObject({ castleId: second });
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await withAcademy(g, b);
      await expectRefused(research.startResearch(g, a.id, b.cityId, AGRICULTURE), msg('common.invalidCastle'));
    }));
});

describe(research.cancelResearch.name, () => {
  it('stops the research and refunds a share of its cost', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await setResearch(g, p, AGRICULTURE, 1);
      await setBuildings(g, p, [[1001, BuildingType.FARM, 2]]); // level 2 needs Farm 2
      await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      g.advance(MINUTE);
      const before = await stock(g, p);
      await research.cancelResearch(g, p.id, p.cityId);
      expect(await researchOf(g, p, AGRICULTURE)).toEqual({ level: 1 });
      expect(await stored(g, p.cityId)).toEqual(plus(before, researchCost(AGRICULTURE, 2), BALANCE.cancelResearchRefund));
      expect(g.events(TimedEventType.RESEARCH)).toEqual([]);
      expect(g.pushes(PushCmd.RESEARCH_UPDATE).at(-1)?.data).toEqual({ castleId: p.cityId, typeId: AGRICULTURE, endTime: 0 });
    }));

  it('with several running, cancels the one named and needs a name', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      await research.startResearch(g, p.id, p.cityId, LUMBERING);
      await expectRefused(research.cancelResearch(g, p.id, p.cityId), msg('research.chooseResearch'));
      await expectRefused(research.cancelResearch(g, p.id, p.cityId, HERO_ENHANCEMENT), msg('research.notResearching', { tech: ref.tech(HERO_ENHANCEMENT) }));
      await research.cancelResearch(g, p.id, p.cityId, LUMBERING);
      expect(await researchOf(g, p, LUMBERING)).toEqual({ level: 0 });
      expect(g.events(TimedEventType.RESEARCH)).toMatchObject([{ payload: { techId: AGRICULTURE } }]);
    }));

  it('refuses when nothing is being researched in that city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const second = await addCity(g, p);
      await withAcademy(g, p);
      await expectRefused(research.cancelResearch(g, p.id, p.cityId), msg('research.noResearch'));
      await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      await expectRefused(research.cancelResearch(g, p.id, second), msg('research.noResearch'));
      await expectRefused(research.cancelResearch(g, p.id, second, AGRICULTURE), msg('research.notResearching', { tech: ref.tech(AGRICULTURE) }));
    }));
});

describe(research.researchSpeedupCost.name, () => {
  it('prices finishing now in gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      expect(await research.researchSpeedupCost(g, p.id, p.cityId)).toEqual({ goldNeed: goldForSpeedup(out.endTime - T0), timeLeft: out.endTime - T0 });
      g.advance(10 * MINUTE);
      expect(await research.researchSpeedupCost(g, p.id, p.cityId, HERO_ENHANCEMENT)).toEqual({
        goldNeed: goldForSpeedup(out.endTime - g.now),
        timeLeft: out.endTime - g.now,
      });
      g.advance(HOUR);
      expect(await research.researchSpeedupCost(g, p.id, p.cityId)).toEqual({ goldNeed: goldForSpeedup(0), timeLeft: 0 });
    }));

  it('refuses when there is nothing (or no single thing) to price', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await expectRefused(research.researchSpeedupCost(g, p.id, p.cityId), msg('research.noResearch'));
      await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      await research.startResearch(g, p.id, p.cityId, LUMBERING);
      await expectRefused(research.researchSpeedupCost(g, p.id, p.cityId), msg('research.chooseResearch'));
      await expectRefused(
        research.researchSpeedupCost(g, p.id, p.cityId, HERO_ENHANCEMENT),
        msg('research.notResearching', { tech: ref.tech(HERO_ENHANCEMENT) }),
      );
    }));
});

describe(research.speedupResearch.name, () => {
  it('the free speed-up works only in the last minutes', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      const freeMs = scaled(BALANCE.freeSpeedupMs);
      expect(out.endTime - T0).toBeGreaterThan(freeMs);
      await expectRefused(research.speedupResearch(g, p.id, p.cityId, SpeedupId.FREE), msg('common.freeSpeedupTooEarly', { time: dur(freeMs) }));

      g.advance(out.endTime - freeMs - T0);
      expect(await research.speedupResearch(g, p.id, p.cityId, SpeedupId.FREE)).toEqual({ endTime: g.now });
      expect(await researchOf(g, p, AGRICULTURE)).toMatchObject({ startTime: out.startTime - freeMs, endTime: g.now });
      expect(g.events(TimedEventType.RESEARCH)).toMatchObject([{ dueAt: g.now, payload: { techId: AGRICULTURE } }]);
      expect(g.pushes(PushCmd.RESEARCH_UPDATE).at(-1)?.data).toEqual({ castleId: p.cityId, typeId: AGRICULTURE, endTime: g.now });
      await g.runDue();
      expect(await researchOf(g, p, AGRICULTURE)).toEqual({ level: 1 });
    }));

  it('gold finishes it at once for the time left', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      g.advance(MINUTE);
      const before = await stock(g, p);
      expect(await research.speedupResearch(g, p.id, p.cityId, SpeedupId.GOLD, HERO_ENHANCEMENT)).toEqual({ endTime: g.now });
      expect(await stored(g, p.cityId)).toEqual({ ...before, gold: before.gold - goldForSpeedup(out.endTime - g.now) });
    }));

  it('refuses gold the city does not have', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      await setResources(g, p, { gold: 0 });
      await expectRefused(
        research.speedupResearch(g, p.id, p.cityId, SpeedupId.GOLD),
        msg('common.notEnoughGoldFor', { amount: goldForSpeedup(out.endTime - g.now) }),
      );
      expect(await researchOf(g, p, HERO_ENHANCEMENT)).toMatchObject({ endTime: out.endTime });
    }));

  it('an owned guideline is used up and cuts its time', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await giveItems(g, p, { [ItemId.BEGINNER_GUIDELINES]: 1 });
      const owned = (await reloadPlayer(g, p)).items[ItemId.BEGINNER_GUIDELINES]!;
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      const cut = BALANCE.items.speedups[ItemId.BEGINNER_GUIDELINES]!.cutMs!;
      expect(out.endTime - out.startTime).toBeGreaterThan(cut);
      const gold = (await stock(g, p)).gold;
      expect(await research.speedupResearch(g, p.id, p.cityId, ItemId.BEGINNER_GUIDELINES)).toEqual({ endTime: out.endTime - cut });
      expect(await researchOf(g, p, HERO_ENHANCEMENT)).toMatchObject({ startTime: out.startTime - cut, endTime: out.endTime - cut });
      expect((await reloadPlayer(g, p)).items[ItemId.BEGINNER_GUIDELINES] ?? 0).toBe(owned - 1);
      expect((await stored(g, p.cityId)).gold).toBe(gold);
      expect(g.events(TimedEventType.RESEARCH)).toMatchObject([{ dueAt: out.endTime - cut }]);
    }));

  it('an item the player lacks is bought with city gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      const before = await stock(g, p);
      await research.speedupResearch(g, p.id, p.cityId, ItemId.BEGINNER_GUIDELINES);
      expect((await stored(g, p.cityId)).gold).toBe(before.gold - speedupItemGold(ItemId.BEGINNER_GUIDELINES));
      expect(await researchOf(g, p, HERO_ENHANCEMENT)).toMatchObject({ endTime: out.endTime - BALANCE.items.speedups[ItemId.BEGINNER_GUIDELINES]!.cutMs! });
      await setResources(g, p, { gold: 0 });
      await expectRefused(
        research.speedupResearch(g, p.id, p.cityId, ItemId.BEGINNER_GUIDELINES),
        msg('common.notEnoughGoldFor', { amount: speedupItemGold(ItemId.BEGINNER_GUIDELINES) }),
      );
    }));

  it('a share speed-up always cuts a share of the full time, never past now', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await giveItems(g, p, { [ItemId.ULTIMATE_GUIDELINES]: 5 });
      const out = await research.startResearch(g, p.id, p.cityId, HERO_ENHANCEMENT);
      const cut = (out.endTime - out.startTime) * BALANCE.items.speedups[ItemId.ULTIMATE_GUIDELINES]!.cutShare!;
      expect(await research.speedupResearch(g, p.id, p.cityId, ItemId.ULTIMATE_GUIDELINES)).toEqual({ endTime: out.endTime - cut });
      expect(await research.speedupResearch(g, p.id, p.cityId, ItemId.ULTIMATE_GUIDELINES)).toEqual({ endTime: out.endTime - 2 * cut });
      for (let i = 0; i < 2; i++) await research.speedupResearch(g, p.id, p.cityId, ItemId.ULTIMATE_GUIDELINES);
      expect(await research.speedupResearch(g, p.id, p.cityId, ItemId.ULTIMATE_GUIDELINES)).toEqual({ endTime: g.now });
      const r = (await researchOf(g, p, HERO_ENHANCEMENT))!;
      expect(r.endTime! - r.startTime!).toBe(out.endTime - out.startTime);
    }));

  it('refuses an unknown speed-up and a city with nothing to speed up', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withAcademy(g, p);
      await expectRefused(research.speedupResearch(g, p.id, p.cityId, SpeedupId.GOLD), msg('research.noResearch'));
      await research.startResearch(g, p.id, p.cityId, AGRICULTURE);
      await expectRefused(research.speedupResearch(g, p.id, p.cityId, 'no.such.item'), msg('common.invalidSpeedup'));
      await expectRefused(
        research.speedupResearch(g, p.id, p.cityId, SpeedupId.GOLD, LUMBERING),
        msg('research.notResearching', { tech: ref.tech(LUMBERING) }),
      );
    }));
});
