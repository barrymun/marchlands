// Mail, reports, chat, friends & blocks and alliances.

import { z } from 'zod';
import { MessageSchema } from '@marchlands/core';
import { Ms, zId, zPaging } from './common.ts';
import { AllianceEventRow, AllianceRequestRow, AllianceRow, ArmyRow, ChatMessageRow, MailRow, PlayerRow, ReportRow } from './rows.ts';

// ---- mail ----

export const MailListQuery = zPaging.extend({ type: z.coerce.number().int().default(1) });
export const MailIdParams = z.object({ mailId: zId });
export const SendMailBody = z.object({ to: z.string(), title: z.string(), content: z.string() });

export const MailCounts = z
  .object({ count: z.number().int().describe('unread inbox + system'), count_inbox: z.number().int(), count_system: z.number().int() })
  .meta({ id: 'MailCounts' });
export type MailCounts = z.infer<typeof MailCounts>;

export const MailSummary = MailRow.pick({ title: true })
  .extend({
    mailid: MailRow.shape.id,
    type_id: MailRow.shape.type.describe('folder: 1 inbox, 2 system, 3 sent'),
    sender: z.string().nullable().describe('null for mail the game sent (the client labels it)'),
    receiver: z.string(),
    playerId: MailRow.shape.otherPlayerId.describe('the other lord (sender for inbox, receiver for sent); null for system mail'),
    receiveTime: MailRow.shape.sentAt,
    isRead: z.boolean(),
    systemTitle: MessageSchema.nullable().describe('mail the game sent: its title as a message (then `title` is empty)'),
  })
  .meta({ id: 'MailSummary' });
export type MailSummary = z.infer<typeof MailSummary>;

export const MailList = z
  .object({ pageNo: z.number().int(), pageSize: z.number().int(), totalPage: z.number().int(), mails: z.array(MailSummary) })
  .meta({ id: 'MailList' });
export type MailList = z.infer<typeof MailList>;

export const MailDetail = MailSummary.extend({
  content: MailRow.shape.content,
  systemContent: MessageSchema.nullable().describe('mail the game sent: its content as a message (then `content` is empty)'),
}).meta({ id: 'MailDetail' });
export type MailDetail = z.infer<typeof MailDetail>;

// ---- reports ----

export const ReportListQuery = zPaging.extend({ type: z.coerce.number().int().optional() });
export const ReportIdParams = z.object({ reportId: zId });
export const MarkReportsReadBody = z.object({ ids: z.array(z.number().int()).optional() });

export const ReportCounts = z
  .object({ count: z.number().int(), trade_count: z.number().int(), army_count: z.number().int(), other_count: z.number().int() })
  .meta({ id: 'ReportCounts' });
export type ReportCounts = z.infer<typeof ReportCounts>;

export const ReportSummary = ReportRow.pick({ id: true, title: true, armyType: true, startPos: true, targetPos: true, eventTime: true, isRead: true })
  .extend({
    type: ReportRow.shape.typeId.describe('tab: 0 trade, 1 army, 2 other'),
    attack: ReportRow.shape.isAttack,
    back: ReportRow.shape.isBack,
  })
  .meta({ id: 'ReportSummary' });
export type ReportSummary = z.infer<typeof ReportSummary>;

export const ReportList = z
  .object({ pageNo: z.number().int(), pageSize: z.number().int(), totalPage: z.number().int(), reports: z.array(ReportSummary) })
  .meta({ id: 'ReportList' });
export type ReportList = z.infer<typeof ReportList>;

/** `content` is the stored report body (core ReportBodySchema; battle/scout/movement/trade payloads are opaque). */
export const ReportDetail = ReportSummary.extend({ content: ReportRow.shape.body }).meta({ id: 'ReportDetail' });
export type ReportDetail = z.infer<typeof ReportDetail>;

// ---- chat ----

export const ChatBody = z.object({ msg: z.string() });
export const PrivateChatBody = ChatBody.extend({ to: z.string() });
export const ChatChannelParams = z.object({ channel: z.enum(['world', 'beginner', 'alliance', 'private']) });
export const ChatHistoryQuery = z.object({ since: z.coerce.number().default(0) });

