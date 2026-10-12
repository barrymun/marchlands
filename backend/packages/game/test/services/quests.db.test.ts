import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  BuildingType,
  ItemId,
  msg,
  QUEST_CATALOGUE,
  questGroupsWithQuests,
  questTargetMessage,
  RESOURCE_KEYS,
  type QuestDef,
  type QuestTarget,
} from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { addPrestige } from '#/helpers.ts';
import { getPlayer, saveCity, savePlayer } from '#/repo.ts';
import { heroes, mail, quests } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import {
  addHero,
  cityBundle,
  createTestPlayer,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setCityStats,
  setResearch,
  setTownHall,
  type TestPlayer,
} from '#test/support/factories.ts';
import { game, T0, type TestGame } from '#test/support/game.ts';
import { foundAlliance } from '#test/support/alliance.ts';

const DAY = 86_400_000;

/** The catalogue quest with a target matching `pred` (the catalogue has one target per quest). */
function questWith(pred: (t: QuestTarget) => boolean): QuestDef {
  const q = QUEST_CATALOGUE.find((x) => x.targets.some(pred));
  if (!q) throw new Error('no such quest');
  return q;
}
const buildingQuest = (typeId: number, level: number, count?: number) =>
  questWith((t) => t.kind === 'building' && t.typeId === typeId && t.level === level && t.count === count);
const kindQuest = (kind: QuestTarget['kind']) => questWith((t) => t.kind === kind);

const TOWN_HALL_2 = buildingQuest(BuildingType.TOWN_HALL, 2);
const FAIR_TAXES = kindQuest('taxRate');

/** Is the quest finished (targets met or claimed) for the player now? */
async function finished(g: TestGame, p: TestPlayer, q: QuestDef) {
  const list = await quests.questList(g, p.id, q.groupId);
  return list.find((x) => x.questId === q.id)!.isFinish;
}

/** Resources of the city, as stored. */
async function resources(g: TestGame, cityId: number) {
  const c = await reloadCity(g, cityId);
  return Object.fromEntries(RESOURCE_KEYS.map((k) => [k, c[k]]));
}

describe(quests.questTypes.name, () => {
  it('lists the quest groups that have quests; a new player has only the tax quest to claim', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const types = await quests.questTypes(g, a.id);
      expect(types.map(({ id, typeId }) => ({ id, typeId }))).toEqual(questGroupsWithQuests().map(({ id, typeId }) => ({ id, typeId })));
      expect(types.filter((t) => t.isFinish).map((t) => t.id)).toEqual([FAIR_TAXES.groupId]);
    }));

  it('a group is no longer marked once its finished quests are claimed', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await quests.claimQuest(g, a.id, FAIR_TAXES.id, a.cityId);
      expect((await quests.questTypes(g, a.id)).filter((t) => t.isFinish)).toEqual([]);
    }));
});

