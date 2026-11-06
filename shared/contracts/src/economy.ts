// Market, shop, quests, rankings, static game configuration and operator tools:
// /config/static, /market*, /shop*, /quests*, /rankings/*, /admin/*.

import { z } from 'zod';

import {
  BASIC_RESOURCES,
  CANDLE_PERIODS,
  FACTION_IDS,
  ITEM_USES,
  MARKET_ORDER_TYPES,
  MarketOrderType,
  MessageSchema,
  TRADE_COUNTERPARTIES,
} from '@marchlands/core';

import { Ms, zId, zPaging, zResources } from '#/common.ts';
import { AllianceRow, CityRow, HeroRow, MarketOrderRow, MarketShipmentRow, PlayerRow, QuestProgressRow } from '#/rows.ts';

const int = () => z.number().int();
const ms = () => z.number().int().describe('milliseconds');
const intArray = () => z.array(int()).readonly();
const numArray = () => z.array(z.number()).readonly();

// ---- static configuration ----

const intResources = z.object({ gold: int(), food: int(), wood: int(), stone: int(), iron: int() });

export const ConfigResourceCost = intResources.meta({ id: 'ConfigResourceCost' });
export type ConfigResourceCost = z.infer<typeof ConfigResourceCost>;

const Prereq = z.object({ id: int(), level: int() });

export const ConfigRequirements = z
  .object({
    buildings: z.array(Prereq).describe('building typeId and minimum level'),
    items: z.array(Prereq).describe('legacy item id (ConfigItem.legacyId) and count'),
    techs: z.array(Prereq).describe('techId and minimum level'),
  })
  .meta({ id: 'ConfigRequirements' });
export type ConfigRequirements = z.infer<typeof ConfigRequirements>;

export const ConfigBuildingLevel = z
  .object({
    typeId: int(),
    level: int(),
    buildTime: int().describe('seconds'),
    cost: ConfigResourceCost,
    requires: ConfigRequirements,
    inside: int().describe('1 inside the castle, 2 outside (fields), 3 walls/fortification'),
    limit: int().describe('max count per city (0 = unlimited)'),
  })
  .meta({ id: 'ConfigBuildingLevel' });
export type ConfigBuildingLevel = z.infer<typeof ConfigBuildingLevel>;

export const ConfigResearchLevel = z
  .object({ techId: int(), level: int(), buildTime: int().describe('seconds'), cost: ConfigResourceCost, requires: ConfigRequirements })
  .meta({ id: 'ConfigResearchLevel' });
export type ConfigResearchLevel = z.infer<typeof ConfigResearchLevel>;

export const ConfigTroop = z
  .object({
    troopId: int(),
    buildTime: int().describe('seconds'),
    population: int(),
    cost: ConfigResourceCost,
    inside: int().describe('1 troop (barracks), 2 fortification (walls)'),
    requires: ConfigRequirements,
    life: int(),
    attack: int(),
    defense: int(),
    load: int(),
    upkeep: int().describe('food per hour'),
    speed: int(),
    range: int(),
  })
  .meta({ id: 'ConfigTroop' });
export type ConfigTroop = z.infer<typeof ConfigTroop>;

const itemConfig = z.object({
  legacyId: int(),
  id: z.string().describe('item id; the client names it (data-items)'),
  goldPrice: int().nullable().describe('price in city gold (null: not for sale)'),
  type: int().describe('shop category id; the client names it (data-item-categories)'),
  dayLimit: int(),
  rarity: int(),
  description: MessageSchema.describe('what the item does (`itemInfo.*`), worded by the client'),
  use: z.enum(ITEM_USES).describe('direct: POST /player/items/{id}/use; elsewhere: consumed by another action (see howTo); none: no effect'),
  howTo: MessageSchema.optional().describe('where to use an item consumed by another action (`itemInfo.howTo.*`)'),
});

export const ConfigItem = itemConfig.meta({ id: 'ConfigItem' });
export type ConfigItem = z.infer<typeof ConfigItem>;

