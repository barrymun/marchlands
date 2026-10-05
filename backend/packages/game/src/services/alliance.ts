// alliance.* — with the original's permission gaps closed (spec military-alliance-economy.md §4).
// Ranks: 4 Host, 5 Vice Host, 6 Presbyter, 7 Officer, 8 Member (lower = more power).

import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { ALLIANCE_PACT_ITEMS, AllianceRank, BALANCE, BuildingType, buildingLevel, GameError, Relation, scaled } from '@evony/core';
import { allianceEvents, allianceRelations, allianceRequests, alliances, armies, players } from '@evony/db';
import { openOwnCity } from '../city.ts';
import { sendSystemMail } from './mail.ts';
import type { Ctx } from '../context.ts';
import { assertClean, consumeItem, itemCount, pushPlayerInfo, spendResources } from '../helpers.ts';
import { citiesOf, findPlayerByName, getPlayer, saveCity, savePlayer, type PlayerRow } from '../repo.ts';

export type AllianceRow = typeof alliances.$inferSelect;

export const RANK_NAMES: Record<number, string> = { 4: 'Host', 5: 'Vice Host', 6: 'Presbyter', 7: 'Officer', 8: 'Member' };
export const rankName = (r: number) => RANK_NAMES[r] ?? 'No Rank';

/** Max members of a rank (Evony limits); Host is unique. */
const RANK_LIMITS: Record<number, number> = { 4: 1, 5: 2, 6: 4, 7: 10 };

async function getAlliance(ctx: Ctx, id: number, lock = false): Promise<AllianceRow> {
  const q = ctx.tx.select().from(alliances).where(eq(alliances.id, id));
  const [row] = lock ? await q.for('update') : await q;
  if (!row) throw new GameError('Alliance does not exist.', -99, 404);
  return row;
}
async function allianceByName(ctx: Ctx, name: string, lock = false): Promise<AllianceRow> {
  const q = ctx.tx.select().from(alliances).where(sql`lower(${alliances.name}) = lower(${name})`);
  const [row] = lock ? await q.for('update') : await q;
  if (!row) throw new GameError('Alliance does not exist.', -99, 404);
  return row;
}
async function saveAlliance(ctx: Ctx, a: AllianceRow) {
  const { id, createdAt: _c, ...rest } = a;
  await ctx.tx.update(alliances).set(rest).where(eq(alliances.id, id));
}

function requireMember(p: PlayerRow): number {
  if (!p.allianceId) throw new GameError('Not a member of an alliance.', -99);
  return p.allianceId;
}
function requireRank(p: PlayerRow, maxRank: number) {
  requireMember(p);
  if (p.allianceRank > maxRank) throw new GameError('You are not entitled to operate.', -42);
}

async function memberIds(ctx: Ctx, allianceId: number): Promise<number[]> {
  const rows = await ctx.tx.select({ id: players.id }).from(players).where(eq(players.allianceId, allianceId));
  return rows.map((r) => r.id);
}

/** Alliance-wide system message + event log entry. */
async function announce(ctx: Ctx, allianceId: number, msg: string, opts: { noSender?: boolean } = {}) {
  await ctx.tx.insert(allianceEvents).values({ allianceId, message: msg, createdAt: ctx.now });
  ctx.push(await memberIds(ctx, allianceId), 'server.SystemInfoMsg', {
    alliance: true,
    sender: 'Alliance Msg',
    tV: false,
    noSenderSystemInfo: opts.noSender ?? false,
    msg,
  });
}

async function memberLimit(a: AllianceRow, now: number) {
  return a.pactUntil > now ? Math.max(a.maxMembers, 1000) : a.maxMembers;
}

