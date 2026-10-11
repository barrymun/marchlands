// Mail, reports, chat, friends and alliances.

import { z } from 'zod';
import {
  AddPlayerRelationBody,
  AllianceApplication,
  AllianceApplicationStatus,
  AllianceEvent,
  AllianceList,
  AllianceListQuery,
  AllianceMassMailBody,
  AllianceMember,
  AllianceMilitaryEntry,
  AllianceNameBody,
  AllianceNameParams,
  AlliancePublicInfo,
  AllianceReceivedInvite,
  AllianceSentInvite,
  AllianceUserBody,
  ChatBody,
  ChatChannelParams,
  ChatHistory,
  ChatHistoryQuery,
  CreateAllianceBody,
  CreateAllianceResult,
  Empty,
  MailCounts,
  MailDetail,
  MailIdParams,
  MailList,
  MailListQuery,
  MarkReportsReadBody,
  MyAlliance,
  PlayerRelationLists,
  PlayerRelationParams,
  PlayerRelationTarget,
  PrivateChatBody,
  ReportCounts,
  ReportDetail,
  ReportIdParams,
  ReportList,
  ReportListQuery,
  SendMailBody,
  SetAllianceInfoBody,
  SetAllianceRankBody,
  SetAllianceRelationBody,
} from '@marchlands/contracts';
import { alliance, mail, reports, social } from '@marchlands/game';
import { doc, anon, authenticate, game, tags, zIds, type ZApp } from '../http.ts';

