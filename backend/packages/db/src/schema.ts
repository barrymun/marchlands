// Postgres schema for Marchlands. All game timestamps are epoch milliseconds stored as bigint
// (read back as JS numbers), matching the original server and client.
//
// Design notes
// - The DB is the single source of truth; the API and worker are stateless.
// - Highly nested per-city state (buildings, troops, queues) lives in jsonb columns on the
//   owning row and is always read/written under a row lock (SELECT ... FOR UPDATE).
// - Anything that must be queried across players (heroes, armies, mail, reports, orders,
//   timed events) is normalised into its own table.

import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  BuildingState,
  BuffState,
  CastleSign,
  FortCounts,
  ItemCounts,
  ResearchState,
  ResourceSet,
  TroopCounts,
  TroopQueueState,
  FortQueueState,
  CityMisc,
  PlayerMisc,
  ReportBody,
  FlowAction,
  FlowRunLog,
  FlowStatus,
} from './types.ts';

const ms = (name: string) => bigint(name, { mode: 'number' });

// ---------------------------------------------------------------------------------------------
// Accounts & players
// ---------------------------------------------------------------------------------------------

/** Login identity (the original "account" table on the web/master DB). */
export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    username: text('username').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    isAdmin: boolean('is_admin').notNull().default(false),
    /** 0 = active, 1 = banned */
    status: smallint('status').notNull().default(0),
    banReason: text('ban_reason').notNull().default(''),
    createdAt: ms('created_at').notNull(),
    lastLoginAt: ms('last_login_at').notNull().default(0),
    lastLoginIp: text('last_login_ip').notNull().default(''),
  },
  (t) => [uniqueIndex('accounts_username_lower_idx').on(sql`lower(${t.username})`), uniqueIndex('accounts_email_lower_idx').on(sql`lower(${t.email})`)],
);

/** The in-game lord (original `accounts` table of the world DB / Client class). */
export const players = pgTable(
  'players',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** 0 = male (Lord), 1 = female (Lady) */
    sex: smallint('sex').notNull().default(0),
    flag: text('flag').notNull().default(''),
    faceUrl: text('face_url').notNull().default(''),
    allianceId: integer('alliance_id'),
    allianceRank: smallint('alliance_rank').notNull().default(0),
    allianceJoinedAt: ms('alliance_joined_at').notNull().default(0),
    prestige: doublePrecision('prestige').notNull().default(0),
    honor: doublePrecision('honor').notNull().default(0),
    /** nobility title id */
    title: smallint('title').notNull().default(0),
    beginner: boolean('beginner').notNull().default(true),
    /** PlayerStatus: normal / peace / truce / beginner / holiday */
    status: smallint('status').notNull().default(0),
    research: jsonb('research').$type<ResearchState>().notNull().default({}),
    items: jsonb('items').$type<ItemCounts>().notNull().default({}),
    buffs: jsonb('buffs').$type<BuffState[]>().notNull().default([]),
    castleSigns: jsonb('castle_signs').$type<CastleSign[]>().notNull().default([]),
    misc: jsonb('misc').$type<PlayerMisc>().notNull().default({}),
    /** cached aggregates, refreshed by the ranking job */
    population: integer('population').notNull().default(0),
    prestigeRank: integer('prestige_rank').notNull().default(0),
    honorRank: integer('honor_rank').notNull().default(0),
    createdAt: ms('created_at').notNull(),
    lastLoginAt: ms('last_login_at').notNull().default(0),
    lastSeenAt: ms('last_seen_at').notNull().default(0),
  },
  (t) => [
    uniqueIndex('players_account_idx').on(t.accountId),
    uniqueIndex('players_name_lower_idx').on(sql`lower(${t.name})`),
    index('players_alliance_idx').on(t.allianceId),
    index('players_prestige_idx').on(t.prestige),
  ],
);

// ---------------------------------------------------------------------------------------------
// World map
// ---------------------------------------------------------------------------------------------

/**
 * One row per map tile (mapSize^2 rows). Valleys and NPC cities keep their garrison here;
 * player castles point at `cities`.
 */