async function joinPlayer(ctx: Ctx, p: PlayerRow, a: AllianceRow, rank: number) {
  const [{ n }] = await ctx.tx.select({ n: count() }).from(players).where(eq(players.allianceId, a.id));
  if (Number(n) >= (await memberLimit(a, ctx.now))) throw new GameError('The alliance is full.', -99);
  p.allianceId = a.id;
  p.allianceRank = rank;
  p.allianceJoinedAt = ctx.now;
  p.misc = { ...p.misc, allianceApply: undefined, allianceApplyAt: undefined };
  await ctx.tx.delete(allianceRequests).where(eq(allianceRequests.playerId, p.id));
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

function assertRejoinCooldown(p: PlayerRow, allianceId: number, now: number) {
  if (p.misc.lastAllianceLeftId === allianceId && now - (p.misc.lastAllianceLeftAt ?? 0) < scaled(23 * 3_600_000)) {
    throw new GameError('Can not join the same Alliance again in 23 hours.', -301);
  }
}

// ---------------------------------------------------------------------------------------------
// Info
// ---------------------------------------------------------------------------------------------

const summary = (a: AllianceRow) => ({
  id: a.id,
  allianceName: a.name,
  rank: a.prestigeRank,
  prestige: Math.floor(a.prestige),
  honor: Math.floor(a.honor),
  memberCount: a.memberCount,
});

/** alliance.isHasAlliance */
export async function myAlliance(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId);
  if (!p.allianceId) return null;
  const a = await getAlliance(ctx, p.allianceId);
  const leader = a.leaderPlayerId ? await getPlayer(ctx, a.leaderPlayerId).catch(() => null) : null;
  const [{ n }] = await ctx.tx.select({ n: count() }).from(players).where(eq(players.allianceId, a.id));
  return {
    ...(await relationLists(ctx, a.id)),
    myRank: p.allianceRank,
    myRankName: rankName(p.allianceRank),
    alliance: {
      id: a.id,
      allianceName: a.name,
      creatorName: a.founderName,
      leaderName: leader?.name ?? '',
      allianceNote: a.note,
      allianceInfo: a.intro,
      motd: a.motd,
      memberCount: Number(n),
      memberLimit: await memberLimit(a, ctx.now),
      prestige: Math.floor(a.prestige),
      rank: a.prestigeRank,
      pactUntil: a.pactUntil,
    },
  };
}

/** alliance.getAllianceFriendshipList */
export async function relationLists(ctx: Ctx, allianceId: number) {
  const rows = await ctx.tx
    .select({ relation: allianceRelations.relation, a: alliances })
    .from(allianceRelations)
    .innerJoin(alliances, eq(alliances.id, allianceRelations.targetAllianceId))
    .where(eq(allianceRelations.allianceId, allianceId));
  const pick = (r: number) => rows.filter((x) => x.relation === r).map((x) => summary(x.a));
  return { friendlyList: pick(Relation.ALLY), middleList: pick(Relation.NEUTRAL), enemyList: pick(Relation.ENEMY) };
}

/** alliance.getAllianceInfo */
export async function allianceInfo(ctx: Ctx, name: string) {
  const a = await allianceByName(ctx, name);
  const leader = a.leaderPlayerId ? await getPlayer(ctx, a.leaderPlayerId).catch(() => null) : null;
  return {
    id: a.id,
    allianceName: a.name,
    leader: leader?.name ?? '',
    creator: a.founderName,
    prestigeCount: Math.floor(a.prestige),
    ranking: a.prestigeRank,
    memberCount: a.memberCount,
    allianceInfo: a.intro,
  };
}

/** alliance.getAllianceList (search) */
export async function listAlliances(ctx: Ctx, key: string, pageNo: number, pageSize: number) {
  const size = Math.min(50, Math.max(1, pageSize));
  const page = Math.max(1, pageNo);
  const where = key ? ilike(alliances.name, `%${key.replace(/[%_]/g, '')}%`) : undefined;
  const [{ n }] = await ctx.tx.select({ n: count() }).from(alliances).where(where);
  const rows = await ctx.tx
    .select()
    .from(alliances)
    .where(where)
    .orderBy(desc(alliances.prestige), asc(alliances.id))
    .limit(size)
    .offset((page - 1) * size);
  return { pageNo: page, pageSize: size, totalPage: Math.ceil(Number(n) / size), alliances: rows.map(summary) };
}

