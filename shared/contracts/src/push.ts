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

export const PushSchemas = {
  // sent by the /ws handler itself
  'server.Connected': z.object({ playerId: int, serverTime: Ms }),
  'server.ConnectionLost': z.object({ reasonCode: int, msg: z.string() }),
  pong: z.object({ serverTime: Ms }),

  // city
  'server.BuildComplate': z.object({ castleId, buildingBean: BuildingBean.describe('typeId 0 = slot now empty') }),
  'server.ResourceUpdate': z.object({ castleId, resource: ResourceBean }),
  'server.CastleUpdate': z.discriminatedUnion('updateType', [
    z.object({ updateType: z.literal(1).describe('city lost'), castleBean: z.object({ id: int }) }),
    z.object({ updateType: z.literal(2).describe('city changed'), castleBean: CityBean }),
  ]),
  'server.TroopUpdate': z.object({ castleId, troop: TroopBean }),
  'server.InjuredTroopUpdate': z.object({ castleId, troop: TroopBean }),
  'server.FortificationsUpdate': z.object({ castleId, fortification: FortBean }),
  'server.TroopQueueUpdate': ProduceQueue,
  'server.FortificationsQueueUpdate': ProduceQueue,
  'server.ResearchUpdate': z.object({ castleId, typeId: int.describe('tech id'), endTime: Ms }),
  'server.ResearchCompleteUpdate': z.object({ castleId, typeId: int.describe('tech id'), level: int }),
  'server.HeroUpdate': z.object({ castleId, hero: HeroBean, updateType: z.literal([0, 1, 2]).describe('0 = added, 1 = removed, 2 = changed') }),

  // player
  'server.PlayerInfoUpdate': z.object({ playerInfo: PlayerInfo }),
  'server.ItemUpdate': z.object({ items: z.array(ItemCount) }),
  'server.PlayerBuffUpdate': z.object({
    buffBean: z.object({ typeId: z.string(), descName: z.string(), endTime: Ms }),
    updateType: z.literal([0, 1]).describe('0 = added or extended, 1 = expired or removed'),
  }),
  'server.FlowUpdate': z
    .object({ flowId: z.string(), status: z.enum(['idle', 'queued', 'running', 'waiting']) })
    .describe('(marchlands) a flow started, paused or finished'),
  'server.PlayerBuffsUpdate': z.object({ buffs: z.array(BuffBean) }),

  // armies
  'server.SelfArmysUpdate': ArmyList,
  'server.FriendArmysUpdate': ArmyList,
  'server.EnemyArmysUpdate': ArmyList,

  // mail / reports
  'server.NewMail': z.object({ count: int.describe('unread inbox + system'), count_inbox: int, count_system: int }).describe('unread mail counts'),
  'server.NewReport': z.object({ count: int, trade_count: int, army_count: int, other_count: int }),

  // market
  'server.TradesUpdate': z.object({ resType: int, amount: z.number(), price: z.number() }),
  'server.TransingTradeUpdate': z.object({ id: int, delivered: z.literal(true), resType: int, amount: z.number(), castleId }),

  // chat / social
  'server.ChannelChatMsg': ChatMsg(z.enum(['world', 'beginner'])),
  'server.AllianceChatMsg': ChatMsg(z.literal('alliance')),
  'server.PrivateChatMessage': z.object({ msg: z.string(), chatType: z.literal(0), fromUser: z.string(), fromId: int, time: Ms }),
  'server.SystemInfoMsg': z.object({ msg: z.string(), alliance: z.boolean(), sender: z.string().optional(), tV: z.boolean(), noSenderSystemInfo: z.boolean() }),
  'server.AllianceInvite': z.object({ allianceName: z.string(), invitePerson: z.string() }),
} as const;

export type PushCmd = keyof typeof PushSchemas;
export type PushData<K extends PushCmd> = z.output<(typeof PushSchemas)[K]>;

/** Discriminated union of every frame the server sends on /ws. */
export type PushMessage = { [K in PushCmd]: { cmd: K; data: PushData<K> } }[PushCmd];

type PushFrameSchema = { [K in PushCmd]: z.ZodObject<{ cmd: z.ZodLiteral<K>; data: (typeof PushSchemas)[K] }> }[PushCmd];

/** Runtime validator for incoming frames (discriminated on `cmd`); its output type is PushMessage. */
export const PushMessageSchema = z.discriminatedUnion(
  'cmd',
  Object.entries(PushSchemas).map(([cmd, data]) => z.object({ cmd: z.literal(cmd), data })) as unknown as [PushFrameSchema, ...PushFrameSchema[]],
);