export const ConfigQuestGroup = z
  .object({
    id: int(),
    mainId: int(),
    isFinish: z.boolean(),
    typeId: int(),
    requires: z.object({ buildings: z.array(int()), items: z.array(int()), techs: z.array(int()), quests: z.array(int()) }),
  })
  .meta({ id: 'ConfigQuestGroup' });
export type ConfigQuestGroup = z.infer<typeof ConfigQuestGroup>;

export const ConfigTitle = z
  .object({
    id: int().describe('title id; the client names it (data-titles)'),
    maxCities: int().describe('cities a lord with this title may own'),
    prestige: int().describe('prestige required to be promoted to this title'),
    medals: z.record(z.string(), int()).describe('medals consumed by the promotion (item id -> count)'),
  })
  .meta({ id: 'ConfigTitle' });
export type ConfigTitle = z.infer<typeof ConfigTitle>;

export const ConfigBalance = z
  .object({
    mapSize: int(),
    stateGrid: int(),
    baseStorage: int(),
    basePopulation: int(),
    baseProductionPerHour: int(),
    cottagePopulation: intArray().describe('max-population bonus by cottage level (index 0 unused)'),
    fieldFactor: intArray().describe('field multiplier F by level (index 0 unused)'),
    fieldProductionPerF: int(),
    fieldStoragePerF: int(),
    fieldWorkersPerF: int(),
    resourceTechBonusPerLevel: z.number(),
    mayorManagementProductionFactor: z.number(),
    valleyBonus: z.object({ grass: numArray(), lake: numArray(), other: numArray() }).describe('production bonus by valley level (index 0 unused)'),
    stockpileStorageBonusPerLevel: z.number(),
    warehouseProtectPerLevel: intArray(),
    resourceBuffBonus: z.number(),
    cityTickMs: ms(),
    populationStep: z.number(),
    startTaxRate: int(),
    startPopulation: int(),
    heroSalaryPerLevel: int(),
    heroHireCostPerLevel: int(),
    heroAwardCostPerLevel: int(),
    comfortCooldownMs: ms(),
    heroTimeFactor: z.number(),
    techTimeFactor: z.number(),
    demolishRefund: z.number(),
    cancelBuildRefund: z.number(),
    cancelResearchRefund: z.number(),
    cancelTrainInProgressRefund: z.number(),
    cancelTrainQueuedRefund: z.number(),
    disbandRefund: z.number(),
    outerSlotsBase: int(),
    outerSlotsPerTownHall: int(),
    buildQueues: z.number().int(),
    researchQueues: z.number().int(),
    freeSpeedupMs: ms(),
    wallSpace: intArray().describe('wall capacity by wall level (index 0 unused)'),
    fortSpace: z.record(z.number().int(), int()).describe('wall space used per fort unit, by troopId'),
    rallySpotArmiesPerLevel: int(),
    compassSpeedPerLevel: z.number(),
    horsebackSpeedPerLevel: z.number(),
    logisticsLoadPerLevel: z.number(),
    maxRestTimeMs: ms(),
    npcLoyaltyDamagePerAttack: z.tuple([int(), int()]).readonly().describe('[min, max]'),
    npcLoyaltyStart: z.object({ low: int(), high: int() }),
    npcRegenMs: ms(),
    plunderShare: z.number(),
    injuredShare: z.number(),
    medicinePerLevel: z.number(),
    heroExpPerKill: z.number(),
    heroExpPerTrain: z.number(),
    heroExpPerResearch: z.number(),
    heroExpPerBuild: z.number(),
    goldShop: z.record(z.string(), z.number()),
    valleyUpgrade: z.object({ baseGold: z.number(), maxLevel: z.number().int() }),
    beginnerProtectionMs: ms(),
    beginnerTownHallLevel: int(),
    startingResources: int(),
    truceDurationMs: ms(),
    furloughCentsPerDay: int(),
    truceCooldownMs: ms(),
    teleportCooldownMs: ms(),
    allianceCreateGold: int(),
    allianceMaxMembers: int(),
    allianceWarCooldownMs: ms(),
    marketFee: z.number(),
    marketShipmentBaseMs: ms().describe('0 = market trades are instant'),
    marketMaxOrdersPerLevel: int(),
    merchant: z.object({
      fixedPrice: z.number().nullable().describe('when set, the merchant buys and sells everything at this price'),
      basePrice: z.object({ food: z.number(), wood: z.number(), stone: z.number(), iron: z.number() }),
      spread: z.number(),
      depth: int(),
      recoveryHalfLifeMs: ms(),
      band: z.number(),
    }),
    goldPerCent: z.number().describe('gold per cent of the original prices (goldForCents)'),
  })
  .meta({ id: 'ConfigBalance' });