/** alliance.getAllianceMembers */
export async function members(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId);
  const allianceId = requireMember(p);
  const rows = await ctx.tx
    .select({
      id: players.id,
      userName: players.name,
      levelId: players.allianceRank,
      prestige: players.prestige,
      honor: players.honor,
      ranking: players.prestigeRank,
      titleId: players.title,
      population: players.population,
      lastLoginTime: players.lastSeenAt,
      castleCount: sql<number>`(select count(*) from cities c where c.player_id = ${players.id})`,
    })
    .from(players)
    .where(eq(players.allianceId, allianceId))
    .orderBy(asc(players.allianceRank), desc(players.prestige));
  return rows.map((r) => ({ ...r, prestige: Math.floor(r.prestige), honor: Math.floor(r.honor), castleCount: Number(r.castleCount), allianceLevel: rankName(r.levelId) }));
}

/** alliance.getAllianceEventList */
export async function events(ctx: Ctx, playerId: number, limit = 50) {
  const p = await getPlayer(ctx, playerId);
  const allianceId = requireMember(p);
  return ctx.tx
    .select({ message: allianceEvents.message, time: allianceEvents.createdAt })
    .from(allianceEvents)
    .where(eq(allianceEvents.allianceId, allianceId))
    .orderBy(desc(allianceEvents.createdAt))
    .limit(Math.min(200, limit));
}

/** alliance.getMilitarySituationList: armies of members currently out. */
export async function militarySituation(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId);
  const allianceId = requireMember(p);
  const ids = await memberIds(ctx, allianceId);
  const rows = await ctx.tx
    .select({ a: armies, king: players.name })
    .from(armies)
    .innerJoin(players, eq(players.id, armies.playerId))
    .where(or(inArray(armies.playerId, ids), inArray(armies.targetPlayerId, ids)));
  return rows.map(({ a, king }) => ({
    armyId: a.id,
    king,
    missionType: a.mission,
    direction: a.direction,
    startPosName: a.startPosName,
    targetPosName: a.targetPosName,
    reachTime: a.reachTime,
    incoming: !ids.includes(a.playerId),
  }));
}

// ---------------------------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------------------------

/** alliance.createAlliance: 10,000 gold from the given city. */
export async function createAlliance(ctx: Ctx, playerId: number, cityId: number, rawName: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (p.allianceId) throw new GameError('Already a member of an alliance.', -99);
  const name = String(rawName ?? '').trim();
  if (name.length < 2 || name.length > 20 || !/^[\p{L}\p{N} _.-]+$/u.test(name)) throw new GameError('Illegal naming, please choose another name.', -99);
  assertClean(name);
  const [dupe] = await ctx.tx.select({ id: alliances.id }).from(alliances).where(sql`lower(${alliances.name}) = lower(${name})`);
  if (dupe) throw new GameError(`Alliance already existed: ${name}.`, -12, 409);
  const b = await openOwnCity(ctx, playerId, cityId);
  spendResources(b.city, { gold: BALANCE.allianceCreateGold }, 'Not enough gold.', -99);
  await saveCity(ctx, b.city);
  const [a] = await ctx.tx
    .insert(alliances)
    .values({ name, founderName: p.name, leaderPlayerId: p.id, maxMembers: BALANCE.allianceMaxMembers, memberCount: 1, createdAt: ctx.now })
    .returning();
  await joinPlayer(ctx, p, a, AllianceRank.HOST);
  await announce(ctx, a.id, `Establish alliance ${name} successfully.`);
  return { id: a.id, msg: `Establish alliance ${name} successfully.` };
}

/** alliance.setAllInfoForAlliance (Host / Vice Host) */
export async function setInfo(ctx: Ctx, playerId: number, info: { note?: string; intro?: string; motd?: string }) {
  const p = await getPlayer(ctx, playerId);
  requireRank(p, AllianceRank.VICE_HOST);
  const a = await getAlliance(ctx, p.allianceId!, true);
  if (info.note != null) a.note = String(info.note).slice(0, 2000);
  if (info.intro != null) a.intro = String(info.intro).slice(0, 2000);
  if (info.motd != null) a.motd = String(info.motd).slice(0, 500);
  await saveAlliance(ctx, a);
}