export const tiles = pgTable(
  'tiles',
  {
    /** y * mapSize + x */
    id: integer('id').primaryKey(),
    /** TileType */
    type: smallint('type').notNull(),
    level: smallint('level').notNull(),
    /** player castle on this tile */
    cityId: integer('city_id'),
    /** owner of an occupied valley or captured NPC city: the controlling city */
    ownerCityId: integer('owner_city_id'),
    ownerPlayerId: integer('owner_player_id'),
    /** NPC city / valley defenders (null = full strength, regenerated lazily) */
    troops: jsonb('troops').$type<TroopCounts>(),
    forts: jsonb('forts').$type<FortCounts>(),
    /** NPC city: resources available for plunder, loyalty etc. */
    state: jsonb('state').$type<Record<string, number>>(),
    updatedAt: ms('updated_at').notNull().default(0),
  },
  (t) => [
    index('tiles_owner_city_idx')
      .on(t.ownerCityId)
      .where(sql`${t.ownerCityId} is not null`),
    index('tiles_type_idx').on(t.type),
  ],
);

// ---------------------------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------------------------

export const cities = pgTable(
  'cities',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    tileId: integer('tile_id').notNull(),
    name: text('name').notNull(),
    logoUrl: text('logo_url').notNull().default('images/icon/cityLogo/citylogo_01.png'),
    status: smallint('status').notNull().default(0),
    allowAlliance: boolean('allow_alliance').notNull().default(false),
    goOutForBattle: boolean('go_out_for_battle').notNull().default(true),
    // resources (as of resources_at; production is integrated lazily)
    gold: doublePrecision('gold').notNull().default(0),
    food: doublePrecision('food').notNull().default(0),
    wood: doublePrecision('wood').notNull().default(0),
    stone: doublePrecision('stone').notNull().default(0),
    iron: doublePrecision('iron').notNull().default(0),
    resourcesAt: ms('resources_at').notNull(),
    // population (also integrated lazily)
    population: doublePrecision('population').notNull().default(0),
    taxRate: smallint('tax_rate').notNull().default(10),
    buildings: jsonb('buildings').$type<BuildingState[]>().notNull().default([]),
    troops: jsonb('troops').$type<TroopCounts>().notNull().default({}),
    injuredTroops: jsonb('injured_troops').$type<TroopCounts>().notNull().default({}),
    forts: jsonb('forts').$type<FortCounts>().notNull().default({}),
    troopQueues: jsonb('troop_queues').$type<TroopQueueState[]>().notNull().default([]),
    fortQueue: jsonb('fort_queue').$type<FortQueueState>().notNull().default({ nextQueueId: 1, queue: [] }),
    /** production work-rate per resource (percent of workers assigned), and store percentages */
    workRates: jsonb('work_rates').$type<ResourceSet>().notNull().default({ gold: 100, food: 100, wood: 100, stone: 100, iron: 100 }),
    storePercent: jsonb('store_percent').$type<ResourceSet>().notNull().default({ gold: 0, food: 25, wood: 25, stone: 25, iron: 25 }),
    misc: jsonb('misc').$type<CityMisc>().notNull().default({}),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [uniqueIndex('cities_tile_idx').on(t.tileId), index('cities_player_idx').on(t.playerId)],
);

// ---------------------------------------------------------------------------------------------
// Heroes
// ---------------------------------------------------------------------------------------------