export type ConfigBalance = z.infer<typeof ConfigBalance>;

export const StaticConfig = z
  .object({
    gameSpeed: z.number().describe('timer multiplier (GAME_SPEED)'),
    mapSize: int(),
    buildings: z.array(ConfigBuildingLevel).describe('one row per typeId and level'),
    research: z.array(ConfigResearchLevel).describe('one row per techId and level'),
    troops: z.array(ConfigTroop),
    items: z.array(ConfigItem),
    questGroups: z.array(ConfigQuestGroup),
    titles: z.array(ConfigTitle),
    balance: ConfigBalance,
  })
  .meta({ id: 'StaticConfig' });
export type StaticConfig = z.infer<typeof StaticConfig>;

// ---- market ----

export const MarketResTypeParams = z.object({ resType: z.coerce.number().int() });
export const PlaceOrderBody = z.object({
  resType: z.number().int(),
  side: z.number().int().describe('0 buy, 1 sell'),
  amount: z.number().int(),
  price: z.number().optional().describe('gold per unit; required for limit orders'),
  type: z
    .enum(MARKET_ORDER_TYPES)
    .default(MarketOrderType.LIMIT)
    .describe('limit: unfilled part rests on the book; market: fill now at the best prices, nothing rests'),
});
/** The player's city whose terms with the factions a book, quote or affordable amount uses (the base spread without one). */
const cityQuery = {
  cityId: zId.optional().describe("the player's city to trade from: the factions' prices follow the player's standing with its home faction"),
};
export const MarketBookQuery = z.object(cityQuery);
export const MarketQuoteQuery = z.object({
  ...cityQuery,
  side: z.coerce.number().int(),
  amount: z.coerce.number().int(),
  price: z.coerce.number().optional(),
  type: z.enum(MARKET_ORDER_TYPES).default(MarketOrderType.LIMIT),
});
export const MarketHistoryQuery = z.object({
  period: z.enum(CANDLE_PERIODS).default('hour').describe('candle length in real time'),
  limit: z.coerce.number().int().min(1).max(2000).default(500).describe('the most recent candles, at most this many'),
});
export const MarketAffordableQuery = z.object({ ...cityQuery, gold: z.coerce.number().int().min(0).max(1e15).describe('the gold to spend, fee included') });
export const OrderIdParams = z.object({ orderId: zId });
export const ShipmentIdParams = z.object({ shipmentId: zId });

const resourceName = z.enum(BASIC_RESOURCES);

export const MarketPriceLevel = z.object({ price: z.number(), amount: int().describe('open amount at this price') }).meta({ id: 'MarketPriceLevel' });
export type MarketPriceLevel = z.infer<typeof MarketPriceLevel>;

export const MarketMerchant = z
  .object({
    reference: z.number().describe('current reference price'),
    base: z.number().describe('price the reference drifts back to'),
    bid: z.number().describe('the merchant buys at this price (marginal; falls as it buys)'),
    ask: z.number().describe('the merchant sells at this price (marginal; rises as it sells)'),
  })
  .meta({ id: 'MarketMerchant', description: 'computer merchant: always buys and sells, in unlimited amounts' });