/** Delete an empty alliance and everything hanging off it. */
async function disband(ctx: Ctx, allianceId: number) {
  await ctx.tx.update(players).set({ allianceId: null, allianceRank: 0 }).where(eq(players.allianceId, allianceId));
  await ctx.tx.delete(alliances).where(eq(alliances.id, allianceId));
}

/**
 * alliance.sayByetoAlliance / resignForAlliance: leave. A host must hand over first unless they
 * are the last member, in which case the alliance is disbanded.
 */
export async function leaveAlliance(ctx: Ctx, playerId: number, opts: { force?: boolean } = {}) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const allianceId = requireMember(p);
  const a = await getAlliance(ctx, allianceId, true);
  const [{ n }] = await ctx.tx.select({ n: count() }).from(players).where(eq(players.allianceId, allianceId));
  if (p.allianceRank === AllianceRank.HOST && Number(n) > 1 && !opts.force) {
    throw new GameError('Resignation refused. Please transfer your host title to other before you resign.', -99);
  }
  p.allianceId = null;
  p.allianceRank = 0;
  p.misc = { ...p.misc, lastAllianceLeftAt: ctx.now, lastAllianceLeftId: allianceId };
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
  if (Number(n) <= 1) return disband(ctx, allianceId);
  if (a.leaderPlayerId === playerId) {
    // forced exit of a host: promote the highest ranked remaining member
    const [heir] = await ctx.tx
      .select()
      .from(players)
      .where(eq(players.allianceId, allianceId))
      .orderBy(asc(players.allianceRank), desc(players.prestige))
      .limit(1);
    if (heir) {
      await ctx.tx.update(players).set({ allianceRank: AllianceRank.HOST }).where(eq(players.id, heir.id));
      a.leaderPlayerId = heir.id;
      await saveAlliance(ctx, a);
    }
  }
  await announce(ctx, allianceId, `${p.name} has left the alliance`, { noSender: true });
}

// ---------------------------------------------------------------------------------------------
// Invitations & applications
// ---------------------------------------------------------------------------------------------

/** alliance.addUsertoAlliance: invite (Presbyter or above). */
export async function invite(ctx: Ctx, playerId: number, userName: string) {
  const p = await getPlayer(ctx, playerId);
  requireRank(p, AllianceRank.PRESIDENT);
  const target = await findPlayerByName(ctx, userName);
  if (!target) throw new GameError(`Player ${userName} doesn't exist.`, -41, 404);
  if (target.allianceId) throw new GameError(`${userName} is already a member of other alliance.`, -99);
  await ctx.tx
    .insert(allianceRequests)
    .values({ allianceId: p.allianceId!, playerId: target.id, kind: 'invite', invitedByName: p.name, createdAt: ctx.now })
    .onConflictDoNothing();
  const a = await getAlliance(ctx, p.allianceId!);
  ctx.push(target.id, 'server.SystemInfoMsg', { alliance: false, tV: false, noSenderSystemInfo: false, msg: `You have been invited to the alliance ${a.name}` });
  ctx.push(target.id, 'server.AllianceInvite', { allianceName: a.name, invitePerson: p.name });
}

/** alliance.canceladdUsertoAlliance */
export async function cancelInvite(ctx: Ctx, playerId: number, userName: string) {
  const p = await getPlayer(ctx, playerId);
  requireRank(p, AllianceRank.PRESIDENT);
  const target = await findPlayerByName(ctx, userName);
  if (!target) throw new GameError(`Player ${userName} doesn't exist.`, -41, 404);
  await ctx.tx
    .delete(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, p.allianceId!), eq(allianceRequests.playerId, target.id), eq(allianceRequests.kind, 'invite')));
}