export const heroes = pgTable(
  'heroes',
  {
    id: serial('id').primaryKey(),
    /** null while the hero is an unhired tavern offer */
    playerId: integer('player_id').references(() => players.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    /** true while the hero is only offered in the city's inn */
    inTavern: boolean('in_tavern').notNull().default(false),
    name: text('name').notNull(),
    logoUrl: text('logo_url').notNull(),
    /** HeroStatus */
    status: smallint('status').notNull().default(0),
    level: integer('level').notNull().default(1),
    experience: doublePrecision('experience').notNull().default(0),
    upgradeExp: doublePrecision('upgrade_exp').notNull().default(100),
    loyalty: integer('loyalty').notNull().default(70),
    basePower: integer('base_power').notNull(),
    baseManagement: integer('base_management').notNull(),
    baseStratagem: integer('base_stratagem').notNull(),
    power: integer('power').notNull(),
    management: integer('management').notNull(),
    stratagem: integer('stratagem').notNull(),
    powerAdded: integer('power_added').notNull().default(0),
    managementAdded: integer('management_added').notNull().default(0),
    stratagemAdded: integer('stratagem_added').notNull().default(0),
    powerBuffAdded: integer('power_buff_added').notNull().default(0),
    managementBuffAdded: integer('management_buff_added').notNull().default(0),
    stratagemBuffAdded: integer('stratagem_buff_added').notNull().default(0),
    remainPoint: integer('remain_point').notNull().default(0),
    buffs: jsonb('buffs').$type<BuffState[]>().notNull().default([]),
    /** player who captured this hero (status SEIZED) */
    capturedByPlayerId: integer('captured_by_player_id'),
    /** (marchlands) a locked hero cannot be dismissed */
    locked: boolean('locked').notNull().default(false),
    /** (marchlands) attribute the lord's gear boosts ('power' | 'management' | 'stratagem'); null: the hero's highest */
    gearStat: text('gear_stat'),
    /** (marchlands) position in the city's hero list, set by the lord (1 = first); 0 = never placed: after the placed ones, oldest first */
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('heroes_city_idx').on(t.cityId), index('heroes_player_idx').on(t.playerId)],
);

// ---------------------------------------------------------------------------------------------
// Armies (marching, returning or stationed troops)
// ---------------------------------------------------------------------------------------------

export const armies = pgTable(
  'armies',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    heroId: integer('hero_id'),
    /** Mission */
    mission: smallint('mission').notNull(),
    /** ArmyDirection */
    direction: smallint('direction').notNull(),
    startTileId: integer('start_tile_id').notNull(),
    targetTileId: integer('target_tile_id').notNull(),
    /** owner player of the target when the army was sent (for incoming-army notifications) */
    targetPlayerId: integer('target_player_id'),
    troops: jsonb('troops').$type<TroopCounts>().notNull(),
    resources: jsonb('resources').$type<ResourceSet>().notNull(),
    startTime: ms('start_time').notNull(),
    reachTime: ms('reach_time').notNull(),
    /** requested camping time (ms) at the target */
    restTime: ms('rest_time').notNull().default(0),
    /** human readable names captured at send time */
    startPosName: text('start_pos_name').notNull(),
    targetPosName: text('target_pos_name').notNull(),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [
    index('armies_player_idx').on(t.playerId),
    index('armies_city_idx').on(t.cityId),
    index('armies_target_tile_idx').on(t.targetTileId),
    index('armies_target_player_idx').on(t.targetPlayerId),
  ],
);

// ---------------------------------------------------------------------------------------------
// Flows (marchlands) — a lord's saved series of actions, plus where its current run is up to
// ---------------------------------------------------------------------------------------------

export const flows = pgTable(
  'flows',
  {
    id: text('id').primaryKey(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    actions: jsonb('actions').$type<FlowAction[]>().notNull(),
    /** 'all' (every city, including ones gained later) or chosen city ids */
    cities: jsonb('cities')
      .$type<'all' | number[]>()
      .notNull()
      .default(sql`'"all"'::jsonb`),
    /** run again after each run, until a run fails or the lord switches it off */
    repeat: boolean('repeat').notNull().default(false),
    status: text('status').$type<FlowStatus>().notNull().default('idle'),
    /** index of the action the run continues with */
    nextAction: integer('next_action').notNull().default(0),
    /** runs started so far */
    runs: integer('runs').notNull().default(0),
    /** cities of the current run */
    runCities: jsonb('run_cities').$type<number[]>().notNull().default([]),
    /** cities chosen for this run only (Run on chosen cities); null = the flow's own cities */
    cityOverride: jsonb('city_override').$type<number[] | null>(),
    /** armies the current run sent, per city id (for "wait until armies home" and heals) */
    armyIds: jsonb('army_ids').$type<Record<string, number[]>>().notNull().default({}),
    /** when it joined the queue (the queue is first come, first served) */
    queuedAt: ms('queued_at').notNull().default(0),
    /** a queued repeat starts no earlier than this */
    notBefore: ms('not_before').notNull().default(0),
    /** while waiting: when the wait ends (or is checked again) */
    waitUntil: ms('wait_until').notNull().default(0),
    runStartedAt: ms('run_started_at').notNull().default(0),
    /** while held before its next actions until every hero of its cities is home: since when (flows held earlier go first); 0 = not held */
    heldSince: ms('held_since').notNull().default(0),
    /** why the flow last stopped on its own (a failed run), or null */
    stopReason: text('stop_reason'),
    lastRun: jsonb('last_run').$type<FlowRunLog>(),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('flows_player_idx').on(t.playerId, t.createdAt)],
);

// ---------------------------------------------------------------------------------------------
// Timed events — the game clock. The worker claims due rows with FOR UPDATE SKIP LOCKED.
// ---------------------------------------------------------------------------------------------

export const timedEvents = pgTable(
  'timed_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** e.g. building.complete, research.complete, troop.train, fort.train, army.arrive, buff.expire */
    type: text('type').notNull(),
    dueAt: ms('due_at').notNull(),
    playerId: integer('player_id'),
    cityId: integer('city_id'),
    /** dedupe key, e.g. "army:12"; unique while pending */
    refKey: text('ref_key'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('timed_events_due_idx').on(t.dueAt), uniqueIndex('timed_events_ref_idx').on(t.refKey)],
);

// ---------------------------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------------------------

export const mails = pgTable(
  'mails',
  {
    id: serial('id').primaryKey(),
    /** owner of this copy of the mail */
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    /** MailType: 1 inbox, 2 system, 3 sent */
    type: smallint('type').notNull(),
    /** sender (inbox) or receiver (sent); null for system mail */
    otherPlayerId: integer('other_player_id'),
    otherPlayerName: text('other_player_name').notNull().default(''),
    title: text('title').notNull(),
    content: text('content').notNull(),
    sentAt: ms('sent_at').notNull(),
    readAt: ms('read_at').notNull().default(0),
  },
  (t) => [index('mails_player_type_idx').on(t.playerId, t.type, t.sentAt)],
);

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    /** 0 = trade, 1 = army, 2 = other (client tab; ReportType in the game reports service) */
    typeId: smallint('type_id').notNull().default(1),
    /** Mission of the army involved */
    armyType: smallint('army_type').notNull().default(0),
    isAttack: boolean('is_attack').notNull().default(false),
    isBack: boolean('is_back').notNull().default(false),
    title: text('title').notNull(),
    startPos: text('start_pos').notNull().default(''),
    targetPos: text('target_pos').notNull().default(''),
    body: jsonb('body').$type<ReportBody>().notNull(),
    eventTime: ms('event_time').notNull(),
    isRead: boolean('is_read').notNull().default(false),
  },
  (t) => [index('reports_player_time_idx').on(t.playerId, t.eventTime)],
);

