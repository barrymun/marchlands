// Market, shop, quests, rankings, static game configuration and operator tools:
// /config/static, /market*, /shop*, /quests*, /rankings/*, /admin/*.

import { z } from 'zod';
import { Ms, zId, zPaging, zResources } from './common.ts';
import { AllianceRow, CityRow, HeroRow, MarketOrderRow, MarketShipmentRow, PlayerRow, QuestProgressRow } from './rows.ts';

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
  id: z.string(),
  name: z.string(),
  cost: int().describe('cents'),
  buyable: z.boolean(),
  canGamble: z.boolean(),
  type: int(),
  dayLimit: int(),
  rarity: int(),
  category: z.string(),
  description: z.string(),
  use: z.enum(['direct', 'elsewhere', 'none']).describe('direct: POST /player/items/{id}/use; elsewhere: consumed by another action (see howTo); none: no effect'),
  howTo: z.string().optional(),
});

export const ConfigItem = itemConfig.meta({ id: 'ConfigItem' });
export type ConfigItem = z.infer<typeof ConfigItem>;

export const ConfigQuestGroup = z
  .object({
    id: int(),
    mainId: int(),
    isFinish: z.boolean(),
    description: z.string(),
    name: z.string(),
    typeId: int(),
    requires: z.object({ buildings: z.array(int()), items: z.array(int()), techs: z.array(int()), quests: z.array(int()) }),
  })
  .meta({ id: 'ConfigQuestGroup' });
export type ConfigQuestGroup = z.infer<typeof ConfigQuestGroup>;

export const ConfigTitle = z
  .object({
    id: int(),
    name: z.string(),
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
    startLoyalty: int(),
    startTaxRate: int(),
    startPopulation: int(),
    heroSalaryPerLevel: int(),
    heroHireCostPerLevel: int(),
    heroAwardCostPerLevel: int(),
    comfortCooldownMs: ms(),
    levyCooldownMs: ms(),
    levyLoyaltyCost: int(),
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
    cityLoyaltyDamagePerAttack: z.tuple([int(), int()]).readonly().describe('[min, max]'),
    npcLoyaltyStart: z.object({ low: int(), high: int() }),
    npcRegenMs: ms(),
    plunderShare: z.number(),
    injuredShare: z.number(),
    medicinePerLevel: z.number(),
    heroExpPerKill: z.number(),
    heroExpPerTrain: z.number(),
    heroExpPerResearch: z.number(),
    heroExpPerBuild: z.number(),
    beginnerProtectionMs: ms(),
    beginnerTownHallLevel: int(),
    startingCents: int(),
    startingResources: int(),
    truceDurationMs: ms(),
    truceCooldownMs: ms(),
    teleportCooldownMs: ms(),
    worldChatSpeakerCost: int(),
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
    shopResourcePerCent: z.object({ food: int(), wood: int(), stone: int(), iron: int() }),
  })
  .meta({ id: 'ConfigBalance' });
export type ConfigBalance = z.infer<typeof ConfigBalance>;

export const StaticConfig = z
  .object({
    gameSpeed: z.number().describe('timer multiplier (GAME_SPEED)'),
    mapSize: int(),
    states: z.array(z.string()).readonly().describe('state (zone) names by zone id'),
    buildingNames: z.record(z.number().int(), z.string()).describe('by building typeId'),
    techNames: z.record(z.number().int(), z.string()).describe('by techId'),
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
  type: z.enum(['limit', 'market']).default('limit').describe('limit: unfilled part rests on the book; market: fill now at the best prices, nothing rests'),
});
export const MarketQuoteQuery = z.object({
  side: z.coerce.number().int(),
  amount: z.coerce.number().int(),
  price: z.coerce.number().optional(),
  type: z.enum(['limit', 'market']).default('limit'),
});
export const OrderIdParams = z.object({ orderId: zId });
export const ShipmentIdParams = z.object({ shipmentId: zId });

const resourceName = z.enum(['food', 'wood', 'stone', 'iron']);

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

export const MarketOrderBook = z
  .object({
    resType: int(),
    buyers: z.array(MarketPriceLevel).describe('bids, best (highest) price first'),
    sellers: z.array(MarketPriceLevel).describe('offers, best (lowest) price first'),
    merchant: MarketMerchant,
  })
  .meta({ id: 'MarketOrderBook' });
export type MarketOrderBook = z.infer<typeof MarketOrderBook>;

export const MarketOrder = MarketOrderRow.pick({ id: true, resType: true, price: true, amount: true, createdAt: true, cityId: true })
  .extend({
    resourceName,
    tradeType: MarketOrderRow.shape.side.describe('0 buy, 1 sell'),
    tradeTypeName: z.string().describe('Bid | Offer'),
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
    createdAt: Ms,
  })
  .meta({ id: 'MarketTrade' });
export const MarketCandle = z
  .object({ t: Ms.describe('bucket start'), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: int() })
  .meta({ id: 'MarketCandle' });