describe(quests.questList.name, () => {
  it('lists the whole catalogue with targets as messages and awards', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const list = await quests.questList(g, a.id);
      expect(list.map((q) => q.questId)).toEqual(QUEST_CATALOGUE.map((q) => q.id));
      expect(list.find((q) => q.questId === TOWN_HALL_2.id)).toEqual({
        questId: TOWN_HALL_2.id,
        groupId: TOWN_HALL_2.groupId,
        description: TOWN_HALL_2.description,
        targets: [{ text: questTargetMessage(TOWN_HALL_2.targets[0]), finished: false }],
        award: TOWN_HALL_2.award,
        isFinish: false,
        claimed: false,
      });
      // a new player: Town Hall 1, tax rate BALANCE.startTaxRate, nothing else
      expect(BALANCE.startTaxRate).toBeLessThanOrEqual(20);
      expect(list.filter((q) => q.isFinish).map((q) => q.questId)).toEqual([FAIR_TAXES.id]);
    }));

  it('filters by group; an unknown group is empty', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const list = await quests.questList(g, a.id, TOWN_HALL_2.groupId);
      expect(list.map((q) => q.questId)).toEqual(QUEST_CATALOGUE.filter((q) => q.groupId === TOWN_HALL_2.groupId).map((q) => q.id));
      expect(await quests.questList(g, a.id, 9999)).toEqual([]);
    }));

  it('building targets count buildings of the type at or above the level', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const network = buildingQuest(BuildingType.FARM, 1, 5);
      const bountiful = buildingQuest(BuildingType.FARM, 3);
      await setBuildings(
        g,
        a,
        [1001, 1002, 1003, 1004].map((pos) => [pos, BuildingType.FARM, 1]),
      );
      expect(await finished(g, a, network)).toBe(false);
      expect(await finished(g, a, bountiful)).toBe(false);
      await setBuildings(g, a, [[1005, BuildingType.FARM, 3]]);
      expect(await finished(g, a, network)).toBe(true);
      expect(await finished(g, a, bountiful)).toBe(true);
      await setTownHall(g, a, 3);
      expect(await finished(g, a, TOWN_HALL_2)).toBe(true);
    }));

  it('evaluates research, troops, fortifications, population and prestige', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const research = kindQuest('research');
      const militia = questWith((t) => t.kind === 'troops' && t.key === 'militia');
      const traps = questWith((t) => t.kind === 'troops' && t.key === 'trap');
      const population = kindQuest('population');
      const prestige = kindQuest('prestige');
      for (const q of [research, militia, traps, population, prestige]) expect(await finished(g, a, q)).toBe(false);

      const r = research.targets[0] as Extract<QuestTarget, { kind: 'research' }>;
      await setResearch(g, a, r.techId, r.level);
      await setCityStats(g, a, { troops: { militia: 100 }, population: 1000 });
      const b = await cityBundle(g, a);
      b.city.forts = { ...b.city.forts, trap: 100 };
      await saveCity(g, b.city);
      const p = await getPlayer(g, a.id);
      addPrestige(p, 10_000);
      await savePlayer(g, p);
      for (const q of [research, militia, traps, population, prestige]) expect(await finished(g, a, q)).toBe(true);
    }));

  it('evaluates heroes (not tavern offers), a mayor, an alliance and mail sent', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const recruit = kindQuest('heroes');
      const mayor = kindQuest('mayor');
      const join = kindQuest('alliance');
      const correspondence = kindQuest('mailSent');

      await setBuildings(g, a, [[0, BuildingType.INN, 1]]);
      await heroes.tavern(g, a.id, a.cityId); // offers in the inn are not the player's heroes
      expect(await finished(g, a, recruit)).toBe(false);
      const heroId = await addHero(g, a);
      expect(await finished(g, a, recruit)).toBe(true);
      expect(await finished(g, a, mayor)).toBe(false);
      await heroes.appointMayor(g, a.id, heroId);
      expect(await finished(g, a, mayor)).toBe(true);

      expect(await finished(g, a, join)).toBe(false);
      await foundAlliance(g, a, 'Order');
      expect(await finished(g, a, join)).toBe(true);

      await mail.sendMail(g, b.id, a.name, 'Hi', 'received mail does not count');
      expect(await finished(g, a, correspondence)).toBe(false);
      await mail.sendMail(g, a.id, b.name, 'Hi', 'sent');
      expect(await finished(g, a, correspondence)).toBe(true);
    }));

  it('a claimed quest stays finished even if its target is no longer met', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await setTownHall(g, a, 2);
      await quests.claimQuest(g, a.id, TOWN_HALL_2.id, a.cityId);
      await setTownHall(g, a, 1);
      const q = (await quests.questList(g, a.id)).find((x) => x.questId === TOWN_HALL_2.id)!;
      expect(q).toMatchObject({ isFinish: true, claimed: true, targets: [{ finished: false }] });
    }));
});

