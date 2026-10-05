// Mail, reports, chat, friends and alliances.

import { z } from 'zod';
import { alliance, mail, reports, social } from '@evony/game';
import { doc, anon, authenticate, game, tags, zId, zIds, zPaging, type ZApp } from '../http.ts';

export default async function socialRoutes(app: ZApp) {
  app.addHook('preHandler', authenticate);
  const s = doc;

  // ---- mail ----
  app.get('/mail', s(tags.mail, 'Folder 1 inbox, 2 system, 3 sent (mail.receiveMailList)', { querystring: zPaging.extend({ type: z.coerce.number().int().default(1) }) }), (req) =>
    game(req, (ctx, pid) => mail.listMail(ctx, pid, req.query.type, req.query.pageNo, req.query.pageSize)),
  );
  app.get('/mail/unread', s(tags.mail, 'Unread counters (server.NewMail)'), (req) => game(req, (ctx, pid) => mail.mailCounts(ctx, pid)));
  app.get('/mail/:mailId', s(tags.mail, 'Read (mail.readMail)', { params: z.object({ mailId: zId }) }), (req) => game(req, (ctx, pid) => mail.readMail(ctx, pid, req.params.mailId)));
  app.post('/mail', s(tags.mail, 'Send (mail.sendMail)', { body: z.object({ to: z.string(), title: z.string(), content: z.string() }) }), (req) =>
    game(req, (ctx, pid) => mail.sendMail(ctx, pid, req.body.to, req.body.title, req.body.content)),
  );
  app.post('/mail/read', s(tags.mail, 'Mark read (mail.readOverMailList)', { body: zIds }), (req) => game(req, (ctx, pid) => mail.markMailRead(ctx, pid, req.body.ids)));
  app.post('/mail/delete', s(tags.mail, 'Delete (mail.deleteMail)', { body: zIds }), (req) => game(req, (ctx, pid) => mail.deleteMail(ctx, pid, req.body.ids)));

  // ---- reports ----
  app.get(
    '/reports',
    s(tags.reports, 'Type 0 trade, 1 army, 2 other (report.receiveReportList)', { querystring: zPaging.extend({ type: z.coerce.number().int().optional() }) }),
    (req) => game(req, (ctx, pid) => reports.listReports(ctx, pid, req.query.type ?? null, req.query.pageNo, req.query.pageSize)),
  );
  app.get('/reports/unread', s(tags.reports, 'Unread counters (server.NewReport)'), (req) => game(req, (ctx, pid) => reports.reportCounts(ctx, pid)));
  app.get('/reports/:reportId', s(tags.reports, 'Open a report (report.markAsRead)', { params: z.object({ reportId: zId }) }), (req) =>
    game(req, (ctx, pid) => reports.readReport(ctx, pid, req.params.reportId)),
  );
  app.post('/reports/read', s(tags.reports, 'Mark read (report.readOverReport); omit ids for all', { body: z.object({ ids: z.array(z.number().int()).optional() }) }), (req) =>
    game(req, (ctx, pid) => reports.markReportsRead(ctx, pid, req.body.ids ?? 'all')),
  );
  app.post('/reports/delete', s(tags.reports, 'Delete (report.deleteReport)', { body: zIds }), (req) => game(req, (ctx, pid) => reports.deleteReports(ctx, pid, req.body.ids)));

  // ---- chat ----
  const msg = z.object({ msg: z.string() });
  app.post('/chat/world', s(tags.chat, 'World channel, costs 1 Speaker (common.worldChat)', { body: msg }), (req) => game(req, (ctx, pid) => social.worldChat(ctx, pid, req.body.msg, 'world')));
  app.post('/chat/beginner', s(tags.chat, 'Beginner channel (common.channelChat)', { body: msg }), (req) => game(req, (ctx, pid) => social.worldChat(ctx, pid, req.body.msg, 'beginner')));
  app.post('/chat/alliance', s(tags.chat, 'Alliance channel (common.allianceChat)', { body: msg }), (req) => game(req, (ctx, pid) => social.allianceChat(ctx, pid, req.body.msg)));
  app.post('/chat/private', s(tags.chat, 'Whisper (common.privateChat)', { body: msg.extend({ to: z.string() }) }), (req) =>
    game(req, (ctx, pid) => social.privateChat(ctx, pid, req.body.to, req.body.msg)),
  );
  app.get(
    '/chat/:channel',
    s(tags.chat, 'Recent messages', { params: z.object({ channel: z.enum(['world', 'beginner', 'alliance', 'private']) }), querystring: z.object({ since: z.coerce.number().default(0) }) }),
    (req) => game(req, (ctx, pid) => social.chatHistory(ctx, pid, req.params.channel, req.query.since)),
  );

  // ---- friends & blocks ----
  app.get('/friends', s(tags.social, 'Friends and blocked lords'), (req) => game(req, (ctx, pid) => social.listRelations(ctx, pid)));
  for (const kind of ['friend', 'block'] as const) {
    const path = kind === 'friend' ? '/friends' : '/blocks';
    app.post(path, s(tags.social, `Add (friend.add${kind === 'friend' ? 'Friend' : 'Block'})`, { body: z.object({ name: z.string() }) }), (req) =>
      game(req, (ctx, pid) => social.addRelation(ctx, pid, req.body.name, kind)),
    );
    app.delete(`${path}/:playerId`, s(tags.social, `Remove (friend.delete${kind === 'friend' ? 'Friend' : 'Block'})`, { params: z.object({ playerId: zId }) }), (req) =>
      game(req, (ctx, pid) => social.removeRelation(ctx, pid, req.params.playerId, kind)),
    );
  }

  // ---- alliance ----
  const a = tags.alliance;
  const nameBody = z.object({ allianceName: z.string() });
  const userBody = z.object({ userName: z.string() });
  app.get('/alliance', s(a, 'My alliance with relations (alliance.isHasAlliance)'), (req) => game(req, (ctx, pid) => alliance.myAlliance(ctx, pid)));
  app.get('/alliances', s(a, 'Browse / search alliances (alliance.getAllianceList)', { querystring: zPaging.extend({ key: z.string().default('') }) }), (req) =>
    anon(req, (ctx) => alliance.listAlliances(ctx, req.query.key, req.query.pageNo, req.query.pageSize)),
  );
  app.get('/alliances/:name', s(a, 'Public info (alliance.getAllianceInfo)', { params: z.object({ name: z.string() }) }), (req) => anon(req, (ctx) => alliance.allianceInfo(ctx, req.params.name)));
  app.post('/alliance', s(a, 'Found an alliance for 10,000 gold (alliance.createAlliance)', { body: z.object({ cityId: zId, allianceName: z.string() }) }), (req) =>
    game(req, (ctx, pid) => alliance.createAlliance(ctx, pid, req.body.cityId, req.body.allianceName)),
  );
  app.patch('/alliance', s(a, 'Note / intro / motd (alliance.setAllInfoForAlliance)', { body: z.object({ note: z.string(), intro: z.string(), motd: z.string() }).partial() }), (req) =>
    game(req, (ctx, pid) => alliance.setInfo(ctx, pid, req.body)),
  );
  app.post('/alliance/leave', s(a, 'Leave (alliance.sayByetoAlliance / resignForAlliance)'), (req) => game(req, (ctx, pid) => alliance.leaveAlliance(ctx, pid)));
  app.get('/alliance/members', s(a, 'Members (alliance.getAllianceMembers)'), (req) => game(req, (ctx, pid) => alliance.members(ctx, pid)));
  app.get('/alliance/events', s(a, 'Event log (alliance.getAllianceEventList)'), (req) => game(req, (ctx, pid) => alliance.events(ctx, pid)));
  app.get('/alliance/military', s(a, 'Members’ armies (alliance.getMilitarySituationList)'), (req) => game(req, (ctx, pid) => alliance.militarySituation(ctx, pid)));
  app.post('/alliance/invites', s(a, 'Invite (alliance.addUsertoAlliance)', { body: userBody }), (req) => game(req, (ctx, pid) => alliance.invite(ctx, pid, req.body.userName)));
  app.get('/alliance/invites', s(a, 'Invitations sent (alliance.addUsertoAllianceList)'), (req) => game(req, (ctx, pid) => alliance.sentInvites(ctx, pid)));
  app.post('/alliance/invites/cancel', s(a, 'Withdraw (alliance.canceladdUsertoAlliance)', { body: userBody }), (req) => game(req, (ctx, pid) => alliance.cancelInvite(ctx, pid, req.body.userName)));
  app.get('/alliance/my-invites', s(a, 'Invitations received (alliance.leaderWantUserInAllianceList)'), (req) => game(req, (ctx, pid) => alliance.myInvites(ctx, pid)));
  app.post('/alliance/my-invites/accept', s(a, 'Accept (alliance.agreeComeinAllianceByUser)', { body: nameBody }), (req) => game(req, (ctx, pid) => alliance.acceptInvite(ctx, pid, req.body.allianceName)));
  app.post('/alliance/my-invites/reject', s(a, 'Reject (alliance.rejectComeinAlliance)', { body: nameBody }), (req) => game(req, (ctx, pid) => alliance.rejectInvite(ctx, pid, req.body.allianceName)));
  app.post('/alliance/apply', s(a, 'Apply (alliance.userWantInAlliance)', { body: nameBody }), (req) => game(req, (ctx, pid) => alliance.apply(ctx, pid, req.body.allianceName)));
  app.delete('/alliance/apply', s(a, 'Withdraw application (alliance.cancelUserWantInAlliance)'), (req) => game(req, (ctx, pid) => alliance.cancelApplication(ctx, pid)));
  app.get('/alliance/apply', s(a, 'My pending application (alliance.getAllianceWanted)'), (req) => game(req, (ctx, pid) => alliance.myApplication(ctx, pid)));
  app.get('/alliance/applications', s(a, 'Applications to review (alliance.agreeComeinAllianceList)'), (req) => game(req, (ctx, pid) => alliance.applications(ctx, pid)));
  app.post('/alliance/applications/accept', s(a, 'Accept (alliance.agreeComeinAllianceByLeader)', { body: userBody }), (req) =>
    game(req, (ctx, pid) => alliance.acceptApplication(ctx, pid, req.body.userName)),
  );
  app.post('/alliance/applications/decline', s(a, 'Decline (alliance.cancelagreeComeinAlliance)', { body: userBody }), (req) =>
    game(req, (ctx, pid) => alliance.declineApplication(ctx, pid, req.body.userName)),
  );
  app.post('/alliance/members/rank', s(a, 'Set rank 5-8 (alliance.setPowerForUserByAlliance)', { body: userBody.extend({ rank: z.number().int() }) }), (req) =>
    game(req, (ctx, pid) => alliance.setRank(ctx, pid, req.body.userName, req.body.rank)),
  );
  app.post('/alliance/members/host', s(a, 'Hand over the Host title (alliance.resetTopPowerForAlliance)', { body: userBody }), (req) =>
    game(req, (ctx, pid) => alliance.transferHost(ctx, pid, req.body.userName)),
  );
  app.post('/alliance/members/kick', s(a, 'Expel (alliance.kickOutMemberfromAlliance)', { body: userBody }), (req) => game(req, (ctx, pid) => alliance.kick(ctx, pid, req.body.userName)));
  app.post('/alliance/mail', s(a, 'Circular to all members (alliance.messagesForAllianceMember)', { body: z.object({ title: z.string(), content: z.string() }) }), (req) =>
    game(req, (ctx, pid) => alliance.massMail(ctx, pid, req.body.title, req.body.content)),
  );
  app.put(
    '/alliance/relations',
    s(a, 'Diplomacy: 1 ally, 2 neutral, 3 enemy (alliance.setAllianceFriendship)', { body: z.object({ targetAllianceName: z.string(), type: z.number().int() }) }),
    (req) => game(req, (ctx, pid) => alliance.setRelation(ctx, pid, req.body.targetAllianceName, req.body.type)),
  );
  app.delete('/alliance/relations/:name', s(a, 'Drop a relation (alliance.dropAllianceFriendshipRelation)', { params: z.object({ name: z.string() }) }), (req) =>
    game(req, (ctx, pid) => alliance.dropRelation(ctx, pid, req.params.name)),
  );
  app.post('/alliance/items', s(a, 'Use Ritual of Pact', { body: z.object({ itemId: z.string() }) }), (req) => game(req, (ctx, pid) => alliance.usePactItem(ctx, pid, req.body.itemId)));

}
