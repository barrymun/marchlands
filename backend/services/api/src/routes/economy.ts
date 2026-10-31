// Market, shop, quests, rankings, static game configuration and operator tools.

import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  AccountIdParams,
  AdminAddedHero,
  AdminAddHeroBody,
  AdminBanBody,
  AdminBroadcastBody,
  AdminCityStatsBody,
  AdminGrantItemsBody,
  AdminMailBody,
  AdminMuteBody,
  AdminOnline,
  AdminPlayerFlagsBody,
  AdminSetBuildingBody,
  AdminSetResourcesBody,
  AdminSetTechnologyBody,
  ClaimQuestBody,
  Empty,
  ErrorResponse,
  FactionGold,
  GoldShopBuyBody,
  GoldShopBuyResult,
  MarketAffordable,
  MarketAffordableQuery,
  MarketBookQuery,
  MarketHistory,
  MarketHistoryQuery,
  MarketMyTrade,
  MarketOrder,
  MarketOrderBook,
  MarketPlaceOrderResult,
  MarketQuote,
  MarketQuoteQuery,
  MarketResTypeParams,
  MarketShipment,
  MarketSummary,
  Ok,
  OrderIdParams,
  PlaceOrderBody,
  QuestAward,
  QuestBean,
  QuestDailyGift,
  QuestGroupStatus,
  QuestIdParams,
  QuestListQuery,
  RankingAlliancePage,
  RankingCastlePage,
  RankingHeroPage,
  RankingPlayerPage,
  RankingQuery,
  ShipmentIdParams,
  ShopCategory,
  StaticConfig,
} from '@marchlands/contracts';
import { BALANCE, BUILDINGS, dur, getGameSpeed, itemGoldPrice, itemInfo, ITEMS, msg, QUESTS, RESEARCH, TITLES, TROOPS } from '@marchlands/core';
import { admin, factions, market, quests, rankings, runGame, shop } from '@marchlands/game';

import { anon, authenticate, claimsOf, type Data, doc, game, maybePlayerIdOf, requireAdmin, tags, type ZApp, zCityParams } from '#/http.ts';
import { OrderLimit } from '#/market/order-limit.ts';