export const ChatMessage = ChatMessageRow.pick({ id: true })
  .extend({
    channel: ChatMessageRow.shape.channel.describe('world | beginner | alliance | private'),
    fromUser: ChatMessageRow.shape.fromName,
    fromId: ChatMessageRow.shape.fromPlayerId,
    toId: ChatMessageRow.shape.toPlayerId.describe('recipient of a private message'),
    msg: ChatMessageRow.shape.message,
    time: ChatMessageRow.shape.sentAt,
  })
  .meta({ id: 'ChatMessage' });
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatHistory = z.array(ChatMessage).meta({ id: 'ChatHistory' });
export type ChatHistory = z.infer<typeof ChatHistory>;

// ---- friends & blocks ----

export const AddPlayerRelationBody = z.object({ name: z.string() });
export const PlayerRelationParams = z.object({ playerId: zId });

export const PlayerRelationEntry = PlayerRow.pick({ id: true, name: true })
  .extend({ prestige: z.number().int(), lastSeen: PlayerRow.shape.lastSeenAt })
  .meta({ id: 'PlayerRelationEntry' });
export type PlayerRelationEntry = z.infer<typeof PlayerRelationEntry>;

export const PlayerRelationLists = z
  .object({ friends: z.array(PlayerRelationEntry), blocked: z.array(PlayerRelationEntry) })
  .meta({ id: 'PlayerRelationLists' });
export type PlayerRelationLists = z.infer<typeof PlayerRelationLists>;

export const PlayerRelationTarget = PlayerRow.pick({ id: true, name: true }).meta({ id: 'PlayerRelationTarget' });
export type PlayerRelationTarget = z.infer<typeof PlayerRelationTarget>;

// ---- alliance: requests ----

export const AllianceNameBody = z.object({ allianceName: z.string() });
export const AllianceUserBody = z.object({ userName: z.string() });
export const AllianceListQuery = zPaging.extend({ key: z.string().default('') });
export const AllianceNameParams = z.object({ name: z.string() });
export const CreateAllianceBody = z.object({ cityId: zId, allianceName: z.string() });
export const SetAllianceInfoBody = z.object({ note: z.string(), intro: z.string(), motd: z.string() }).partial();
export const SetAllianceRankBody = AllianceUserBody.extend({ rank: z.number().int() });
export const AllianceMassMailBody = z.object({ title: z.string(), content: z.string() });
export const SetAllianceRelationBody = z.object({ targetAllianceName: z.string(), type: z.number().int() });

// ---- alliance: responses ----

export const AllianceSummary = AllianceRow.pick({ id: true, memberCount: true })
  .extend({ allianceName: AllianceRow.shape.name, rank: AllianceRow.shape.prestigeRank, prestige: z.number().int(), honor: z.number().int() })
  .meta({ id: 'AllianceSummary' });
export type AllianceSummary = z.infer<typeof AllianceSummary>;

export const AllianceRelationLists = z
  .object({
    friendlyList: z.array(AllianceSummary).describe('allies'),
    middleList: z.array(AllianceSummary).describe('neutral'),
    enemyList: z.array(AllianceSummary).describe('at war'),
  })
  .meta({ id: 'AllianceRelationLists' });
export type AllianceRelationLists = z.infer<typeof AllianceRelationLists>;

export const AllianceProfile = AllianceRow.pick({ id: true, motd: true })
  .extend({
    allianceName: AllianceRow.shape.name,
    creatorName: AllianceRow.shape.founderName,
    leaderName: z.string(),
    allianceNote: AllianceRow.shape.note,
    allianceInfo: AllianceRow.shape.intro,
    memberCount: z.number().int(),
    memberLimit: z.number().int(),
    prestige: z.number().int(),
    rank: AllianceRow.shape.prestigeRank,
  })
  .meta({ id: 'AllianceProfile' });
export type AllianceProfile = z.infer<typeof AllianceProfile>;

/** `data: null` when the lord is not in an alliance. */
export const MyAlliance = AllianceRelationLists.extend({
  myRank: PlayerRow.shape.allianceRank.describe('4 Host, 5 Vice Host, 6 Presbyter, 7 Officer, 8 Member'),
  alliance: AllianceProfile,
}).meta({ id: 'MyAlliance' });
export type MyAlliance = z.infer<typeof MyAlliance>;

