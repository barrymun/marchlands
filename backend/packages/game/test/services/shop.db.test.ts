import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BuildingType,
  civilCodePopulation,
  heroBoxQuality,
  type ItemEffect,
  itemEffect,
  itemGoldPrice,
  ItemId,
  ITEMS,
  medalId,
  msg,
  ref,
  upgradeExpFor,
} from '@marchlands/core';

import { cityStats } from '#/city.ts';
import { shop } from '#/index.ts';
import { heroesOfCity, saveCity } from '#/repo.ts';
import { expectRefused } from '#test/support/expect.ts';
import {
  cityBundle,
  createTestPlayer,
  giveItems,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setCityStats,
  setResources,
  type TestPlayer,
} from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

const BUFF_ITEMS = ITEMS.map((i) => [i.id, itemEffect(i.id)] as const).filter(
  (e): e is [string, Extract<ItemEffect, { kind: 'buff' }>] => e[1]?.kind === 'buff',
);

async function setInjured(g: TestGame, p: TestPlayer, injured: Record<string, number>, troops: Record<string, number> = {}) {
  const c = await reloadCity(g, p.cityId);
  c.injuredTroops = injured;
  c.troops = troops;
  await saveCity(g, c);
}

const count = async (g: TestGame, p: TestPlayer, itemId: string) => (await reloadPlayer(g, p)).items[itemId] ?? 0;

describe(shop.buyItemWithGold.name, () => {
  it('charges the city gold and puts the items in the inventory', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const price = itemGoldPrice(ItemId.WAR_HORN)!;
      await setResources(g, p, { gold: price * 3 + 5 });
      expect(await shop.buyItemWithGold(g, p.id, p.cityId, ItemId.WAR_HORN, 2)).toEqual({ itemId: ItemId.WAR_HORN, count: 2, gold: price * 2 });
      expect(await shop.buyItemWithGold(g, p.id, p.cityId, ItemId.WAR_HORN, 1)).toMatchObject({ count: 3 });
      expect((await reloadCity(g, p.cityId)).gold).toBe(5);
      expect(await count(g, p, ItemId.WAR_HORN)).toBe(3);
      expect(g.pushes(PushCmd.ITEM_UPDATE).at(-1)?.data).toEqual({ items: [{ id: ItemId.WAR_HORN, count: 3 }] });
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, resource: { gold: 5 } });
    }));

  it('refuses items not for sale and bad amounts', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(itemGoldPrice(ItemId.WELCOME_PACKAGE)).toBeNull();
      await expectRefused(shop.buyItemWithGold(g, p.id, p.cityId, ItemId.WELCOME_PACKAGE, 1), msg('item.notForSale'));
      await expectRefused(shop.buyItemWithGold(g, p.id, p.cityId, medalId(1), 1), msg('item.notForSale'));
      await expectRefused(shop.buyItemWithGold(g, p.id, p.cityId, 'no.such.item', 1), msg('item.notForSale'));
      for (const n of [0, -1, 1.5, 1001]) await expectRefused(shop.buyItemWithGold(g, p.id, p.cityId, ItemId.WAR_HORN, n), msg('common.invalidAmount'));
    }));

  it('refuses without enough gold, charging nothing', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const price = itemGoldPrice(ItemId.CITY_TELEPORTER)!;
      await setResources(g, p, { gold: price * 2 - 1 });
      await expectRefused(shop.buyItemWithGold(g, p.id, p.cityId, ItemId.CITY_TELEPORTER, 2), msg('common.notEnoughGoldFor', { amount: price * 2 }));
      expect((await reloadCity(g, p.cityId)).gold).toBe(price * 2 - 1);
      expect(await count(g, p, ItemId.CITY_TELEPORTER)).toBe(0);
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(shop.buyItemWithGold(g, a.id, b.cityId, ItemId.WAR_HORN, 1), msg('common.invalidCastle'));
    }));
});