export type MarketMerchant = z.infer<typeof MarketMerchant>;

export const MarketFactions = z
  .object({
    price: z.number().describe("the world price at their stock now, inside the merchant's band"),
    ask: z.number().nullable().describe("they sell at this price (marginal; rises as they sell); null at the band's edge"),
    bid: z.number().nullable().describe("they buy at this price (marginal; falls as they buy); null at the band's edge"),
    sells: int().describe("units they sell before their price reaches the band's edge"),
    buys: int().describe("units they buy before their price reaches the band's edge"),
    sellers: z.array(MarketPriceLevel).describe("what they sell in a few price steps up to the band's edge, best first"),
    buyers: z.array(MarketPriceLevel).describe("what they buy in a few price steps down to the band's edge, best first"),
    spread: z.number().nullable().describe('the spread in these quotes (half each way), set by the standing with the home faction; null when they refuse'),
    refused: z.boolean().describe("the city's home faction won't trade with it: nothing to buy or sell"),
    faction: z.enum(FACTION_IDS).nullable().describe("the city's home faction, the one holding its zone; null without a city"),
    standing: z.number().nullable().describe("the player's standing with it, -100 to 100; null without a city"),
  })
  .meta({
    id: 'MarketFactions',
    description: "the NPC factions: they trade from their shared stock along their price curve, on the terms a city's home faction gives",
  });
export type MarketFactions = z.infer<typeof MarketFactions>;

export const MarketOrderBook = z
  .object({
    resType: int(),
    buyers: z.array(MarketPriceLevel).describe('bids, best (highest) price first'),
    sellers: z.array(MarketPriceLevel).describe('offers, best (lowest) price first'),
    merchant: MarketMerchant,
    factions: MarketFactions.nullable().describe('null before the factions first trade'),
  })
  .meta({ id: 'MarketOrderBook' });
export type MarketOrderBook = z.infer<typeof MarketOrderBook>;

export const MarketOrder = MarketOrderRow.pick({ id: true, resType: true, price: true, amount: true, createdAt: true, cityId: true })
  .extend({
    resourceName,
    tradeType: MarketOrderRow.shape.side.describe('0 buy, 1 sell'),
    dealedTotal: MarketOrderRow.shape.filled.describe('amount filled so far'),
  })
  .meta({ id: 'MarketOrder' });
export type MarketOrder = z.infer<typeof MarketOrder>;

const tradeSummary = {
  filled: int().describe('units traded now'),
  avgPrice: z.number().nullable().describe('average gold per unit of the units traded now'),
  gold: int().describe('gold paid (buy, incl. fee) or received (sell) for the units traded now'),
  fee: int(),
  merchantFilled: int().describe('units traded with the computer merchant'),
  factionsFilled: int().describe('units traded with the NPC factions'),
  playerFilled: int().describe('units traded with other lords'),
  rest: int().describe('units left resting on the book (limit orders)'),
  escrow: int().describe('gold (buy) or goods (sell) held for the resting part'),
};
export const MarketQuote = z.object(tradeSummary).meta({ id: 'MarketQuote' });
export type MarketQuote = z.infer<typeof MarketQuote>;

export const MarketPlaceOrderResult = z
  .object({ ...tradeSummary, order: MarketOrder.nullable().describe('the resting order, or null when nothing rests') })
  .meta({ id: 'MarketPlaceOrderResult' });
export type MarketPlaceOrderResult = z.infer<typeof MarketPlaceOrderResult>;

export const MarketTrade = z
  .object({
    id: int(),
    price: z.number(),
    amount: int(),
    gold: int(),
    takerSide: int().describe('side of the order that triggered the trade: 0 buy, 1 sell'),
    merchant: z.boolean().describe('traded with the computer merchant'),
    factions: z.boolean().describe('traded with the NPC factions'),
    createdAt: Ms,
  })
  .meta({ id: 'MarketTrade' });