/** alliance.addUsertoAllianceList: invitations my alliance sent. */
export async function sentInvites(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId);
  const allianceId = requireMember(p);
  const rows = await ctx.tx
    .select({ userName: players.name, prestige: players.prestige, rank: players.prestigeRank, invitePerson: allianceRequests.invitedByName, inviteTime: allianceRequests.createdAt })
    .from(allianceRequests)
    .innerJoin(players, eq(players.id, allianceRequests.playerId))
    .where(and(eq(allianceRequests.allianceId, allianceId), eq(allianceRequests.kind, 'invite')));
  return rows.map((r) => ({ ...r, prestige: Math.floor(r.prestige) }));
}

/** alliance.leaderWantUserInAllianceList: invitations I received. */
export async function myInvites(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx
    .select({ allianceName: alliances.name, prestige: alliances.prestige, rank: alliances.prestigeRank, memberCount: alliances.memberCount, invitePerson: allianceRequests.invitedByName })
    .from(allianceRequests)
    .innerJoin(alliances, eq(alliances.id, allianceRequests.allianceId))
    .where(and(eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, 'invite')));
  return rows.map((r) => ({ ...r, prestige: Math.floor(r.prestige) }));
}

/** alliance.agreeComeinAllianceByUser: accept an invitation (needs an Embassy). */
export async function acceptInvite(ctx: Ctx, playerId: number, allianceName: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (p.allianceId) throw new GameError('Already a member of an alliance.', -99);
  await requireEmbassy(ctx, playerId);
  const a = await allianceByName(ctx, allianceName, true);
  const [inv] = await ctx.tx
    .select()
    .from(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, a.id), eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, 'invite')));
  if (!inv) throw new GameError('Invite no longer exists.', -99);
  assertRejoinCooldown(p, a.id, ctx.now);
  await joinPlayer(ctx, p, a, AllianceRank.MEMBER);
  await announce(ctx, a.id, `${p.name} has joined the alliance.`);
}

/** alliance.rejectComeinAlliance */
export async function rejectInvite(ctx: Ctx, playerId: number, allianceName: string) {
  const a = await allianceByName(ctx, allianceName);
  await ctx.tx
    .delete(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, a.id), eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, 'invite')));
}

async function requireEmbassy(ctx: Ctx, playerId: number) {
  const list = await citiesOf(ctx, playerId);
  if (!list.some((c) => buildingLevel(c.buildings, BuildingType.EMBASSY) >= 1)) throw new GameError('You need to build an embassy first.', -99);
}

/** alliance.userWantInAlliance: apply (one application at a time). */
export async function apply(ctx: Ctx, playerId: number, allianceName: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (p.allianceId) throw new GameError('Already a member of an alliance.', -99);
  await requireEmbassy(ctx, playerId);
  const a = await allianceByName(ctx, allianceName);
  assertRejoinCooldown(p, a.id, ctx.now);
  await ctx.tx.delete(allianceRequests).where(and(eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, 'apply')));
  await ctx.tx.insert(allianceRequests).values({ allianceId: a.id, playerId, kind: 'apply', createdAt: ctx.now });
  p.misc = { ...p.misc, allianceApply: a.name, allianceApplyAt: ctx.now };
  await savePlayer(ctx, p);
  await announce(ctx, a.id, `${p.name} has applied to join your alliance`);
}

/** alliance.cancelUserWantInAlliance */
export async function cancelApplication(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (!p.misc.allianceApply) throw new GameError('Not applied.', -99);
  await ctx.tx.delete(allianceRequests).where(and(eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, 'apply')));
  p.misc = { ...p.misc, allianceApply: undefined, allianceApplyAt: undefined };
  await savePlayer(ctx, p);
}

/** alliance.getAllianceWanted */
export async function myApplication(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId);
  return { allianceName: p.misc.allianceApply ?? null, applyTime: p.misc.allianceApplyAt ?? null };
}

