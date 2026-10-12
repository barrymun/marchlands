// Static configuration, the shop and quests.

import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, getGameSpeed, ITEMS, itemGoldPrice, ItemId } from '@marchlands/core';
import type { PlayerState, QuestBean, QuestGroupStatus, ShopCategory, StaticConfig } from '@marchlands/contracts';
import { admin } from '@marchlands/game';
import { apiTest, type TestApi } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsPlayer, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

const PLAYER_ROUTES: RouteCall[] = [
  { method: 'POST', url: 'cities/1/shop/gold', body: { itemId: ItemId.WAR_HORN } },
  { method: 'GET', url: 'quests/groups' },
  { method: 'GET', url: 'quests' },
  { method: 'POST', url: 'quests/1/claim', body: { cityId: 1 } },
  { method: 'POST', url: 'quests/daily-gift', body: { cityId: 1 } },
];

const state = (api: TestApi, p: { token: string }) => api.ok<PlayerState>('GET', 'player', { token: p.token });

describe('authentication', () => {
  it('the shop and quests need a token; the catalogue alone needs no player', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, [...PLAYER_ROUTES, { method: 'GET', url: 'shop' }]);
      const a = await accountWithoutPlayer(api);
      await expectNeedsPlayer(api, a.token, PLAYER_ROUTES);
      expect(await api.ok('GET', 'shop', { token: a.token })).toEqual(expect.any(Array));
    }));
});

describe('GET /config/static', () => {
  it('answers the game data without a token, items without names or cent prices', () =>
    apiTest(async (api) => {
      const c = await api.ok<StaticConfig>('GET', 'config/static');
      expect(c).toMatchObject({
        gameSpeed: getGameSpeed(),
        mapSize: BALANCE.mapSize,
        balance: expect.objectContaining({ allianceCreateGold: BALANCE.allianceCreateGold }),
      });
      expect(c.buildings).toHaveLength(BUILDINGS.length);
      expect(c.items).toHaveLength(ITEMS.length);
      const horn = c.items.find((i) => i.id === ItemId.WAR_HORN)!;
      expect(horn).toMatchObject({ goldPrice: itemGoldPrice(ItemId.WAR_HORN), description: expect.any(Object) });
      expect(horn).not.toHaveProperty('name');
      expect(horn).not.toHaveProperty('cost');
      expect(c.questGroups[0]).not.toHaveProperty('name');
    }));
});

describe('GET /shop', () => {
  it('answers the items for sale by category, priced in gold', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const shop = await api.ok<ShopCategory[]>('GET', 'shop', { token: p.token });
      const items = shop.flatMap((c) => c.items);
      expect(items).toContainEqual({ id: ItemId.WAR_HORN, price: itemGoldPrice(ItemId.WAR_HORN), dayLimit: expect.any(Number) });
      expect(shop.map((c) => c.typeId)).toEqual([...shop.map((c) => c.typeId)].sort((a, b) => a - b));
    }));
});

describe('POST /cities/:cityId/shop/gold', () => {
  it("buys items with the city's gold", () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.game((ctx) => admin.setResources(ctx, p.cityId, p.playerId, { gold: 1_000_000 }));
      const price = itemGoldPrice(ItemId.WAR_HORN)!;
      const r = await api.ok('POST', `cities/${p.cityId}/shop/gold`, { token: p.token, body: { itemId: ItemId.WAR_HORN, amount: 2 } });
      expect(r).toEqual({ itemId: ItemId.WAR_HORN, count: 2, gold: price * 2 });
      const s = await state(api, p);
      expect(s.items).toContainEqual({ id: ItemId.WAR_HORN, count: 2 });
      expect(s.castles[0].resource.gold).toBe(1_000_000 - price * 2);
    }));

  it("refuses an item not for sale, another player's city (403), and validates the body", () =>
    apiTest(async (api) => {
      const p = await api.player();
      const other = await api.player();
      await api.refused('POST', `cities/${p.cityId}/shop/gold`, 'item.notForSale', { token: p.token, body: { itemId: 'no.such.item' }, status: 400 });
      await api.refused('POST', `cities/${other.cityId}/shop/gold`, 'common.invalidCastle', { token: p.token, body: { itemId: ItemId.WAR_HORN }, status: 403 });
      await expectInvalid(api, p.token, [
        { method: 'POST', url: `cities/${p.cityId}/shop/gold`, body: { itemId: ItemId.WAR_HORN, amount: 0 } },
        { method: 'POST', url: `cities/${p.cityId}/shop/gold`, body: { itemId: ItemId.WAR_HORN, amount: 1001 } },
        { method: 'POST', url: `cities/${p.cityId}/shop/gold`, body: {} },
      ]);
    }));
});

