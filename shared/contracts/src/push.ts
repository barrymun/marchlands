// WebSocket pushes: every frame on /ws is `{ cmd, data }`. Game code queues them with
// ctx.push / ctx.broadcast (backend/packages/game/src/context.ts), typed against PushSchemas;
// clients switch on PushMessage['cmd'] or validate frames with PushMessageSchema.

import { z } from 'zod';
import { FortBean, Ms, TroopBean } from './common.ts';
import { ArmyBean, BuffBean, BuildingBean, CityBean, HeroBean, ItemCount, PlayerInfo, ResourceBean } from './beans.ts';

const int = z.number().int();
const castleId = int.describe('city id');

const ProduceQueue = z.object({
  castleId,
  positionId: int.describe('barracks position (walls queue for fortifications)'),
  allProduceQueue: z.array(
    z.object({
      queueId: int,
      type: int.describe('troop / fortification type id'),
      num: int,
      startTime: Ms.describe('0 while waiting'),
      endTime: Ms.describe('0 while waiting'),
      costTime: int.describe('seconds'),
    }),
  ),
});

const ArmyList = z.object({ armys: z.array(ArmyBean) });

const ChatMsg = <C extends z.ZodType>(channel: C) => z.object({ msg: z.string(), languageType: int, fromUser: z.string(), fromId: int, channel, time: Ms });

/**
 * Names of the WebSocket push messages (`server.*`, the original protocol). The keys are readable;
 * the values are what travels on the wire, original spellings included (BuildComplate, Armys, Transing).
 */
export const PushCmd = {
  CONNECTED: 'server.Connected',
  CONNECTION_LOST: 'server.ConnectionLost',
  BUILD_COMPLETE: 'server.BuildComplate',
  RESOURCE_UPDATE: 'server.ResourceUpdate',
  CASTLE_UPDATE: 'server.CastleUpdate',
  TROOP_UPDATE: 'server.TroopUpdate',
  INJURED_TROOP_UPDATE: 'server.InjuredTroopUpdate',
  FORTIFICATIONS_UPDATE: 'server.FortificationsUpdate',
  TROOP_QUEUE_UPDATE: 'server.TroopQueueUpdate',
  FORTIFICATIONS_QUEUE_UPDATE: 'server.FortificationsQueueUpdate',
  RESEARCH_UPDATE: 'server.ResearchUpdate',
  RESEARCH_COMPLETE_UPDATE: 'server.ResearchCompleteUpdate',
  HERO_UPDATE: 'server.HeroUpdate',
  PLAYER_INFO_UPDATE: 'server.PlayerInfoUpdate',
  ITEM_UPDATE: 'server.ItemUpdate',
  PLAYER_BUFF_UPDATE: 'server.PlayerBuffUpdate',
  FLOW_UPDATE: 'server.FlowUpdate',
  PLAYER_BUFFS_UPDATE: 'server.PlayerBuffsUpdate',
  SELF_ARMIES_UPDATE: 'server.SelfArmysUpdate',
  FRIEND_ARMIES_UPDATE: 'server.FriendArmysUpdate',
  ENEMY_ARMIES_UPDATE: 'server.EnemyArmysUpdate',
  NEW_MAIL: 'server.NewMail',
  NEW_REPORT: 'server.NewReport',
  TRADES_UPDATE: 'server.TradesUpdate',
  TRANSIT_TRADE_UPDATE: 'server.TransingTradeUpdate',
  CHANNEL_CHAT_MESSAGE: 'server.ChannelChatMsg',
  ALLIANCE_CHAT_MESSAGE: 'server.AllianceChatMsg',
  PRIVATE_CHAT_MESSAGE: 'server.PrivateChatMessage',
  SYSTEM_INFO_MESSAGE: 'server.SystemInfoMsg',
  ALLIANCE_INVITE: 'server.AllianceInvite',
  /** answer to a client `ping` */
  PONG: 'pong',
} as const;
export type PushCmd = (typeof PushCmd)[keyof typeof PushCmd];