/** alliance.agreeComeinAllianceList: pending applications (Presbyter or above). */
export async function applications(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId);
  requireRank(p, AllianceRank.PRESIDENT);
  const rows = await ctx.tx
    .select({
      userName: players.name,
      prestige: players.prestige,
      rank: players.prestigeRank,
      inviteTime: allianceRequests.createdAt,
      castleCount: sql<number>`(select count(*) from cities c where c.player_id = ${players.id})`,
    })
    .from(allianceRequests)
    .innerJoin(players, eq(players.id, allianceRequests.playerId))
    .where(and(eq(allianceRequests.allianceId, p.allianceId!), eq(allianceRequests.kind, 'apply')));
  return rows.map((r) => ({ ...r, prestige: Math.floor(r.prestige), castleCount: Number(r.castleCount) }));
}

/** alliance.agreeComeinAllianceByLeader */
export async function acceptApplication(ctx: Ctx, playerId: number, userName: string) {
  const officer = await getPlayer(ctx, playerId);
  requireRank(officer, AllianceRank.PRESIDENT);
  const target0 = await findPlayerByName(ctx, userName);
  if (!target0) throw new GameError(`Player ${userName} doesn't exist.`, -41, 404);
  const target = await getPlayer(ctx, target0.id, { lock: true });
  if (target.allianceId) throw new GameError(`${userName} is already a member of other alliance.`, -99);
  const [req] = await ctx.tx
    .select()
    .from(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, officer.allianceId!), eq(allianceRequests.playerId, target.id), eq(allianceRequests.kind, 'apply')));
  if (!req) throw new GameError('Application no longer exists.', -99);
  const a = await getAlliance(ctx, officer.allianceId!, true);
  await joinPlayer(ctx, target, a, AllianceRank.MEMBER);
  await announce(ctx, a.id, `${target.name} has joined the alliance.`);
}

/** alliance.cancelagreeComeinAlliance: decline an application. */
export async function declineApplication(ctx: Ctx, playerId: number, userName: string) {
  const officer = await getPlayer(ctx, playerId);
  requireRank(officer, AllianceRank.PRESIDENT);
  const target = await findPlayerByName(ctx, userName);
  if (!target) throw new GameError(`Player ${userName} doesn't exist.`, -41, 404);
  await ctx.tx
    .delete(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, officer.allianceId!), eq(allianceRequests.playerId, target.id), eq(allianceRequests.kind, 'apply')));
  target.misc = { ...target.misc, allianceApply: undefined, allianceApplyAt: undefined };
  await ctx.tx.update(players).set({ misc: target.misc }).where(eq(players.id, target.id));
}

// ---------------------------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------------------------

/** alliance.setPowerForUserByAlliance: actor must outrank both the old and the new rank. */
export async function setRank(ctx: Ctx, playerId: number, userName: string, rank: number) {
  if (![5, 6, 7, 8].includes(rank)) throw new GameError('Invalid rank.', -99);
  const me = await getPlayer(ctx, playerId);
  requireMember(me);
  const t0 = await findPlayerByName(ctx, userName);
  if (!t0 || t0.allianceId !== me.allianceId) throw new GameError('Member does not exist.', -99);
  if (t0.id === me.id) throw new GameError('You cannot change your own rank.', -99);
  const target = await getPlayer(ctx, t0.id, { lock: true });
  if (me.allianceRank >= target.allianceRank || me.allianceRank >= rank) throw new GameError('You are not entitled to operate.', -42);
  const limit = RANK_LIMITS[rank];
  if (limit) {
    const [{ n }] = await ctx.tx.select({ n: count() }).from(players).where(and(eq(players.allianceId, me.allianceId!), eq(players.allianceRank, rank)));
    if (Number(n) >= limit) throw new GameError(`An alliance may only have ${limit} ${rankName(rank)}.`, -99);
  }
  const verb = rank < target.allianceRank ? 'promotes' : 'demotes';
  target.allianceRank = rank;
  await savePlayer(ctx, target);
  await pushPlayerInfo(ctx, target);
  await announce(ctx, me.allianceId!, `${me.name} ${verb} ${target.name} to ${rankName(rank)}.`);
}