const npcGroupRef = z.object({ zone: int().describe('the zone (state) of its cities'), level: int() });
export const MarketNpcTrade = z
  .object({
    at: Ms,
    resource: resourceName,
    amount: int(),
    price: z.number(),
    seller: npcGroupRef,
    buyer: npcGroupRef,
  })
  .meta({ id: 'MarketNpcTrade', description: "a single trade between two factions' groups, made up from an auction to show it" });
export type MarketNpcTrade = z.infer<typeof MarketNpcTrade>;

export const MarketCandle = z
  .object({ t: Ms.describe('bucket start'), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: int() })
  .meta({ id: 'MarketCandle' });
export const MarketHistory = z
  .object({
    resType: int(),
    period: z.enum(CANDLE_PERIODS),
    bucketMs: int().describe('candle length in real ms'),
    merchant: MarketMerchant,
    candles: z.array(MarketCandle).describe('every trade in the world, oldest first; candles without trades are omitted'),
    trades: z.array(MarketTrade).describe('most recent first'),
    ticker: z.array(MarketNpcTrade).describe("the factions' latest trades with each other in this resource, newest first"),
  })
  .meta({ id: 'MarketHistory' });
export type MarketHistory = z.infer<typeof MarketHistory>;

export const MarketAffordable = z
  .object({ amount: int().describe('the most units the gold buys now with an instant order, the fee included') })
  .meta({ id: 'MarketAffordable' });
export type MarketAffordable = z.infer<typeof MarketAffordable>;

export const MarketSummary = z
  .object({
    resType: int(),
    price: z.number().describe("its price now: the factions' world price, or the merchant's reference before they trade"),
    merchant: MarketMerchant,
    day: z
      .object({ open: z.number(), high: z.number(), low: z.number(), volume: int() })
      .nullable()
      .describe('the last 24 hours from hourly candles: the price it opened at, its high and low, the units traded; null when nothing traded'),
  })
  .meta({ id: 'MarketSummary' });
export type MarketSummary = z.infer<typeof MarketSummary>;

export const FactionGold = z
  .object({
    id: z.enum(FACTION_IDS),
    gold: int().describe('the gold the faction holds now: it pays players selling to it with this'),
    treasury: int().describe("what its gold drifts back to: its members' gold in the NPC table"),
    standing: z.number().describe("the player's standing with it, -100 to 100, drifting back to 0"),
  })
  .meta({ id: 'FactionGold' });
export type FactionGold = z.infer<typeof FactionGold>;

export const StateRuler = z
  .object({
    zoneId: int().describe('the state (zone) ruled'),
    playerId: int(),
    player: z.string().describe("the ruler's name"),
    cityId: int().describe('its capital, the held level 16 historic city'),
    tribute: int().describe('the gold a real hour its barbarian cities pay the capital, cut off from their faction'),
  })
  .meta({ id: 'StateRuler' });
export type StateRuler = z.infer<typeof StateRuler>;

export const MarketMyTrade = z
  .object({
    id: int(),
    resType: int(),
    side: int().describe("the player's side: 0 bought, 1 sold"),
    price: z.number(),
    amount: int(),
    gold: int().describe("gold that changed hands, before the buyer's fee"),
    with: z.enum(TRADE_COUNTERPARTIES).describe('who was on the other side'),
    createdAt: Ms,
  })
  .meta({ id: 'MarketMyTrade' });
export type MarketMyTrade = z.infer<typeof MarketMyTrade>;

export const MarketShipment = MarketShipmentRow.pick({ id: true, cityId: true, resType: true, amount: true, price: true, startTime: true, endTime: true })
  .extend({ resourceName: z.string().describe('food | wood | stone | iron | gold (resType 4: sale proceeds or escrow refund)') })
  .meta({ id: 'MarketShipment' });
export type MarketShipment = z.infer<typeof MarketShipment>;