export default async function economyRoutes(app: ZApp) {
  const s = doc;
  const orderLimit = new OrderLimit(BALANCE.marketOrderLimit);
  /** Placing and cancelling orders: refused with 429 and Retry-After once the player has used up BALANCE.marketOrderLimit. */
  const limitOrders = async (req: FastifyRequest, reply: FastifyReply) => {
    const wait = orderLimit.take(claimsOf(req).sub);
    if (wait > 0) {
      const seconds = Math.ceil(wait / 1000);
      return reply
        .status(429)
        .header('retry-after', String(seconds))
        .send({ ok: -99, error: msg('market.slowDown', { wait: dur(seconds * 1000) }) });
    }
  };

  // ---- static configuration (public) ----
  app.get(
    '/config/static',
    {
      schema: {
        tags: tags.config,
        summary: 'Buildings, research, troops, items, titles and balance constants',
        response: { 200: Ok(StaticConfig), '4xx': ErrorResponse, '5xx': ErrorResponse },
      },
    },
    async () => ({
      ok: 1 as const,
      data: {
        gameSpeed: getGameSpeed(),
        mapSize: BALANCE.mapSize,
        buildings: BUILDINGS,
        research: RESEARCH,
        troops: TROOPS,
        // names are not sent: the client names items, quests and titles by id in the player's language
        // every item has its info (core builds it from the same list)
        items: ITEMS.flatMap(({ cost: _cents, buyable: _buyable, canGamble: _gamble, name: _name, ...i }) => {
          const info = itemInfo(i.id);
          if (!info) return [];
          const { description, use, howTo } = info;
          return [{ ...i, goldPrice: itemGoldPrice(i.id), description, use, howTo }];
        }),
        questGroups: QUESTS.map(({ name: _name, description: _description, ...q }) => q),
        titles: TITLES,
        balance: BALANCE,
      },
    }),
  );

  app.register(async (secure: ZApp) => {
    secure.addHook('onRequest', authenticate);

    // ---- market ----
    secure.get(
      '/market/:resType',
      s(tags.market, 'Order book: 0 food, 1 wood, 2 stone, 3 iron (trade.searchTrades); the factions on the terms a city gets', MarketOrderBook, {
        params: MarketResTypeParams,
        querystring: MarketBookQuery,
      }),
      (req) => {
        const { cityId } = req.query;
        return cityId == null
          ? anon(req, (ctx) => market.orderBook(ctx, req.params.resType))
          : game(req, (ctx, pid) => market.orderBook(ctx, req.params.resType, { playerId: pid, cityId }));
      },
    );
    secure.get(
      '/market/:resType/quote',
      s(tags.market, 'Preview an order: what would trade now, at what average price, and what would rest', MarketQuote, {
        params: MarketResTypeParams,
        querystring: MarketQuoteQuery,
      }),
      (req) => game(req, (ctx, pid) => market.quote(ctx, pid, { resType: req.params.resType, ...req.query })),
    );
    secure.get(
      '/market/:resType/history',
      s(tags.market, 'Recent trades and price candles of a minute, an hour or a day (real time)', MarketHistory, {
        params: MarketResTypeParams,
        querystring: MarketHistoryQuery,
      }),
      (req) => anon(req, (ctx) => market.history(ctx, req.params.resType, req.query.period, req.query.limit)),
    );
    secure.get(
      '/factions',
      s(
        tags.market,
        "The NPC factions' gold now, their treasuries and the player's standing with each (0 for an account without a player)",
        z.array(FactionGold),
      ),
      async (req) => {
        const pid = await maybePlayerIdOf(req.server.deps.db, req);
        return anon(req, (ctx) => factions.list(ctx, pid));
      },
    );
    secure.get('/market/summary', s(tags.market, "Every resource's price now, the merchant's quotes and its last 24 hours", z.array(MarketSummary)), (req) =>
      anon(req, (ctx) => market.summary(ctx)),
    );
    secure.get(
      '/market/:resType/affordable',
      s(tags.market, 'The most units an amount of gold buys now with an instant order, the fee included', MarketAffordable, {
        params: MarketResTypeParams,
        querystring: MarketAffordableQuery,
      }),
      (req) => game(req, (ctx, pid) => market.affordable(ctx, pid, req.params.resType, req.query.gold, req.query.cityId)),
    );
    secure.get('/market/trades/mine', s(tags.market, "The player's latest trades, newest first", z.array(MarketMyTrade)), (req) =>
      game(req, (ctx, pid) => market.myTrades(ctx, pid)),
    );
    secure.get('/market/orders/mine', s(tags.market, 'My open orders (trade.getMyTradeList)', z.array(MarketOrder)), (req) =>
      game(req, (ctx, pid) => market.myOrders(ctx, pid)),
    );
    secure.post(
      '/cities/:cityId/market/orders',
      {
        ...s(
          tags.market,
          'Place an order: side 0 buy, 1 sell; limit or market; settles instantly (trade.newTrade); limited per player',
          MarketPlaceOrderResult,
          {
            params: zCityParams,
            body: PlaceOrderBody,
          },
        ),
        preHandler: limitOrders,
      },
      (req) => game(req, (ctx, pid) => market.placeOrder(ctx, pid, req.params.cityId, req.body)),
    );
    secure.delete(
      '/market/orders/:orderId',
      { ...s(tags.market, 'Cancel (trade.cancelTrade); limited per player, with placing', Empty, { params: OrderIdParams }), preHandler: limitOrders },
      (req) => game(req, (ctx, pid) => market.cancelOrder(ctx, pid, req.params.orderId)),
    );
    secure.get('/market/shipments', s(tags.market, 'Goods in transit (trade.getTransingTradeList)', z.array(MarketShipment)), (req) =>
      game(req, (ctx, pid) => market.myShipments(ctx, pid)),
    );
    secure.post(
      '/market/shipments/:shipmentId/speedup',
      s(tags.market, 'Instant delivery, paid with the gold of the city receiving it (trade.speedUpTrans)', Empty, { params: ShipmentIdParams }),
      (req) => game(req, (ctx, pid) => market.speedupShipment(ctx, pid, req.params.shipmentId)),
    );

    // ---- shop ----
    secure.get('/shop', s(tags.shop, 'Items for sale (saleTypeBeans)', z.array(ShopCategory)), async () => ({ ok: 1 as const, data: shop.catalogue() }));
    secure.post(
      '/cities/:cityId/shop/gold',
      s(tags.shop, 'Buy items with the city gold (itemGoldPrice)', GoldShopBuyResult, { params: zCityParams, body: GoldShopBuyBody }),
      (req) => game(req, (ctx, pid) => shop.buyItemWithGold(ctx, pid, req.params.cityId, req.body.itemId, req.body.amount)),
    );

    // ---- quests ----
    secure.get('/quests/groups', s(tags.quests, 'Quest groups (quest.getQuestType)', z.array(QuestGroupStatus)), (req) =>
      game(req, (ctx, pid) => quests.questTypes(ctx, pid)),
    );
    secure.get('/quests', s(tags.quests, 'Quests with progress (quest.getQuestList)', z.array(QuestBean), { querystring: QuestListQuery }), (req) =>
      game(req, (ctx, pid) => quests.questList(ctx, pid, req.query.groupId)),
    );
    secure.post(
      '/quests/:questId/claim',
      s(tags.quests, 'Claim the award into a city (quest.award)', QuestAward, { params: QuestIdParams, body: ClaimQuestBody }),
      (req) => game(req, (ctx, pid) => quests.claimQuest(ctx, pid, req.params.questId, req.body.cityId)),
    );
    secure.post(
      '/quests/daily-gift',
      s(tags.quests, 'Daily gift: a fixed bundle of resources into a city, once a day', QuestDailyGift, { body: ClaimQuestBody }),
      (req) => game(req, (ctx, pid) => quests.claimDailyGift(ctx, pid, req.body.cityId)),
    );

    // ---- rankings ----
    secure.get(
      '/rankings/players',
      s(tags.rankings, 'sortType 1 title, 2 prestige, 3 honor, 4 cities, 5 population (rank.getPlayerRank)', RankingPlayerPage, { querystring: RankingQuery }),
      (req) => anon(req, (ctx) => rankings.playerRanking(ctx, req.query.sortType, req.query.pageNo, req.query.pageSize, req.query.key)),
    );
    secure.get(
      '/rankings/alliances',
      s(tags.rankings, 'sortType 1 members, 2 prestige, 3 honor (rank.getAllianceRank)', RankingAlliancePage, { querystring: RankingQuery }),
      (req) => anon(req, (ctx) => rankings.allianceRanking(ctx, req.query.sortType, req.query.pageNo, req.query.pageSize, req.query.key)),
    );
    secure.get(
      '/rankings/heroes',
      s(tags.rankings, 'sortType 1 level, 2 management, 3 power, 4 stratagem (rank.getHeroRank)', RankingHeroPage, { querystring: RankingQuery }),
      (req) => anon(req, (ctx) => rankings.heroRanking(ctx, req.query.sortType, req.query.pageNo, req.query.pageSize, req.query.key)),
    );
    secure.get(
      '/rankings/castles',
      s(tags.rankings, 'sortType 1 population, 2 level (rank.getCastleRank)', RankingCastlePage, { querystring: RankingQuery }),
      (req) => anon(req, (ctx) => rankings.castleRanking(ctx, req.query.sortType, req.query.pageNo, req.query.pageSize, req.query.key)),
    );

    // ---- operator tools (accounts with is_admin) ----
    secure.register(async (gm: ZApp) => {
      gm.addHook('onRequest', requireAdmin);
      const t = tags.admin;
      const db = app.deps.db;
      const run = <T>(fn: Parameters<typeof runGame<T>>[1]) => runGame(db, fn).then((data) => ({ ok: 1 as const, data: (data ?? null) as Data<T> }));
      gm.post('/admin/items', s(t, 'Grant items (gamemaster.addItems)', Empty, { body: AdminGrantItemsBody }), (req) =>
        run((ctx) => admin.grantItems(ctx, req.body.playerName, req.body.items)),
      );
      gm.put(
        '/admin/cities/:cityId/resources',
        s(t, 'Set resources (gamemaster.setResources)', Empty, { params: zCityParams, body: AdminSetResourcesBody }),
        (req) => run((ctx) => admin.setResources(ctx, req.params.cityId, req.body.playerId, req.body)),
      );
      gm.put(
        '/admin/cities/:cityId/buildings',
        s(t, 'Set a building level, 0 removes (gamemaster.addBuilding / removeBuilding)', Empty, { params: zCityParams, body: AdminSetBuildingBody }),
        (req) => run((ctx) => admin.setBuilding(ctx, req.params.cityId, req.body.playerId, req.body.positionId, req.body.typeId, req.body.level)),
      );
      gm.put('/admin/research', s(t, 'Set a technology level (gamemaster.setTechnology)', Empty, { body: AdminSetTechnologyBody }), (req) =>
        run((ctx) => admin.setTechnology(ctx, req.body.playerName, req.body.techId, req.body.level)),
      );
      gm.post(
        '/admin/cities/:cityId/heroes',
        s(t, 'Add a random hero (gamemaster.addHero)', AdminAddedHero, { params: zCityParams, body: AdminAddHeroBody }),
        (req) => run((ctx) => admin.addHero(ctx, req.params.cityId, req.body.playerId, req.body.innLevel)),
      );
      gm.post('/admin/accounts/:accountId/ban', s(t, 'Ban / unban an account', Empty, { params: AccountIdParams, body: AdminBanBody }), (req) =>
        run((ctx) => admin.setBan(ctx, req.params.accountId, req.body.banned, req.body.reason)),
      );
      gm.post('/admin/mute', s(t, 'Mute a lord in chat (common.denyPlayerSpeak)', Empty, { body: AdminMuteBody }), (req) =>
        run((ctx) => admin.mute(ctx, req.body.playerName, req.body.minutes)),
      );
      gm.post('/admin/broadcast', s(t, 'System message to everyone (\\massmsg)', Empty, { body: AdminBroadcastBody }), (req) =>
        run(async (ctx) => admin.broadcast(ctx, req.body.msg, req.body.tv)),
      );
      gm.post('/admin/mail', s(t, 'System mail to a lord', Empty, { body: AdminMailBody }), (req) =>
        run((ctx) => admin.mailPlayer(ctx, req.body.playerName, req.body.title, req.body.content)),
      );
      gm.put('/admin/players/flags', s(t, 'Beginner protection / title', Empty, { body: AdminPlayerFlagsBody }), (req) =>
        run((ctx) => admin.setPlayerFlags(ctx, req.body.playerName, req.body)),
      );
      gm.put('/admin/cities/:cityId/stats', s(t, 'Population / loyalty / troops', Empty, { params: zCityParams, body: AdminCityStatsBody }), (req) =>
        run((ctx) => admin.setCityStats(ctx, req.params.cityId, req.body.playerId, req.body)),
      );
      gm.get('/admin/online', s(t, 'Connected lords', AdminOnline), async () => ({ ok: 1 as const, data: { online: app.deps.online() } }));
    });
  });
}