/** alliance.resetTopPowerForAlliance: Host hands over to a Vice Host. */
export async function transferHost(ctx: Ctx, playerId: number, userName: string) {
  const me = await getPlayer(ctx, playerId, { lock: true });
  requireMember(me);
  if (me.allianceRank !== AllianceRank.HOST) throw new GameError('You are not entitled to operate.', -42);
  const t0 = await findPlayerByName(ctx, userName);
  if (!t0 || t0.allianceId !== me.allianceId) throw new GameError(`Player ${userName} doesn't exist.`, -41);
  const target = await getPlayer(ctx, t0.id, { lock: true });
  if (target.allianceRank !== AllianceRank.VICE_HOST) {
    throw new GameError('The Host title of the Alliance can only be transferred to Vice Host. You need to promote this player first.', -88);
  }
  const a = await getAlliance(ctx, me.allianceId!, true);
  target.allianceRank = AllianceRank.HOST;
  me.allianceRank = AllianceRank.VICE_HOST;
  a.leaderPlayerId = target.id;
  await savePlayer(ctx, target);
  await savePlayer(ctx, me);
  await saveAlliance(ctx, a);
  await pushPlayerInfo(ctx, target);
  await pushPlayerInfo(ctx, me);
  await announce(ctx, a.id, `${target.name} is now the Host of the alliance.`);
}

/** alliance.kickOutMemberfromAlliance */
export async function kick(ctx: Ctx, playerId: number, userName: string) {
  const me = await getPlayer(ctx, playerId);
  requireMember(me);
  const t0 = await findPlayerByName(ctx, userName);
  if (!t0 || t0.allianceId !== me.allianceId) throw new GameError('Member does not exist.', -99);
  if (t0.id === me.id) throw new GameError('Cannot kick yourself.', -99);
  if (me.allianceRank >= t0.allianceRank) throw new GameError('Cannot kick someone higher ranking than you.', -99);
  const target = await getPlayer(ctx, t0.id, { lock: true });
  const allianceId = target.allianceId!;
  target.allianceId = null;
  target.allianceRank = 0;
  target.misc = { ...target.misc, lastAllianceLeftAt: ctx.now, lastAllianceLeftId: allianceId };
  await savePlayer(ctx, target);
  await pushPlayerInfo(ctx, target);
  await announce(ctx, allianceId, `${target.name} was removed from the alliance by ${me.name}.`);
}

/** alliance.messagesForAllianceMember: mail every member (Officer or above). */
export async function massMail(ctx: Ctx, playerId: number, title: string, content: string) {
  const me = await getPlayer(ctx, playerId);
  requireRank(me, AllianceRank.OFFICER);
  for (const id of await memberIds(ctx, me.allianceId!)) {
    if (id !== me.id) await sendSystemMail(ctx, id, `[Alliance] ${title}`, content, { fromId: me.id, fromName: me.name });
  }
}

// ---------------------------------------------------------------------------------------------
// Diplomacy
// ---------------------------------------------------------------------------------------------

/**
 * alliance.setAllianceFriendship: 1 ally, 2 neutral, 3 enemy (Host / Vice Host). Friendship and
 * neutrality are one-sided; war is mutual, announced to everyone and has a 24h cooldown.
 */