export default async function socialRoutes(app: ZApp) {
  app.addHook('onRequest', authenticate);
  const s = doc;

  // ---- mail ----
  app.get('/mail', s(tags.mail, 'Folder 1 inbox, 2 system, 3 sent (mail.receiveMailList)', MailList, { querystring: MailListQuery }), (req) =>
    game(req, (ctx, pid) => mail.listMail(ctx, pid, req.query.type, req.query.pageNo, req.query.pageSize)),
  );
  app.get('/mail/unread', s(tags.mail, 'Unread counters (server.NewMail)', MailCounts), (req) => game(req, (ctx, pid) => mail.mailCounts(ctx, pid)));
  app.get('/mail/:mailId', s(tags.mail, 'Read (mail.readMail)', MailDetail, { params: MailIdParams }), (req) =>
    game(req, (ctx, pid) => mail.readMail(ctx, pid, req.params.mailId)),
  );
  app.post('/mail', s(tags.mail, 'Send (mail.sendMail)', Empty, { body: SendMailBody }), (req) =>
    game(req, (ctx, pid) => mail.sendMail(ctx, pid, req.body.to, req.body.title, req.body.content)),
  );
  app.post('/mail/read', s(tags.mail, 'Mark read (mail.readOverMailList)', Empty, { body: zIds }), (req) =>
    game(req, (ctx, pid) => mail.markMailRead(ctx, pid, req.body.ids)),
  );
  app.post('/mail/delete', s(tags.mail, 'Delete (mail.deleteMail)', Empty, { body: zIds }), (req) =>
    game(req, (ctx, pid) => mail.deleteMail(ctx, pid, req.body.ids)),
  );

  // ---- reports ----
  app.get('/reports', s(tags.reports, 'Type 0 trade, 1 army, 2 other (report.receiveReportList)', ReportList, { querystring: ReportListQuery }), (req) =>
    game(req, (ctx, pid) => reports.listReports(ctx, pid, req.query.type ?? null, req.query.pageNo, req.query.pageSize)),
  );
  app.get('/reports/unread', s(tags.reports, 'Unread counters (server.NewReport)', ReportCounts), (req) =>
    game(req, (ctx, pid) => reports.reportCounts(ctx, pid)),
  );
  app.get('/reports/:reportId', s(tags.reports, 'Open a report (report.markAsRead)', ReportDetail, { params: ReportIdParams }), (req) =>
    game(req, (ctx, pid) => reports.readReport(ctx, pid, req.params.reportId)),
  );
  app.post('/reports/read', s(tags.reports, 'Mark read (report.readOverReport); omit ids for all', Empty, { body: MarkReportsReadBody }), (req) =>
    game(req, (ctx, pid) => reports.markReportsRead(ctx, pid, req.body.ids ?? 'all')),
  );
  app.post('/reports/delete', s(tags.reports, 'Delete (report.deleteReport)', Empty, { body: zIds }), (req) =>
    game(req, (ctx, pid) => reports.deleteReports(ctx, pid, req.body.ids)),
  );

  // ---- chat ----
  app.post('/chat/world', s(tags.chat, 'World channel (common.worldChat)', Empty, { body: ChatBody }), (req) =>
    game(req, (ctx, pid) => social.worldChat(ctx, pid, req.body.msg, 'world')),
  );
  app.post('/chat/beginner', s(tags.chat, 'Beginner channel (common.channelChat)', Empty, { body: ChatBody }), (req) =>
    game(req, (ctx, pid) => social.worldChat(ctx, pid, req.body.msg, 'beginner')),
  );
  app.post('/chat/alliance', s(tags.chat, 'Alliance channel (common.allianceChat)', Empty, { body: ChatBody }), (req) =>
    game(req, (ctx, pid) => social.allianceChat(ctx, pid, req.body.msg)),
  );
  app.post('/chat/private', s(tags.chat, 'Whisper (common.privateChat)', Empty, { body: PrivateChatBody }), (req) =>
    game(req, (ctx, pid) => social.privateChat(ctx, pid, req.body.to, req.body.msg)),
  );
  app.get('/chat/:channel', s(tags.chat, 'Recent messages', ChatHistory, { params: ChatChannelParams, querystring: ChatHistoryQuery }), (req) =>
    game(req, (ctx, pid) => social.chatHistory(ctx, pid, req.params.channel, req.query.since)),
  );

  // ---- friends & blocks ----
  app.get('/friends', s(tags.social, 'Friends and blocked lords', PlayerRelationLists), (req) => game(req, (ctx, pid) => social.listRelations(ctx, pid)));
  for (const kind of ['friend', 'block'] as const) {
    const path = kind === 'friend' ? '/friends' : '/blocks';
    app.post(path, s(tags.social, `Add (friend.add${kind === 'friend' ? 'Friend' : 'Block'})`, PlayerRelationTarget, { body: AddPlayerRelationBody }), (req) =>
      game(req, (ctx, pid) => social.addRelation(ctx, pid, req.body.name, kind)),
    );
    app.delete(
      `${path}/:playerId`,
      s(tags.social, `Remove (friend.delete${kind === 'friend' ? 'Friend' : 'Block'})`, Empty, { params: PlayerRelationParams }),
      (req) => game(req, (ctx, pid) => social.removeRelation(ctx, pid, req.params.playerId, kind)),
    );
  }

  // ---- alliance ----
  const a = tags.alliance;
  app.get('/alliance', s(a, 'My alliance with relations (alliance.isHasAlliance); null when not in one', MyAlliance.nullable()), (req) =>
    game(req, (ctx, pid) => alliance.myAlliance(ctx, pid)),
  );
  app.get('/alliances', s(a, 'Browse / search alliances (alliance.getAllianceList)', AllianceList, { querystring: AllianceListQuery }), (req) =>
    anon(req, (ctx) => alliance.listAlliances(ctx, req.query.key, req.query.pageNo, req.query.pageSize)),
  );
  app.get('/alliances/:name', s(a, 'Public info (alliance.getAllianceInfo)', AlliancePublicInfo, { params: AllianceNameParams }), (req) =>
    anon(req, (ctx) => alliance.allianceInfo(ctx, req.params.name)),
  );
  app.post('/alliance', s(a, 'Found an alliance for 10,000 gold (alliance.createAlliance)', CreateAllianceResult, { body: CreateAllianceBody }), (req) =>
    game(req, (ctx, pid) => alliance.createAlliance(ctx, pid, req.body.cityId, req.body.allianceName)),
  );
  app.patch('/alliance', s(a, 'Note / intro / motd (alliance.setAllInfoForAlliance)', Empty, { body: SetAllianceInfoBody }), (req) =>
    game(req, (ctx, pid) => alliance.setInfo(ctx, pid, req.body)),
  );
  app.post('/alliance/leave', s(a, 'Leave (alliance.sayByetoAlliance / resignForAlliance)', Empty), (req) =>
    game(req, (ctx, pid) => alliance.leaveAlliance(ctx, pid)),
  );
  app.get('/alliance/members', s(a, 'Members (alliance.getAllianceMembers)', z.array(AllianceMember)), (req) =>
    game(req, (ctx, pid) => alliance.members(ctx, pid)),
  );
  app.get('/alliance/events', s(a, 'Event log (alliance.getAllianceEventList)', z.array(AllianceEvent)), (req) =>
    game(req, (ctx, pid) => alliance.events(ctx, pid)),
  );
  app.get('/alliance/military', s(a, 'Members’ armies (alliance.getMilitarySituationList)', z.array(AllianceMilitaryEntry)), (req) =>
    game(req, (ctx, pid) => alliance.militarySituation(ctx, pid)),
  );
  app.post('/alliance/invites', s(a, 'Invite (alliance.addUsertoAlliance)', Empty, { body: AllianceUserBody }), (req) =>
    game(req, (ctx, pid) => alliance.invite(ctx, pid, req.body.userName)),
  );
  app.get('/alliance/invites', s(a, 'Invitations sent (alliance.addUsertoAllianceList)', z.array(AllianceSentInvite)), (req) =>
    game(req, (ctx, pid) => alliance.sentInvites(ctx, pid)),
  );
  app.post('/alliance/invites/cancel', s(a, 'Withdraw (alliance.canceladdUsertoAlliance)', Empty, { body: AllianceUserBody }), (req) =>
    game(req, (ctx, pid) => alliance.cancelInvite(ctx, pid, req.body.userName)),
  );
  app.get('/alliance/my-invites', s(a, 'Invitations received (alliance.leaderWantUserInAllianceList)', z.array(AllianceReceivedInvite)), (req) =>
    game(req, (ctx, pid) => alliance.myInvites(ctx, pid)),
  );
  app.post('/alliance/my-invites/accept', s(a, 'Accept (alliance.agreeComeinAllianceByUser)', Empty, { body: AllianceNameBody }), (req) =>
    game(req, (ctx, pid) => alliance.acceptInvite(ctx, pid, req.body.allianceName)),
  );
  app.post('/alliance/my-invites/reject', s(a, 'Reject (alliance.rejectComeinAlliance)', Empty, { body: AllianceNameBody }), (req) =>
    game(req, (ctx, pid) => alliance.rejectInvite(ctx, pid, req.body.allianceName)),
  );
  app.post('/alliance/apply', s(a, 'Apply (alliance.userWantInAlliance)', Empty, { body: AllianceNameBody }), (req) =>
    game(req, (ctx, pid) => alliance.apply(ctx, pid, req.body.allianceName)),
  );
  app.delete('/alliance/apply', s(a, 'Withdraw application (alliance.cancelUserWantInAlliance)', Empty), (req) =>
    game(req, (ctx, pid) => alliance.cancelApplication(ctx, pid)),
  );
  app.get('/alliance/apply', s(a, 'My pending application (alliance.getAllianceWanted)', AllianceApplicationStatus), (req) =>
    game(req, (ctx, pid) => alliance.myApplication(ctx, pid)),
  );
  app.get('/alliance/applications', s(a, 'Applications to review (alliance.agreeComeinAllianceList)', z.array(AllianceApplication)), (req) =>
    game(req, (ctx, pid) => alliance.applications(ctx, pid)),
  );
  app.post('/alliance/applications/accept', s(a, 'Accept (alliance.agreeComeinAllianceByLeader)', Empty, { body: AllianceUserBody }), (req) =>
    game(req, (ctx, pid) => alliance.acceptApplication(ctx, pid, req.body.userName)),
  );
  app.post('/alliance/applications/decline', s(a, 'Decline (alliance.cancelagreeComeinAlliance)', Empty, { body: AllianceUserBody }), (req) =>
    game(req, (ctx, pid) => alliance.declineApplication(ctx, pid, req.body.userName)),
  );
  app.post('/alliance/members/rank', s(a, 'Set rank 5-8 (alliance.setPowerForUserByAlliance)', Empty, { body: SetAllianceRankBody }), (req) =>
    game(req, (ctx, pid) => alliance.setRank(ctx, pid, req.body.userName, req.body.rank)),
  );
  app.post('/alliance/members/host', s(a, 'Hand over the Host title (alliance.resetTopPowerForAlliance)', Empty, { body: AllianceUserBody }), (req) =>
    game(req, (ctx, pid) => alliance.transferHost(ctx, pid, req.body.userName)),
  );
  app.post('/alliance/members/kick', s(a, 'Expel (alliance.kickOutMemberfromAlliance)', Empty, { body: AllianceUserBody }), (req) =>
    game(req, (ctx, pid) => alliance.kick(ctx, pid, req.body.userName)),
  );
  app.post('/alliance/mail', s(a, 'Circular to all members (alliance.messagesForAllianceMember)', Empty, { body: AllianceMassMailBody }), (req) =>
    game(req, (ctx, pid) => alliance.massMail(ctx, pid, req.body.title, req.body.content)),
  );
  app.put(
    '/alliance/relations',
    s(a, 'Diplomacy: 1 ally, 2 neutral, 3 enemy (alliance.setAllianceFriendship)', Empty, { body: SetAllianceRelationBody }),
    (req) => game(req, (ctx, pid) => alliance.setRelation(ctx, pid, req.body.targetAllianceName, req.body.type)),
  );
  app.delete('/alliance/relations/:name', s(a, 'Drop a relation (alliance.dropAllianceFriendshipRelation)', Empty, { params: AllianceNameParams }), (req) =>
    game(req, (ctx, pid) => alliance.dropRelation(ctx, pid, req.params.name)),
  );
}