describe('GET /quests/groups', () => {
  it('answers the quest groups, flagging those with a quest to claim', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const groups = await api.ok<QuestGroupStatus[]>('GET', 'quests/groups', { token: p.token });
      expect(groups[0]).toEqual({ id: expect.any(Number), typeId: expect.any(Number), isFinish: expect.any(Boolean) });
      // a new player has a quest to claim (fair taxes)
      expect(groups.some((g) => g.isFinish)).toBe(true);
    }));
});

describe('GET /quests', () => {
  it('answers the quests with their progress, or one group', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const all = await api.ok<QuestBean[]>('GET', 'quests', { token: p.token });
      expect(all[0]).toMatchObject({ questId: expect.any(Number), groupId: expect.any(Number), description: { code: expect.any(String) }, claimed: false });
      const groupId = all[0].groupId;
      const one = await api.ok<QuestBean[]>('GET', `quests?groupId=${groupId}`, { token: p.token });
      expect(one.length).toBeGreaterThan(0);
      expect(one.every((q) => q.groupId === groupId)).toBe(true);
      await expectInvalid(api, p.token, [{ method: 'GET', url: 'quests?groupId=first' }]);
    }));
});

describe('POST /quests/:questId/claim', () => {
  it('pays a finished quest into the city, once', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const quest = (await api.ok<QuestBean[]>('GET', 'quests', { token: p.token })).find((q) => q.isFinish && !q.claimed)!;
      const gold = (await state(api, p)).castles[0].resource.gold;
      expect(await api.ok('POST', `quests/${quest.questId}/claim`, { token: p.token, body: { cityId: p.cityId } })).toEqual(quest.award);
      expect((await state(api, p)).castles[0].resource.gold).toBeGreaterThanOrEqual(gold + (quest.award.resources?.gold ?? 0));
      await api.refused('POST', `quests/${quest.questId}/claim`, 'quest.alreadyClaimed', { token: p.token, body: { cityId: p.cityId }, status: 400 });
    }));

  it('refuses an unknown quest (404), an unfinished one, and validates the request', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const open = (await api.ok<QuestBean[]>('GET', 'quests', { token: p.token })).find((q) => !q.isFinish)!;
      await api.refused('POST', 'quests/999999/claim', 'quest.notFound', { token: p.token, body: { cityId: p.cityId }, status: 404 });
      await api.refused('POST', `quests/${open.questId}/claim`, 'quest.notFinished', { token: p.token, body: { cityId: p.cityId }, status: 400 });
      await expectInvalid(api, p.token, [
        { method: 'POST', url: `quests/${open.questId}/claim`, body: {} },
        { method: 'POST', url: 'quests/abc/claim', body: { cityId: p.cityId } },
      ]);
    }));
});

describe('POST /quests/daily-gift', () => {
  it('adds the daily resources to the city, once a day', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.game((ctx) => admin.setResources(ctx, p.cityId, p.playerId, { gold: 0 }));
      expect(await api.ok('POST', 'quests/daily-gift', { token: p.token, body: { cityId: p.cityId } })).toEqual({ resources: BALANCE.dailyGift });
      expect((await state(api, p)).castles[0].resource.gold).toBeGreaterThanOrEqual(BALANCE.dailyGift.gold);
      await api.refused('POST', 'quests/daily-gift', 'quest.dailyGiftClaimed', { token: p.token, body: { cityId: p.cityId }, status: 400 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'quests/daily-gift', body: { cityId: 'home' } }]);
    }));
});
