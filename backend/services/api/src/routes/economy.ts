// Market, shop, quests, rankings, static game configuration and operator tools.

import { z } from 'zod';
import {
  BALANCE,
  BUILDINGS,
  BUILDING_NAMES,
  ITEMS,
  QUESTS,
  RESEARCH,
  STATE_NAMES,
  TECH_NAMES,
  TITLES,
  TROOPS,
  getGameSpeed,
} from '@evony/core';
import { admin, market, quests, rankings, runGame, shop } from '@evony/game';
import { doc, anon, authenticate, game, requireAdmin, tags, zCityParams, zId, zPaging, zResources, type ZApp } from '../http.ts';

export default async function economyRoutes(app: ZApp) {
  const s = doc;

  // ---- static configuration (public) ----
  app.get('/config/static', { schema: { tags: tags.config, summary: 'Buildings, research, troops, items, titles and balance constants' } }, async () => ({
    ok: 1,
    data: {
      gameSpeed: getGameSpeed(),
      mapSize: BALANCE.mapSize,
      states: STATE_NAMES,
      buildingNames: BUILDING_NAMES,
      techNames: TECH_NAMES,
      buildings: BUILDINGS,
      research: RESEARCH,
      troops: TROOPS,
      items: ITEMS,
      questGroups: QUESTS,
      titles: TITLES,
      balance: BALANCE,
    },
  }));

  app.register(async (secure: ZApp) => {
    secure.addHook('preHandler', authenticate);

    // ---- market ----
    secure.get('/market/:resType', s(tags.market, 'Order book: 0 food, 1 wood, 2 stone, 3 iron (trade.searchTrades)', { params: z.object({ resType: z.coerce.number().int() }) }), (req) =>
      anon(req, (ctx) => market.orderBook(ctx, req.params.resType)),
    );
    secure.get('/market/orders/mine', s(tags.market, 'My open orders (trade.getMyTradeList)'), (req) => game(req, (ctx, pid) => market.myOrders(ctx, pid)));
    secure.post(
      '/cities/:cityId/market/orders',
      s(tags.market, 'Place an order: side 0 buy, 1 sell (trade.newTrade)', {
        params: zCityParams,
        body: z.object({ resType: z.number().int(), side: z.number().int(), amount: z.number().int(), price: z.number() }),
      }),
      (req) => game(req, (ctx, pid) => market.placeOrder(ctx, pid, req.params.cityId, req.body)),
    );
    secure.delete('/market/orders/:orderId', s(tags.market, 'Cancel (trade.cancelTrade)', { params: z.object({ orderId: zId }) }), (req) =>
      game(req, (ctx, pid) => market.cancelOrder(ctx, pid, req.params.orderId)),
    );
    secure.get('/market/shipments', s(tags.market, 'Goods in transit (trade.getTransingTradeList)'), (req) => game(req, (ctx, pid) => market.myShipments(ctx, pid)));
    secure.post('/market/shipments/:shipmentId/speedup', s(tags.market, 'Instant delivery for cents (trade.speedUpTrans)', { params: z.object({ shipmentId: zId }) }), (req) =>
      game(req, (ctx, pid) => market.speedupShipment(ctx, pid, req.params.shipmentId)),
    );

    // ---- shop ----
    secure.get('/shop', s(tags.shop, 'Items for sale (saleTypeBeans)'), async () => ({ ok: 1, data: shop.catalogue() }));
    secure.post('/shop/buy', s(tags.shop, 'Buy items with cents (shop.buy)', { body: z.object({ itemId: z.string(), amount: z.number().int().default(1) }) }), (req) =>
      game(req, (ctx, pid) => shop.buyItem(ctx, pid, req.body.itemId, req.body.amount)),
    );
    secure.get('/shop/resources', s(tags.shop, 'Resources per cent (shop.getBuyResourceInfo)'), async () => ({ ok: 1, data: shop.resourceRates() }));
    secure.post(
      '/cities/:cityId/shop/resources',
      s(tags.shop, 'Spend cents on resources (shop.buyResource)', {
        params: zCityParams,
        body: z.object({ food: z.number().int(), wood: z.number().int(), stone: z.number().int(), iron: z.number().int() }).partial(),
      }),
      (req) => game(req, (ctx, pid) => shop.buyResources(ctx, pid, req.params.cityId, req.body)),
    );

    // ---- quests ----
    secure.get('/quests/groups', s(tags.quests, 'Quest groups (quest.getQuestType)'), (req) => game(req, (ctx, pid) => quests.questTypes(ctx, pid)));
    secure.get('/quests', s(tags.quests, 'Quests with progress (quest.getQuestList)', { querystring: z.object({ groupId: z.coerce.number().int().optional() }) }), (req) =>
      game(req, (ctx, pid) => quests.questList(ctx, pid, req.query.groupId)),
    );
    secure.post('/quests/:questId/claim', s(tags.quests, 'Claim the award into a city (quest.award)', { params: z.object({ questId: zId }), body: z.object({ cityId: zId }) }), (req) =>
      game(req, (ctx, pid) => quests.claimQuest(ctx, pid, req.params.questId, req.body.cityId)),
    );
    secure.post('/quests/daily-gift', s(tags.quests, 'Daily gift'), (req) => game(req, (ctx, pid) => quests.claimDailyGift(ctx, pid)));

    // ---- rankings ----
    const rq = zPaging.extend({ sortType: z.coerce.number().int().default(2), key: z.string().default('') });
    secure.get('/rankings/players', s(tags.rankings, 'sortType 1 title, 2 prestige, 3 honor, 4 cities, 5 population (rank.getPlayerRank)', { querystring: rq }), (req) =>
      anon(req, (ctx) => rankings.playerRanking(ctx, req.query.sortType, req.query.pageNo, req.query.pageSize, req.query.key)),
    );
    secure.get('/rankings/alliances', s(tags.rankings, 'sortType 1 members, 2 prestige, 3 honor (rank.getAllianceRank)', { querystring: rq }), (req) =>
      anon(req, (ctx) => rankings.allianceRanking(ctx, req.query.sortType, req.query.pageNo, req.query.pageSize, req.query.key)),
    );
    secure.get('/rankings/heroes', s(tags.rankings, 'sortType 1 level, 2 management, 3 power, 4 stratagem (rank.getHeroRank)', { querystring: rq }), (req) =>
      anon(req, (ctx) => rankings.heroRanking(ctx, req.query.sortType, req.query.pageNo, req.query.pageSize, req.query.key)),
    );
    secure.get('/rankings/castles', s(tags.rankings, 'sortType 1 population, 2 level (rank.getCastleRank)', { querystring: rq }), (req) =>
      anon(req, (ctx) => rankings.castleRanking(ctx, req.query.sortType, req.query.pageNo, req.query.pageSize, req.query.key)),
    );

    // ---- operator tools (accounts with is_admin) ----
    secure.register(async (gm: ZApp) => {
      gm.addHook('preHandler', requireAdmin);
      const t = tags.admin;
      const db = app.deps.db;
      const run = <T>(fn: Parameters<typeof runGame<T>>[1]) => runGame(db, fn).then((data) => ({ ok: 1, data: data ?? null }));
      gm.post('/admin/items', s(t, 'Grant items (gamemaster.addItems)', { body: z.object({ playerName: z.string(), items: z.record(z.string(), z.number().int()) }) }), (req) =>
        run((ctx) => admin.grantItems(ctx, req.body.playerName, req.body.items)),
      );
      gm.post('/admin/cents', s(t, 'Grant cents', { body: z.object({ playerName: z.string(), cents: z.number().int() }) }), (req) =>
        run((ctx) => admin.grantCents(ctx, req.body.playerName, req.body.cents)),
      );
      gm.put('/admin/cities/:cityId/resources', s(t, 'Set resources (gamemaster.setResources)', { params: zCityParams, body: zResources.extend({ playerId: zId }) }), (req) =>
        run((ctx) => admin.setResources(ctx, req.params.cityId, req.body.playerId, req.body)),
      );
      gm.put(
        '/admin/cities/:cityId/buildings',
        s(t, 'Set a building level, 0 removes (gamemaster.addBuilding / removeBuilding)', {
          params: zCityParams,
          body: z.object({ playerId: zId, positionId: z.number().int(), typeId: z.number().int(), level: z.number().int() }),
        }),
        (req) => run((ctx) => admin.setBuilding(ctx, req.params.cityId, req.body.playerId, req.body.positionId, req.body.typeId, req.body.level)),
      );
      gm.put('/admin/research', s(t, 'Set a technology level (gamemaster.setTechnology)', { body: z.object({ playerName: z.string(), techId: z.number().int(), level: z.number().int() }) }), (req) =>
        run((ctx) => admin.setTechnology(ctx, req.body.playerName, req.body.techId, req.body.level)),
      );
      gm.post('/admin/cities/:cityId/heroes', s(t, 'Add a random hero (gamemaster.addHero)', { params: zCityParams, body: z.object({ playerId: zId, innLevel: z.number().int().default(10) }) }), (req) =>
        run((ctx) => admin.addHero(ctx, req.params.cityId, req.body.playerId, req.body.innLevel)),
      );
      gm.post('/admin/accounts/:accountId/ban', s(t, 'Ban / unban an account', { params: z.object({ accountId: zId }), body: z.object({ banned: z.boolean(), reason: z.string().default('') }) }), (req) =>
        run((ctx) => admin.setBan(ctx, req.params.accountId, req.body.banned, req.body.reason)),
      );
      gm.post('/admin/mute', s(t, 'Mute a lord in chat (common.denyPlayerSpeak)', { body: z.object({ playerName: z.string(), minutes: z.number().int().min(0) }) }), (req) =>
        run((ctx) => admin.mute(ctx, req.body.playerName, req.body.minutes)),
      );
      gm.post('/admin/broadcast', s(t, 'System message to everyone (\\massmsg)', { body: z.object({ msg: z.string(), tv: z.boolean().default(true) }) }), (req) =>
        run(async (ctx) => admin.broadcast(ctx, req.body.msg, req.body.tv)),
      );
      gm.post('/admin/mail', s(t, 'System mail to a lord', { body: z.object({ playerName: z.string(), title: z.string(), content: z.string() }) }), (req) =>
        run((ctx) => admin.mailPlayer(ctx, req.body.playerName, req.body.title, req.body.content)),
      );
      gm.put(
        '/admin/players/flags',
        s(t, 'Beginner protection / title', { body: z.object({ playerName: z.string(), beginner: z.boolean().optional(), title: z.number().int().optional() }) }),
        (req) => run((ctx) => admin.setPlayerFlags(ctx, req.body.playerName, req.body)),
      );
      gm.put(
        '/admin/cities/:cityId/stats',
        s(t, 'Population / loyalty / troops', {
          params: zCityParams,
          body: z.object({ playerId: zId, population: z.number().optional(), loyalty: z.number().optional(), troops: z.record(z.string(), z.number().int().nonnegative()).optional() }),
        }),
        (req) => run((ctx) => admin.setCityStats(ctx, req.params.cityId, req.body.playerId, req.body)),
      );
      gm.get('/admin/online', s(t, 'Connected lords'), async () => ({ ok: 1, data: { online: app.deps.online() } }));
    });
  });

}