describe(shop.useItem.name, () => {
  it('refuses unknown items, items used elsewhere and items not owned', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(shop.useItem(g, p.id, 'no.such.item', null), msg('item.cannotUse'));
      await expectRefused(shop.useItem(g, p.id, ItemId.NAPOLEONS_DIARY, null), msg('item.useFrom.speedup'));
      await expectRefused(shop.useItem(g, p.id, ItemId.ARCHIMEDES_NOTE, null), msg('item.useFrom.speedup'));
      await expectRefused(shop.useItem(g, p.id, ItemId.BEGINNER_GUIDELINES, null), msg('item.useFrom.speedup'));
      await expectRefused(shop.useItem(g, p.id, ItemId.HOLY_WATER, null), msg('item.useFrom.hero'));
      await expectRefused(shop.useItem(g, p.id, ItemId.EXCALIBUR, null), msg('item.useFrom.hero'));
      await expectRefused(shop.useItem(g, p.id, medalId(3), null), msg('item.useFrom.hero'));
      await expectRefused(shop.useItem(g, p.id, ItemId.CITY_TELEPORTER, p.cityId), msg('item.useFrom.elsewhere'));
      await expectRefused(shop.useItem(g, p.id, ItemId.TRUCE_AGREEMENT, null), msg('item.useFrom.elsewhere'));
      await expectRefused(shop.useItem(g, p.id, ItemId.WAR_HORN, null), msg('common.insufficientItems'));
      await expectRefused(shop.useItem(g, p.id, ItemId.CIVIL_CODE, p.cityId), msg('common.insufficientItems'));
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await giveItems(g, a, { [ItemId.CIVIL_CODE]: 1 });
      await expectRefused(shop.useItem(g, a.id, ItemId.CIVIL_CODE, b.cityId), msg('common.invalidCastle'));
    }));

  it('every boost item starts its buff, with or without a city', () =>
    game(async (g) => {
      expect(BUFF_ITEMS.length).toBeGreaterThan(0);
      for (const [itemId, effect] of BUFF_ITEMS) {
        const p = await createTestPlayer(g);
        await giveItems(g, p, { [itemId]: 1 });
        expect(await shop.useItem(g, p.id, itemId, itemId === ItemId.TAX_POLICY ? p.cityId : null)).toEqual({ itemId });
        const player = await reloadPlayer(g, p);
        expect(player.items[itemId] ?? 0, itemId).toBe(0);
        expect(player.buffs, itemId).toEqual([{ id: effect.buff, desc: effect.desc, endTime: g.now + effect.durationMs, itemId }]);
        expect(g.events('buff.expire').filter((e) => e.playerId === p.id)).toEqual([
          { type: 'buff.expire', dueAt: g.now + effect.durationMs, playerId: p.id, refKey: `buff:${p.id}:${effect.buff}`, payload: { buffId: effect.buff } },
        ]);
        expect(g.pushes(PushCmd.PLAYER_BUFF_UPDATE).at(-1)).toMatchObject({
          playerIds: [p.id],
          data: { buffBean: { typeId: effect.buff, endTime: g.now + effect.durationMs }, updateType: 0 },
        });
      }
    }));

  it('another boost of the same kind extends the one running', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.PLOWSHARES]: 1, [ItemId.IRON_RAKE]: 1 });
      const { short, long } = BALANCE.items.buffDurationMs;
      await shop.useItem(g, p.id, ItemId.PLOWSHARES, null);
      g.advance(1000);
      await shop.useItem(g, p.id, ItemId.IRON_RAKE, null);
      const end = g.now - 1000 + short + long;
      expect((await reloadPlayer(g, p)).buffs).toEqual([expect.objectContaining({ endTime: end, itemId: ItemId.IRON_RAKE })]);
      expect(g.events('buff.expire').map((e) => e.dueAt)).toEqual([end]);
    }));

  it('a production boost settles every city first, at the old rates', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.PLOWSHARES]: 1 });
      g.advance(3_600_000);
      await shop.useItem(g, p.id, ItemId.PLOWSHARES, null);
      expect((await reloadCity(g, p.cityId)).resourcesAt).toBe(g.now);
    }));

  it('the Welcome Package grants items and resources to the city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await count(g, p, ItemId.WELCOME_PACKAGE)).toBe(1);
      const before = await reloadCity(g, p.cityId);
      const pkg = BALANCE.items.welcomePackage;
      const r = await shop.useItem(g, p.id, ItemId.WELCOME_PACKAGE, p.cityId);
      expect(r).toEqual({ itemId: ItemId.WELCOME_PACKAGE, granted: itemEffect(ItemId.WELCOME_PACKAGE) });
      const player = await reloadPlayer(g, p);
      expect(player.items[ItemId.WELCOME_PACKAGE]).toBeUndefined();
      for (const [id, n] of Object.entries(pkg.items)) expect(player.items[id]).toBe(n);
      const city = await reloadCity(g, p.cityId);
      for (const [k, n] of Object.entries(pkg.resources)) expect(city[k as keyof typeof pkg.resources]).toBe(before[k as keyof typeof pkg.resources] + n);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId });
    }));

  it('a grant with resources needs a city, and is kept until one is chosen', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(shop.useItem(g, p.id, ItemId.WELCOME_PACKAGE, null), msg('item.chooseCity'));
      expect(await count(g, p, ItemId.WELCOME_PACKAGE)).toBe(1);
    }));

  it('a medal box holds a few of each of its medals, no city needed', () =>
    game(async (g) => {
      for (const box of [ItemId.JUNIOR_MEDAL_BOX, ItemId.MEDIUM_MEDAL_BOX, ItemId.SENIOR_MEDAL_BOX]) {
        const p = await createTestPlayer(g);
        await giveItems(g, p, { [box]: 1 });
        const r = await shop.useItem(g, p.id, box, null);
        const medals = BALANCE.items.medalBoxes[box].map(medalId);
        expect(Object.keys(r.granted!.items!).sort()).toEqual(medals.sort());
        const player = await reloadPlayer(g, p);
        expect(player.items[box]).toBeUndefined();
        for (const id of medals) {
          expect(player.items[id]).toBe(r.granted!.items![id]);
          expect(player.items[id]).toBeGreaterThanOrEqual(BALANCE.items.medalBoxCount.min);
          expect(player.items[id]).toBeLessThanOrEqual(BALANCE.items.medalBoxCount.max);
        }
      }
    }));

  it('the Civil Code adds people, up to the maximum', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[20, BuildingType.COTTAGE, 3]]);
      await giveItems(g, p, { [ItemId.CIVIL_CODE]: 3 });
      const max = cityStats(await cityBundle(g, p), g.now).maxPopulation;
      const before = (await reloadCity(g, p.cityId)).population;
      await shop.useItem(g, p.id, ItemId.CIVIL_CODE, p.cityId);
      const after = (await reloadCity(g, p.cityId)).population;
      expect(after).toBe(civilCodePopulation(before, max));
      expect(after).toBeGreaterThan(before);
      expect(g.pushes(PushCmd.CASTLE_UPDATE).at(-1)?.data).toMatchObject({ updateType: 2 });

      await setCityStats(g, p, { population: max - 1 });
      await shop.useItem(g, p.id, ItemId.CIVIL_CODE, p.cityId);
      expect((await reloadCity(g, p.cityId)).population).toBe(max);
      expect(await count(g, p, ItemId.CIVIL_CODE)).toBe(1);
    }));

  it('the Civil Code needs a city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.CIVIL_CODE]: 1 });
      await expectRefused(shop.useItem(g, p.id, ItemId.CIVIL_CODE, null), msg('item.chooseCity'));
      expect(await count(g, p, ItemId.CIVIL_CODE)).toBe(1);
    }));

  it('Penicillin heals every injured troop in the city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setInjured(g, p, { peasants: 5, archer: 3 }, { peasants: 2 });
      await giveItems(g, p, { [ItemId.PENICILLIN]: 1 });
      expect(await shop.useItem(g, p.id, ItemId.PENICILLIN, p.cityId)).toEqual({ itemId: ItemId.PENICILLIN });
      const city = await reloadCity(g, p.cityId);
      expect(city.troops).toEqual({ peasants: 7, archer: 3 });
      expect(city.injuredTroops).toEqual({});
      expect(g.pushes(PushCmd.CASTLE_UPDATE).at(-1)?.data).toMatchObject({ castleBean: { troop: { peasants: 7, archer: 3 } } });
      await expectRefused(shop.useItem(g, p.id, ItemId.PENICILLIN, null), msg('common.insufficientItems'));
    }));

  it('Penicillin needs a city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.PENICILLIN]: 1 });
      await expectRefused(shop.useItem(g, p.id, ItemId.PENICILLIN, null), msg('item.chooseCity'));
    }));

  it('a Hero Package hires its hero into a free Feasting Hall seat', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.HERO_PACKAGE]: 2 });
      const noSeat = msg('hero.noVacancy', { building: ref.building(BuildingType.FEASTING_HALL) });
      await expectRefused(shop.useItem(g, p.id, ItemId.HERO_PACKAGE, p.cityId), noSeat);
      await expectRefused(shop.useItem(g, p.id, ItemId.HERO_PACKAGE, null), msg('item.chooseCity'));
      expect(await count(g, p, ItemId.HERO_PACKAGE)).toBe(2);

      await setBuildings(g, p, [[3, BuildingType.FEASTING_HALL, 1]]);
      const r = await shop.useItem(g, p.id, ItemId.HERO_PACKAGE, p.cityId);
      const q = heroBoxQuality(ItemId.HERO_PACKAGE);
      expect(r.hero).toMatchObject({ level: q.level });
      const [hero] = await heroesOfCity(g, p.cityId);
      expect(hero).toMatchObject({ id: r.hero!.id, playerId: p.id, inTavern: false, level: q.level, upgradeExp: upgradeExpFor(q.level), remainPoint: q.level });
      expect(hero.loyalty).toBe(BALANCE.heroMaxLoyalty);
      for (const v of [hero.basePower, hero.baseManagement, hero.baseStratagem]) expect(v).toBeGreaterThanOrEqual(q.minStat);
      expect(g.pushes(PushCmd.HERO_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, updateType: 0 });
      expect(await count(g, p, ItemId.HERO_PACKAGE)).toBe(1);

      await expectRefused(shop.useItem(g, p.id, ItemId.HERO_PACKAGE, p.cityId), noSeat);
    }));
});