// ---- shop ----

/** Buy items with the city's gold (BALANCE.goldShop). */
export const GoldShopBuyBody = z.object({ itemId: z.string(), amount: z.number().int().min(1).max(1000).default(1) });
export const GoldShopBuyResult = z
  .object({ itemId: z.string(), count: z.number().int().describe('owned after buying'), gold: z.number().describe('gold paid') })
  .meta({ id: 'GoldShopBuyResult' });

export const ShopItem = itemConfig
  .pick({ id: true, dayLimit: true })
  .extend({ price: int().describe('city gold') })
  .meta({ id: 'ShopItem' });
export type ShopItem = z.infer<typeof ShopItem>;

export const ShopCategory = z
  .object({ typeId: int().describe('item category id; the client names it (data-item-categories)'), items: z.array(ShopItem) })
  .meta({ id: 'ShopCategory' });
export type ShopCategory = z.infer<typeof ShopCategory>;

// ---- quests ----

export const QuestListQuery = z.object({ groupId: z.coerce.number().int().optional().describe('QuestGroupStatus.id: only that group') });
export const QuestIdParams = z.object({ questId: zId });
export const ClaimQuestBody = z.object({ cityId: zId });

export const QuestAward = z
  .object({ resources: intResources.partial().optional(), items: z.record(z.string(), int()).optional().describe('item id -> count') })
  .meta({ id: 'QuestAward' });
export type QuestAward = z.infer<typeof QuestAward>;

export const QuestGroupStatus = ConfigQuestGroup.pick({ id: true, typeId: true })
  .extend({ isFinish: z.boolean().describe('the group has finished quests whose award is not claimed yet') })
  .meta({ id: 'QuestGroupStatus' });
export type QuestGroupStatus = z.infer<typeof QuestGroupStatus>;

export const QuestBean = z
  .object({
    questId: QuestProgressRow.shape.questId,
    groupId: int().describe('QuestGroupStatus.id'),
    description: MessageSchema.describe('`questInfo.description.*`, worded by the client (the quest is named by its id)'),
    targets: z.array(z.object({ text: MessageSchema.describe('`questInfo.target.*`, worded by the client'), finished: z.boolean() })),
    award: QuestAward,
    isFinish: z.boolean().describe('all targets met (or already claimed)'),
    claimed: z.boolean(),
  })
  .meta({ id: 'QuestBean' });
export type QuestBean = z.infer<typeof QuestBean>;

export const QuestDailyGift = z
  .object({ resources: zResources.describe('added to the chosen city (BALANCE.dailyGift)') })
  .meta({ id: 'QuestDailyGift', description: '(marchlands) a fixed bundle of resources once a day' });
export type QuestDailyGift = z.infer<typeof QuestDailyGift>;

// ---- rankings ----

export const RankingQuery = zPaging.extend({ sortType: z.coerce.number().int().default(2), key: z.string().default('') });

const rankingPage = <T extends z.ZodType>(entry: T) => z.object({ pageNo: int(), pageSize: int(), totalPage: int(), beans: z.array(entry) });

export const RankingPlayerEntry = PlayerRow.pick({ id: true, flag: true, faceUrl: true })
  .extend({
    ranking: int(),
    userName: PlayerRow.shape.name,
    prestige: int(),
    honor: int(),
    titleId: int(),
    seatTitle: z
      .object({ level: z.number().int().describe('16: Ruler of the state; 18: Sovereign of Atlantis'), zoneId: z.number().int() })
      .nullable()
      .describe('(marchlands) the title the historic cities they hold give them'),
    population: PlayerRow.shape.population,
    castleCount: int(),
    alliance: z.string().describe('alliance name, empty when none'),
    allianceRank: int().nullable().describe('rank inside the alliance (4 Host … 8 Member), null when none'),
  })
  .meta({ id: 'RankingPlayerEntry' });
export type RankingPlayerEntry = z.infer<typeof RankingPlayerEntry>;