/** Outbox for server push messages; NOTIFY carries the id, the API fans out over WebSocket. */
export const pushMessages = pgTable(
  'push_messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** recipients; empty array = broadcast to everyone online */
    playerIds: integer('player_ids').array().notNull(),
    cmd: text('cmd').notNull(),
    data: jsonb('data').notNull(),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('push_messages_created_idx').on(t.createdAt)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** world | alliance | private */
    channel: text('channel').notNull(),
    allianceId: integer('alliance_id'),
    fromPlayerId: integer('from_player_id'),
    fromName: text('from_name').notNull(),
    toPlayerId: integer('to_player_id'),
    message: text('message').notNull(),
    sentAt: ms('sent_at').notNull(),
  },
  (t) => [index('chat_channel_time_idx').on(t.channel, t.sentAt)],
);

// ---------------------------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------------------------

export const alliances = pgTable(
  'alliances',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    founderName: text('founder_name').notNull(),
    leaderPlayerId: integer('leader_player_id'),
    note: text('note').notNull().default(''),
    intro: text('intro').notNull().default(''),
    motd: text('motd').notNull().default(''),
    maxMembers: integer('max_members').notNull().default(500),
    /** Ritual of Pact: raised member limit valid until (ms) */
    /** earliest time this alliance may declare war again */
    warCooldownUntil: ms('war_cooldown_until').notNull().default(0),
    // cached ranking aggregates
    prestige: doublePrecision('prestige').notNull().default(0),
    honor: doublePrecision('honor').notNull().default(0),
    memberCount: integer('member_count').notNull().default(0),
    cityCount: integer('city_count').notNull().default(0),
    prestigeRank: integer('prestige_rank').notNull().default(0),
    honorRank: integer('honor_rank').notNull().default(0),
    membersRank: integer('members_rank').notNull().default(0),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [uniqueIndex('alliances_name_lower_idx').on(sql`lower(${t.name})`)],
);

