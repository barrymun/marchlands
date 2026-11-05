// WebSocket pushes: every frame on /ws is `{ cmd, data }`. Game code queues them with
// ctx.push / ctx.broadcast (backend/packages/game/src/context.ts), typed against PushSchemas;
// clients switch on PushMessage['cmd'] or validate frames with PushMessageSchema.

import { z } from 'zod';

import { FLOW_STATUSES, MessageSchema } from '@marchlands/core';

import { ArmyBean, BuffBean, BuildingBean, CityBean, HeroBean, ItemCount, PlayerInfo, ResourceBean } from '#/beans.ts';
import { FortBean, Ms, TroopBean } from '#/common.ts';
import { PushCmd } from '#/push-cmd.ts';

export { PushCmd };

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
  [PushCmd.CONNECTED]: z.object({ playerId: int, serverTime: Ms }),
  [PushCmd.CONNECTION_LOST]: z.object({ reasonCode: int, msg: MessageSchema }),
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
    buffBean: z.object({ typeId: z.string(), desc: MessageSchema.describe('what the buff does (`buff.*`), worded by the client'), endTime: Ms }),
    updateType: z.literal([0, 1]).describe('0 = added or extended, 1 = expired or removed'),
  }),
  [PushCmd.FLOW_UPDATE]: z.object({ flowId: z.string(), status: z.enum(FLOW_STATUSES) }).describe('(marchlands) a flow started, paused or finished'),
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
  [PushCmd.MARKET_UPDATE]: z
    .object({ resTypes: z.array(int).describe('the resources whose book, prices or candles changed') })
    .describe('(marchlands) sent to everyone connected, so open market screens refresh instead of asking every few seconds'),

  // chat / social
  [PushCmd.CHANNEL_CHAT_MESSAGE]: ChatMsg(z.enum(['world', 'beginner'])),
  [PushCmd.ALLIANCE_CHAT_MESSAGE]: ChatMsg(z.literal('alliance')),
  [PushCmd.PRIVATE_CHAT_MESSAGE]: z.object({ msg: z.string(), chatType: z.literal(0), fromUser: z.string(), fromId: int, time: Ms }),
  [PushCmd.SYSTEM_INFO_MESSAGE]: z.object({
    msg: MessageSchema.describe('what to tell the player, worded by the client'),
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
