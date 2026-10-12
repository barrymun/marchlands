// The push message names on their own, without the schemas, so a client that only needs the names (the
// browser, through @marchlands/api-client) doesn't bundle zod and the contracts.

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