describe(quests.claimQuest.name, () => {
  it('pays the resource award into the city and marks the quest claimed', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await setTownHall(g, a, 2);
      const before = await resources(g, a.cityId);
      expect(await quests.claimQuest(g, a.id, TOWN_HALL_2.id, a.cityId)).toEqual(TOWN_HALL_2.award);
      const after = await resources(g, a.cityId);
      for (const k of RESOURCE_KEYS) expect(after[k]).toBe(before[k] + (TOWN_HALL_2.award.resources![k] ?? 0));
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ playerIds: [a.id], data: { castleId: a.cityId } });
      expect((await quests.questList(g, a.id, TOWN_HALL_2.groupId)).find((q) => q.questId === TOWN_HALL_2.id)!.claimed).toBe(true);
    }));

  it('gives an item award to the player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const mayor = kindQuest('mayor');
      expect(mayor.award.items).toEqual({ [ItemId.CROSS_MEDAL]: 1 });
      await heroes.appointMayor(g, a.id, await addHero(g, a));
      const had = (await reloadPlayer(g, a)).items[ItemId.CROSS_MEDAL] ?? 0;
      await quests.claimQuest(g, a.id, mayor.id, a.cityId);
      expect((await reloadPlayer(g, a)).items[ItemId.CROSS_MEDAL]).toBe(had + 1);
      expect(g.pushes(PushCmd.ITEM_UPDATE).at(-1)).toMatchObject({ playerIds: [a.id], data: { items: [{ id: ItemId.CROSS_MEDAL, count: had + 1 }] } });
    }));

  it('can be claimed only once', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await quests.claimQuest(g, a.id, FAIR_TAXES.id, a.cityId);
      const before = await resources(g, a.cityId);
      await expectRefused(quests.claimQuest(g, a.id, FAIR_TAXES.id, a.cityId), msg('quest.alreadyClaimed'));
      expect(await resources(g, a.cityId)).toEqual(before);
      // claimed is checked before the targets
      await setTownHall(g, a, 2);
      await quests.claimQuest(g, a.id, TOWN_HALL_2.id, a.cityId);
      await setTownHall(g, a, 1);
      await expectRefused(quests.claimQuest(g, a.id, TOWN_HALL_2.id, a.cityId), msg('quest.alreadyClaimed'));
    }));

  it('rejects an unknown quest, an unfinished quest and a city that is not yours', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(quests.claimQuest(g, a.id, 1, a.cityId), msg('quest.notFound'));
      await expectRefused(quests.claimQuest(g, a.id, TOWN_HALL_2.id, a.cityId), msg('quest.notFinished'));
      await expectRefused(quests.claimQuest(g, a.id, FAIR_TAXES.id, b.cityId), msg('common.invalidCastle'));
      expect((await quests.questList(g, a.id)).filter((q) => q.claimed)).toEqual([]);
    }));

  it("claims are per player: another player's claim does not count", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await quests.claimQuest(g, a.id, FAIR_TAXES.id, a.cityId);
      await quests.claimQuest(g, b.id, FAIR_TAXES.id, b.cityId);
      expect((await quests.questList(g, b.id)).filter((q) => q.claimed).map((q) => q.questId)).toEqual([FAIR_TAXES.id]);
    }));
});

describe(quests.claimDailyGift.name, () => {
  it('pays BALANCE.dailyGift into the city, once per UTC day', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const before = await resources(g, a.cityId);
      expect(await quests.claimDailyGift(g, a.id, a.cityId)).toEqual({ resources: BALANCE.dailyGift });
      const after = await resources(g, a.cityId);
      for (const k of RESOURCE_KEYS) expect(after[k]).toBe(before[k] + (BALANCE.dailyGift[k] ?? 0));
      expect((await reloadPlayer(g, a)).misc.dailyGiftDay).toBe('2026-01-01');
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ playerIds: [a.id], data: { castleId: a.cityId } });
      expect(g._stats.get(`${a.id}|${a.cityId}`)).toMatchObject(
        Object.fromEntries(Object.entries(BALANCE.dailyGift).map(([k, v]) => [`gained.dailyGift.${k}`, v])),
      );

      g.advance(DAY - 1);
      await expectRefused(quests.claimDailyGift(g, a.id, a.cityId), msg('quest.dailyGiftClaimed'));
      g.advance(1);
      await quests.claimDailyGift(g, a.id, a.cityId);
      expect((await reloadPlayer(g, a)).misc.dailyGiftDay).toBe('2026-01-02');
      expect(g.now).toBe(T0 + DAY);
    }));

  it('rejects a city that is not yours', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(quests.claimDailyGift(g, a.id, b.cityId), msg('common.invalidCastle'));
      expect((await reloadPlayer(g, a)).misc.dailyGiftDay).toBeUndefined();
    }));
});