export async function setRelation(ctx: Ctx, playerId: number, targetName: string, type: number) {
  if (![1, 2, 3].includes(type)) throw new GameError('Invalid relation.', -99);
  const me = await getPlayer(ctx, playerId);
  requireRank(me, AllianceRank.VICE_HOST);
  const mine = await getAlliance(ctx, me.allianceId!, true);
  const target = await allianceByName(ctx, targetName, true);
  if (target.id === mine.id) throw new GameError('Invalid target alliance.', -99);
  const [cur] = await ctx.tx
    .select()
    .from(allianceRelations)
    .where(and(eq(allianceRelations.allianceId, mine.id), eq(allianceRelations.targetAllianceId, target.id)));
  const labels: Record<number, string> = { 1: 'an ally', 2: 'neutral', 3: 'an enemy' };
  if (cur?.relation === type) throw new GameError(`Alliance is already ${labels[type]}.`, -99);
  const upsert = async (from: number, to: number, relation: number) =>
    ctx.tx
      .insert(allianceRelations)
      .values({ allianceId: from, targetAllianceId: to, relation, createdAt: ctx.now })
      .onConflictDoUpdate({ target: [allianceRelations.allianceId, allianceRelations.targetAllianceId], set: { relation, createdAt: ctx.now } });
  if (type === Relation.ENEMY) {
    if (ctx.now < mine.warCooldownUntil) throw new GameError('You have already declared war recently.', -99);
    const until = ctx.now + scaled(BALANCE.allianceWarCooldownMs);
    await upsert(mine.id, target.id, Relation.ENEMY);
    await upsert(target.id, mine.id, Relation.ENEMY);
    mine.warCooldownUntil = until;
    target.warCooldownUntil = Math.max(target.warCooldownUntil, until);
    await saveAlliance(ctx, mine);
    await saveAlliance(ctx, target);
    ctx.broadcast('server.SystemInfoMsg', {
      alliance: false,
      tV: true,
      noSenderSystemInfo: true,
      msg: `Alliance ${mine.name} declares war against alliance ${target.name}. Diplomatic Relationship between each other alters to Hostile automatically.`,
    });
  } else {
    await upsert(mine.id, target.id, type);
  }
  await announce(ctx, target.id, `Alliance [${mine.name}] recognizes Diplomatic Relationship with us as ${type === 1 ? 'Ally' : type === 2 ? 'Neutral' : 'Enemy'}.`);
}

/** alliance.dropAllianceFriendshipRelation */
export async function dropRelation(ctx: Ctx, playerId: number, targetName: string) {
  const me = await getPlayer(ctx, playerId);
  requireRank(me, AllianceRank.VICE_HOST);
  const target = await allianceByName(ctx, targetName);
  await ctx.tx.delete(allianceRelations).where(and(eq(allianceRelations.allianceId, me.allianceId!), eq(allianceRelations.targetAllianceId, target.id)));
}

/** Ritual of Pact items: raise the member limit to 1000 for a while. */
export async function usePactItem(ctx: Ctx, playerId: number, itemId: string) {
  const ms = ALLIANCE_PACT_ITEMS[itemId];
  if (!ms) throw new GameError('Invalid Item.', -99);
  const p = await getPlayer(ctx, playerId, { lock: true });
  requireRank(p, AllianceRank.VICE_HOST);
  if (itemCount(p, itemId) <= 0) throw new GameError('Insufficient items.', -24);
  consumeItem(ctx, p, itemId);
  const a = await getAlliance(ctx, p.allianceId!, true);
  a.pactUntil = Math.max(a.pactUntil, ctx.now) + ms;
  await saveAlliance(ctx, a);
  await savePlayer(ctx, p);
}

/** Ranking job: aggregate members into alliance totals and ranks. */
export async function refreshAllianceStats(ctx: Ctx) {
  await ctx.tx.execute(sql`
    update alliances a set
      prestige = coalesce(s.prestige, 0), honor = coalesce(s.honor, 0),
      member_count = coalesce(s.members, 0), city_count = coalesce(s.cities, 0)
    from (
      select p.alliance_id, sum(p.prestige) prestige, sum(p.honor) honor, count(*) members,
             sum((select count(*) from cities c where c.player_id = p.id)) cities
      from players p where p.alliance_id is not null group by p.alliance_id
    ) s where s.alliance_id = a.id`);
  await ctx.tx.execute(sql`
    update alliances a set prestige_rank = r.pr, honor_rank = r.hr, members_rank = r.mr
    from (select id,
            row_number() over (order by prestige desc, id) pr,
            row_number() over (order by honor desc, id) hr,
            row_number() over (order by member_count desc, prestige desc, id) mr
          from alliances) r where r.id = a.id`);
}