export const PushSchemas = {
  // sent by the /ws handler itself
  [PushCmd.CONNECTED]: z.object({ playerId: int, serverTime: Ms }),
  [PushCmd.CONNECTION_LOST]: z.object({ reasonCode: int, msg: z.string() }),
  [PushCmd.PONG]: z.object({ serverTime: Ms }),

  // city
  [PushCmd.BUILD_COMPLETE]: z.object({ castleId, buildingBean: BuildingBean.describe('typeId 0 = slot now empty') }),
  [PushCmd.RESOURCE_UPDATE]: z.object({ castleId, resource: ResourceBean }),
  [PushCmd.CASTLE_UPDATE]: z.discriminatedUnion('updateType', [
    z.object({ updateType: z.literal(1).describe('city lost'), castleBean: z.object({ id: int }) }),
    z.object({ updateType: z.literal(2).describe('city changed'), castleBean: CityBean }),
  ]),
  [PushCmd.TROOP_UPDATE]: z.object({ castleId, troop: TroopBean }),
  [PushCmd.INJURED_TROOP_UPDATE]: z.object({ castleId, troop: TroopBean }),
  [PushCmd.FORTIFICATIONS_UPDATE]: z.object({ castleId, fortification: FortBean }),
  [PushCmd.TROOP_QUEUE_UPDATE]: ProduceQueue,
  [PushCmd.FORTIFICATIONS_QUEUE_UPDATE]: ProduceQueue,
  [PushCmd.RESEARCH_UPDATE]: z.object({ castleId, typeId: int.describe('tech id'), endTime: Ms }),
  [PushCmd.RESEARCH_COMPLETE_UPDATE]: z.object({ castleId, typeId: int.describe('tech id'), level: int }),
  [PushCmd.HERO_UPDATE]: z.object({ castleId, hero: HeroBean, updateType: z.literal([0, 1, 2]).describe('0 = added, 1 = removed, 2 = changed') }),

  // player
  [PushCmd.PLAYER_INFO_UPDATE]: z.object({ playerInfo: PlayerInfo }),
  [PushCmd.ITEM_UPDATE]: z.object({ items: z.array(ItemCount) }),
  [PushCmd.PLAYER_BUFF_UPDATE]: z.object({
    buffBean: z.object({ typeId: z.string(), descName: z.string(), endTime: Ms }),
    updateType: z.literal([0, 1]).describe('0 = added or extended, 1 = expired or removed'),
  }),
  [PushCmd.FLOW_UPDATE]: z
    .object({ flowId: z.string(), status: z.enum(['idle', 'queued', 'running', 'waiting']) })
    .describe('(marchlands) a flow started, paused or finished'),
  [PushCmd.PLAYER_BUFFS_UPDATE]: z.object({ buffs: z.array(BuffBean) }),

  // armies
  [PushCmd.SELF_ARMIES_UPDATE]: ArmyList,
  [PushCmd.FRIEND_ARMIES_UPDATE]: ArmyList,
  [PushCmd.ENEMY_ARMIES_UPDATE]: ArmyList,

  // mail / reports
  [PushCmd.NEW_MAIL]: z.object({ count: int.describe('unread inbox + system'), count_inbox: int, count_system: int }).describe('unread mail counts'),
  [PushCmd.NEW_REPORT]: z.object({ count: int, trade_count: int, army_count: int, other_count: int }),

  // market
  [PushCmd.TRADES_UPDATE]: z.object({ resType: int, amount: z.number(), price: z.number() }),
  [PushCmd.TRANSIT_TRADE_UPDATE]: z.object({ id: int, delivered: z.literal(true), resType: int, amount: z.number(), castleId }),

  // chat / social
  [PushCmd.CHANNEL_CHAT_MESSAGE]: ChatMsg(z.enum(['world', 'beginner'])),
  [PushCmd.ALLIANCE_CHAT_MESSAGE]: ChatMsg(z.literal('alliance')),
  [PushCmd.PRIVATE_CHAT_MESSAGE]: z.object({ msg: z.string(), chatType: z.literal(0), fromUser: z.string(), fromId: int, time: Ms }),
  [PushCmd.SYSTEM_INFO_MESSAGE]: z.object({
    msg: z.string(),
    alliance: z.boolean(),
    sender: z.string().optional(),
    tV: z.boolean(),
    noSenderSystemInfo: z.boolean(),
  }),
  [PushCmd.ALLIANCE_INVITE]: z.object({ allianceName: z.string(), invitePerson: z.string() }),
} as const satisfies Record<PushCmd, z.ZodType>;

export type PushData<K extends PushCmd> = z.output<(typeof PushSchemas)[K]>;

/** Discriminated union of every frame the server sends on /ws. */
export type PushMessage = { [K in PushCmd]: { cmd: K; data: PushData<K> } }[PushCmd];

type PushFrameSchema = { [K in PushCmd]: z.ZodObject<{ cmd: z.ZodLiteral<K>; data: (typeof PushSchemas)[K] }> }[PushCmd];

/** Runtime validator for incoming frames (discriminated on `cmd`); its output type is PushMessage. */
export const PushMessageSchema = z.discriminatedUnion(
  'cmd',
  Object.entries(PushSchemas).map(([cmd, data]) => z.object({ cmd: z.literal(cmd), data })) as unknown as [PushFrameSchema, ...PushFrameSchema[]],
);