export const MarketHistory = z
  .object({
    resType: int(),
    bucketMs: int().describe('candle length: one game hour'),
    merchant: MarketMerchant,
    candles: z.array(MarketCandle).describe('oldest first; buckets without trades are omitted'),
    trades: z.array(MarketTrade).describe('most recent first'),
  })
  .meta({ id: 'MarketHistory' });
export type MarketHistory = z.infer<typeof MarketHistory>;

export const MarketShipment = MarketShipmentRow.pick({ id: true, cityId: true, resType: true, amount: true, price: true, startTime: true, endTime: true })
  .extend({ resourceName: z.string().describe('food | wood | stone | iron | gold (resType 4: sale proceeds or escrow refund)') })
  .meta({ id: 'MarketShipment' });
export type MarketShipment = z.infer<typeof MarketShipment>;

// ---- shop ----

export const ShopBuyBody = z.object({ itemId: z.string(), amount: z.number().int().default(1) });
export const BuyResourcesBody = z.object({ food: z.number().int(), wood: z.number().int(), stone: z.number().int(), iron: z.number().int() }).partial();

export const ShopItem = itemConfig
  .pick({ id: true, name: true, dayLimit: true })
  .extend({ price: int().describe('cents') })
  .meta({ id: 'ShopItem' });
export type ShopItem = z.infer<typeof ShopItem>;

export const ShopCategory = z.object({ typeId: int(), typeName: z.string(), items: z.array(ShopItem) }).meta({ id: 'ShopCategory' });
export type ShopCategory = z.infer<typeof ShopCategory>;

export const ShopBuyResult = z
  .object({ cents: PlayerRow.shape.cents.describe('cents left'), count: int().describe('owned count of the item after the purchase') })
  .meta({ id: 'ShopBuyResult' });
export type ShopBuyResult = z.infer<typeof ShopBuyResult>;

export const ShopResourceRates = z
  .object({ forFood: int(), forWood: int(), forStone: int(), forIron: int() })
  .describe('units of each resource per cent')
  .meta({ id: 'ShopResourceRates' });
export type ShopResourceRates = z.infer<typeof ShopResourceRates>;

// ---- quests ----

export const QuestListQuery = z.object({ groupId: z.coerce.number().int().optional() });
export const QuestIdParams = z.object({ questId: zId });
export const ClaimQuestBody = z.object({ cityId: zId });

export const QuestAward = z
  .object({ resources: intResources.partial().optional(), items: z.record(z.string(), int()).optional().describe('item id -> count'), cents: int().optional() })
  .meta({ id: 'QuestAward' });
export type QuestAward = z.infer<typeof QuestAward>;

export const QuestGroupStatus = ConfigQuestGroup.pick({ typeId: true, name: true, description: true })
  .extend({ isFinish: z.boolean().describe('the group has finished quests whose award is not claimed yet') })
  .meta({ id: 'QuestGroupStatus' });
export type QuestGroupStatus = z.infer<typeof QuestGroupStatus>;

export const QuestBean = z
  .object({
    questId: QuestProgressRow.shape.questId,
    groupId: int().describe('QuestGroupStatus.typeId'),
    name: z.string(),
    description: z.string(),
    targets: z.array(z.object({ name: z.string(), finished: z.boolean() })),
    award: QuestAward,
    isFinish: z.boolean().describe('all targets met (or already claimed)'),
    claimed: z.boolean(),
  })
  .meta({ id: 'QuestBean' });
export type QuestBean = z.infer<typeof QuestBean>;

export const QuestDailyGift = z.object({ items: z.record(z.string(), int()).describe('item id -> count') }).meta({ id: 'QuestDailyGift' });
export type QuestDailyGift = z.infer<typeof QuestDailyGift>;

// ---- rankings ----

export const RankingQuery = zPaging.extend({ sortType: z.coerce.number().int().default(2), key: z.string().default('') });

const rankingPage = <T extends z.ZodType>(entry: T) =>
  z.object({ pageNo: int(), pageSize: int(), totalPage: int(), beans: z.array(entry) });

export const RankingPlayerEntry = PlayerRow.pick({ id: true, flag: true, faceUrl: true })
  .extend({
    ranking: int(),
    userName: PlayerRow.shape.name,
    prestige: int(),
    honor: int(),
    titleId: int(),
    population: PlayerRow.shape.population,
    castleCount: int(),
    alliance: z.string().describe('alliance name, empty when none'),
    allianceLevel: z.string().describe('rank name inside the alliance, empty when none'),
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
export const AdminGrantCentsBody = z.object({ playerName: z.string(), cents: z.number().int() });
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
  loyalty: z.number().optional(),
  troops: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

export const AdminAddedHero = HeroRow.shape.id.describe('id of the new hero').meta({ id: 'AdminAddedHero' });
export type AdminAddedHero = z.infer<typeof AdminAddedHero>;

export const AdminOnline = z.object({ online: int().describe('lords with at least one open WebSocket') }).meta({ id: 'AdminOnline' });
export type AdminOnline = z.infer<typeof AdminOnline>;