export const AlliancePublicInfo = AllianceRow.pick({ id: true, memberCount: true })
  .extend({
    allianceName: AllianceRow.shape.name,
    leader: z.string(),
    creator: AllianceRow.shape.founderName,
    prestigeCount: z.number().int(),
    ranking: AllianceRow.shape.prestigeRank,
    allianceInfo: AllianceRow.shape.intro,
  })
  .meta({ id: 'AlliancePublicInfo' });
export type AlliancePublicInfo = z.infer<typeof AlliancePublicInfo>;

export const AllianceList = z
  .object({ pageNo: z.number().int(), pageSize: z.number().int(), totalPage: z.number().int(), alliances: z.array(AllianceSummary) })
  .meta({ id: 'AllianceList' });
export type AllianceList = z.infer<typeof AllianceList>;

export const CreateAllianceResult = z.object({ id: AllianceRow.shape.id, msg: MessageSchema }).meta({ id: 'CreateAllianceResult' });
export type CreateAllianceResult = z.infer<typeof CreateAllianceResult>;

export const AllianceMember = PlayerRow.pick({ id: true, population: true })
  .extend({
    userName: PlayerRow.shape.name,
    levelId: PlayerRow.shape.allianceRank.describe('alliance rank: 4 Host … 8 Member'),
    prestige: z.number().int(),
    honor: z.number().int(),
    ranking: PlayerRow.shape.prestigeRank,
    titleId: PlayerRow.shape.title,
    lastLoginTime: PlayerRow.shape.lastSeenAt,
    castleCount: z.number().int(),
  })
  .meta({ id: 'AllianceMember' });
export type AllianceMember = z.infer<typeof AllianceMember>;

export const AllianceEvent = AllianceEventRow.pick({ message: true }).extend({ time: AllianceEventRow.shape.createdAt }).meta({ id: 'AllianceEvent' });
export type AllianceEvent = z.infer<typeof AllianceEvent>;

export const AllianceMilitaryEntry = ArmyRow.pick({ direction: true, startPosName: true, targetPosName: true, reachTime: true })
  .extend({
    armyId: ArmyRow.shape.id,
    king: PlayerRow.shape.name,
    missionType: ArmyRow.shape.mission,
    incoming: z.boolean().describe('a foreign army heading for a member (otherwise a member’s own army)'),
  })
  .meta({ id: 'AllianceMilitaryEntry' });
export type AllianceMilitaryEntry = z.infer<typeof AllianceMilitaryEntry>;

export const AllianceSentInvite = z
  .object({
    userName: PlayerRow.shape.name,
    prestige: z.number().int(),
    rank: PlayerRow.shape.prestigeRank,
    invitePerson: AllianceRequestRow.shape.invitedByName,
    inviteTime: AllianceRequestRow.shape.createdAt,
  })
  .meta({ id: 'AllianceSentInvite' });
export type AllianceSentInvite = z.infer<typeof AllianceSentInvite>;

export const AllianceReceivedInvite = AllianceRow.pick({ memberCount: true })
  .extend({
    allianceName: AllianceRow.shape.name,
    prestige: z.number().int(),
    rank: AllianceRow.shape.prestigeRank,
    invitePerson: AllianceRequestRow.shape.invitedByName,
  })
  .meta({ id: 'AllianceReceivedInvite' });
export type AllianceReceivedInvite = z.infer<typeof AllianceReceivedInvite>;

export const AllianceApplicationStatus = z.object({ allianceName: z.string().nullable(), applyTime: Ms.nullable() }).meta({ id: 'AllianceApplicationStatus' });
export type AllianceApplicationStatus = z.infer<typeof AllianceApplicationStatus>;

export const AllianceApplication = z
  .object({
    userName: PlayerRow.shape.name,
    prestige: z.number().int(),
    rank: PlayerRow.shape.prestigeRank,
    inviteTime: AllianceRequestRow.shape.createdAt.describe('when the application was made'),
    castleCount: z.number().int(),
  })
  .meta({ id: 'AllianceApplication' });
export type AllianceApplication = z.infer<typeof AllianceApplication>;