/** Relation of `allianceId` towards `targetAllianceId` (one-sided, except war). */
export const allianceRelations = pgTable(
  'alliance_relations',
  {
    allianceId: integer('alliance_id')
      .notNull()
      .references(() => alliances.id, { onDelete: 'cascade' }),
    targetAllianceId: integer('target_alliance_id')
      .notNull()
      .references(() => alliances.id, { onDelete: 'cascade' }),
    /** Relation: 1 ally, 2 neutral, 3 enemy */
    relation: smallint('relation').notNull(),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.allianceId, t.targetAllianceId] })],
);

/** Pending applications (player -> alliance) and invitations (alliance -> player). */
export const allianceRequests = pgTable(
  'alliance_requests',
  {
    id: serial('id').primaryKey(),
    allianceId: integer('alliance_id')
      .notNull()
      .references(() => alliances.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    /** 'apply' (player asked) | 'invite' (alliance officer asked) */
    kind: text('kind').notNull(),
    invitedByName: text('invited_by_name').notNull().default(''),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [uniqueIndex('alliance_requests_unique_idx').on(t.allianceId, t.playerId, t.kind)],
);

export const allianceEvents = pgTable(
  'alliance_events',
  {
    id: serial('id').primaryKey(),
    allianceId: integer('alliance_id')
      .notNull()
      .references(() => alliances.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('alliance_events_idx').on(t.allianceId, t.createdAt)],
);

/** friend / block lists */
export const playerRelations = pgTable(
  'player_relations',
  {
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    otherPlayerId: integer('other_player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    /** 'friend' | 'block' */
    kind: text('kind').notNull(),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.otherPlayerId, t.kind] })],
);

// ---------------------------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------------------------

/** Marketplace order book. Escrowed at creation (gold for bids, goods for offers). */
export const marketOrders = pgTable(
  'market_orders',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    /** 0 food, 1 wood, 2 stone, 3 iron */
    resType: smallint('res_type').notNull(),
    /** 0 = buy (Bid), 1 = sell (Offer) */
    side: smallint('side').notNull(),
    price: doublePrecision('price').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    filled: bigint('filled', { mode: 'number' }).notNull().default(0),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('market_orders_book_idx').on(t.resType, t.side, t.price, t.createdAt), index('market_orders_city_idx').on(t.cityId)],
);

/** Goods bought on the market, travelling to the buyer's city. */
export const marketShipments = pgTable(
  'market_shipments',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    orderId: integer('order_id'),
    resType: smallint('res_type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    price: doublePrecision('price').notNull(),
    startTime: ms('start_time').notNull(),
    endTime: ms('end_time').notNull(),
  },
  (t) => [index('market_shipments_city_idx').on(t.cityId)],
);

/** Completed market trades (price history). A null buyer/seller is the computer merchant. */
export const marketTrades = pgTable(
  'market_trades',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    resType: smallint('res_type').notNull(),
    /** average gold per unit of this fill */
    price: doublePrecision('price').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    /** gold that changed hands, before the buyer's fee */
    gold: bigint('gold', { mode: 'number' }).notNull(),
    /** side of the order that triggered the trade: 0 buy, 1 sell */
    takerSide: smallint('taker_side').notNull(),
    buyerPlayerId: integer('buyer_player_id'),
    sellerPlayerId: integer('seller_player_id'),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [
    index('market_trades_res_time_idx').on(t.resType, t.createdAt),
    index('market_trades_buyer_idx').on(t.buyerPlayerId),
    index('market_trades_seller_idx').on(t.sellerPlayerId),
  ],
);

export const questProgress = pgTable(
  'quest_progress',
  {
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    questId: integer('quest_id').notNull(),
    /** 0 = in progress, 1 = finished (reward claimable), 2 = reward claimed */
    status: smallint('status').notNull().default(0),
    updatedAt: ms('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.questId] })],
);

/**
 * (marchlands) Lord statistics: counters per lord, city (0: the lord as a whole) and period, a day
 * ('2026-10-09') or, once the stats job folds old days together, a month ('2026-10'). Written in
 * batches from an in-memory buffer (game stats.ts), merging counters with stats_add().
 */
export const playerStats = pgTable(
  'player_stats',
  {
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    cityId: integer('city_id').notNull(),
    period: text('period').notNull(),
    counters: jsonb('counters').$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.cityId, t.period] })],
);

/** Global key/value state (world config, counters). */
export const worldState = pgTable('world_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ms('updated_at').notNull(),
});