export const RankingPlayerPage = rankingPage(RankingPlayerEntry).meta({ id: 'RankingPlayerPage' });
export type RankingPlayerPage = z.infer<typeof RankingPlayerPage>;

export const RankingAllianceEntry = z
  .object({
    rank: int(),
    name: AllianceRow.shape.name,
    member: AllianceRow.shape.memberCount,
    prestige: int(),
    honor: int(),
    city: AllianceRow.shape.cityCount,
    playerName: z.string().describe('current leader, empty when none'),
    createrName: AllianceRow.shape.founderName,
    description: AllianceRow.shape.intro,
  })
  .meta({ id: 'RankingAllianceEntry' });
export type RankingAllianceEntry = z.infer<typeof RankingAllianceEntry>;

export const RankingAlliancePage = rankingPage(RankingAllianceEntry).meta({ id: 'RankingAlliancePage' });
export type RankingAlliancePage = z.infer<typeof RankingAlliancePage>;

export const RankingHeroEntry = HeroRow.pick({ name: true, power: true, management: true, stratagem: true })
  .extend({ rank: int(), grade: HeroRow.shape.level, kind: PlayerRow.shape.name.describe('owner lord') })
  .meta({ id: 'RankingHeroEntry' });
export type RankingHeroEntry = z.infer<typeof RankingHeroEntry>;

export const RankingHeroPage = rankingPage(RankingHeroEntry).meta({ id: 'RankingHeroPage' });
export type RankingHeroPage = z.infer<typeof RankingHeroPage>;

export const RankingCastleEntry = CityRow.pick({ name: true })
  .extend({
    rank: int(),
    level: int().describe('Town Hall level'),
    grade: z.string().describe('"Level <n>"'),
    population: int(),
    kind: PlayerRow.shape.name.describe('owner lord'),
    alliance: z.string().describe('alliance name, empty when none'),
  })
  .meta({ id: 'RankingCastleEntry' });
export type RankingCastleEntry = z.infer<typeof RankingCastleEntry>;

export const RankingCastlePage = rankingPage(RankingCastleEntry).meta({ id: 'RankingCastlePage' });
export type RankingCastlePage = z.infer<typeof RankingCastlePage>;

// ---- operator tools ----

export const AdminGrantItemsBody = z.object({ playerName: z.string(), items: z.record(z.string(), z.number().int()) });
export const AdminSetResourcesBody = zResources.extend({ playerId: zId });
export const AdminSetBuildingBody = z.object({ playerId: zId, positionId: z.number().int(), typeId: z.number().int(), level: z.number().int() });
export const AdminSetTechnologyBody = z.object({ playerName: z.string(), techId: z.number().int(), level: z.number().int() });
export const AdminAddHeroBody = z.object({ playerId: zId, innLevel: z.number().int().default(10) });
export const AccountIdParams = z.object({ accountId: zId });
export const AdminBanBody = z.object({ banned: z.boolean(), reason: z.string().default('') });
export const AdminMuteBody = z.object({ playerName: z.string(), minutes: z.number().int().min(0) });
export const AdminBroadcastBody = z.object({ msg: z.string(), tv: z.boolean().default(true) });
export const AdminMailBody = z.object({ playerName: z.string(), title: z.string(), content: z.string() });
export const AdminPlayerFlagsBody = z.object({ playerName: z.string(), beginner: z.boolean().optional(), title: z.number().int().optional() });
export const AdminCityStatsBody = z.object({
  playerId: zId,
  population: z.number().optional(),
  troops: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

export const AdminAddedHero = HeroRow.shape.id.describe('id of the new hero').meta({ id: 'AdminAddedHero' });
export type AdminAddedHero = z.infer<typeof AdminAddedHero>;

export const AdminOnline = z.object({ online: int().describe('lords with at least one open WebSocket') }).meta({ id: 'AdminOnline' });
export type AdminOnline = z.infer<typeof AdminOnline>;
