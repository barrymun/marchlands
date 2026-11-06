// alliance.* — with the original's permission gaps closed (spec military-alliance-economy.md §4).
// Ranks: 4 Host, 5 Vice Host, 6 Presbyter, 7 Officer, 8 Member (lower = more power).

import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  AllianceRank,
  AllianceRequestKind,
  BALANCE,
  buildingLevel,
  BuildingType,
  GameError,
  HOUR,
  type Message,
  msg,
  ref,
  Relation,
  ResourceKey,
  scaled,
  StatGroup,
  statKey,
} from '@marchlands/core';
import { allianceEvents, allianceRelations, allianceRequests, alliances, armies, one, players } from '@marchlands/db';

import { openOwnCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { sendSystemMail } from '#/engine/mail.ts';
import { assertClean, pushPlayerInfo, spendResources } from '#/helpers.ts';
import { citiesOf, findPlayerByName, getPlayer, type PlayerRow, saveCity, savePlayer } from '#/repo.ts';

export type AllianceRow = typeof alliances.$inferSelect;

/** A relation's name as a message (1 ally, 2 neutral, 3 enemy). */
const RELATION_MSGS: Record<number, Message> = {
  [Relation.ALLY]: msg('alliance.relation.ally'),
  [Relation.NEUTRAL]: msg('alliance.relation.neutral'),
  [Relation.ENEMY]: msg('alliance.relation.enemy'),
};

/** Alliance names: length and allowed characters. */
const NAME_MIN = 2;
const NAME_MAX = 20;
/** Hours (game time) before a player may rejoin the alliance they left (orig). */

/** Max members of a rank (Evony limits); Host is unique. */
const RANK_LIMITS: Record<number, number> = { 4: 1, 5: 2, 6: 4, 7: 10 };

async function getAlliance(ctx: Ctx, id: number, lock = false): Promise<AllianceRow> {
  const q = ctx.tx.select().from(alliances).where(eq(alliances.id, id));
  const [row] = lock ? await q.for('update') : await q;
  if (!row) throw new GameError(msg('alliance.notFound'), -99, 404);
  return row;
}
async function allianceByName(ctx: Ctx, name: string, lock = false): Promise<AllianceRow> {
  const q = ctx.tx
    .select()
    .from(alliances)
    .where(sql`lower(${alliances.name}) = lower(${name})`);
  const [row] = lock ? await q.for('update') : await q;
  if (!row) throw new GameError(msg('alliance.namedNotFound', { name }), -99, 404);
  return row;
}
async function saveAlliance(ctx: Ctx, a: AllianceRow) {
  const { id, createdAt: _c, ...rest } = a;
  await ctx.tx.update(alliances).set(rest).where(eq(alliances.id, id));
}

function requireMember(p: PlayerRow): number {
  if (!p.allianceId) throw new GameError(msg('alliance.notMember'), -99);
  return p.allianceId;
}
/** The player's alliance id, once they're a member at `maxRank` or above. */
function requireRank(p: PlayerRow, maxRank: number): number {
  const allianceId = requireMember(p);
  if (p.allianceRank > maxRank) throw new GameError(msg('alliance.rankTooLow'), -42);
  return allianceId;
}

async function memberIds(ctx: Ctx, allianceId: number): Promise<number[]> {
  const rows = await ctx.tx.select({ id: players.id }).from(players).where(eq(players.allianceId, allianceId));
  return rows.map((r) => r.id);
}

/** Alliance-wide system message + event log entry. */
async function announce(ctx: Ctx, allianceId: number, message: Message, opts: { noSender?: boolean } = {}) {
  await ctx.tx.insert(allianceEvents).values({ allianceId, message, createdAt: ctx.now });
  ctx.push(await memberIds(ctx, allianceId), PushCmd.SYSTEM_INFO_MESSAGE, {
    alliance: true,
    tV: false,
    noSenderSystemInfo: opts.noSender ?? false,
    msg: message,
  });
}

async function joinPlayer(ctx: Ctx, p: PlayerRow, a: AllianceRow, rank: number) {
  const { n } = one(await ctx.tx.select({ n: count() }).from(players).where(eq(players.allianceId, a.id)));
  if (Number(n) >= a.maxMembers) throw new GameError(msg('alliance.full'), -99);
  p.allianceId = a.id;
  p.allianceRank = rank;
  p.allianceJoinedAt = ctx.now;
  p.misc = { ...p.misc, allianceApply: undefined, allianceApplyAt: undefined };
  await ctx.tx.delete(allianceRequests).where(eq(allianceRequests.playerId, p.id));
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

function assertRejoinCooldown(p: PlayerRow, allianceId: number, now: number) {
  if (p.misc.lastAllianceLeftId === allianceId && now - (p.misc.lastAllianceLeftAt ?? 0) < scaled(BALANCE.allianceRejoinCooldownHours * HOUR)) {
    throw new GameError(msg('alliance.rejoinCooldown', { count: BALANCE.allianceRejoinCooldownHours }), -301);
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
  const { n } = one(await ctx.tx.select({ n: count() }).from(players).where(eq(players.allianceId, a.id)));
  return {
    ...(await relationLists(ctx, a.id)),
    myRank: p.allianceRank,
    alliance: {
      id: a.id,
      allianceName: a.name,
      creatorName: a.founderName,
      leaderName: leader?.name ?? '',
      allianceNote: a.note,
      allianceInfo: a.intro,
      motd: a.motd,
      memberCount: Number(n),
      memberLimit: a.maxMembers,
      prestige: Math.floor(a.prestige),
      rank: a.prestigeRank,
    },
  };
}

/** alliance.getAllianceFriendshipList */
async function relationLists(ctx: Ctx, allianceId: number) {
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
  const { n } = one(await ctx.tx.select({ n: count() }).from(alliances).where(where));
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
      // "players"."id" in full: without a join Drizzle would write a bare "id", which the subquery reads as cities.id
      castleCount: sql<number>`(select count(*) from cities c where c.player_id = "players"."id")`,
    })
    .from(players)
    .where(eq(players.allianceId, allianceId))
    .orderBy(asc(players.allianceRank), desc(players.prestige));
  return rows.map((r) => ({
    ...r,
    prestige: Math.floor(r.prestige),
    honor: Math.floor(r.honor),
    castleCount: Number(r.castleCount),
  }));
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
  if (p.allianceId) throw new GameError(msg('alliance.alreadyMember'), -99);
  const name = rawName.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new GameError(msg('common.nameLength', { what: msg('alliance.name'), min: NAME_MIN, max: NAME_MAX }), -99);
  }
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) throw new GameError(msg('common.nameInvalid', { what: msg('alliance.name') }), -99);
  assertClean(name);
  const [dupe] = await ctx.tx
    .select({ id: alliances.id })
    .from(alliances)
    .where(sql`lower(${alliances.name}) = lower(${name})`);
  if (dupe) throw new GameError(msg('alliance.nameTaken', { name }), -12, 409);
  const b = await openOwnCity(ctx, playerId, cityId);
  spendResources(b.city, { gold: BALANCE.allianceCreateGold }, msg('common.notEnoughGold'), -99);
  ctx.stat(playerId, cityId, { [statKey(StatGroup.SPENT_OTHER, ResourceKey.GOLD)]: BALANCE.allianceCreateGold });
  await saveCity(ctx, b.city);
  const a = one(
    await ctx.tx
      .insert(alliances)
      .values({ name, founderName: p.name, leaderPlayerId: p.id, maxMembers: BALANCE.allianceMaxMembers, memberCount: 1, createdAt: ctx.now })
      .returning(),
  );
  await joinPlayer(ctx, p, a, AllianceRank.HOST);
  await announce(ctx, a.id, msg('alliance.event.created', { name }));
  return { id: a.id, msg: msg('alliance.event.created', { name }) };
}

/** alliance.setAllInfoForAlliance (Host / Vice Host) */
export async function setInfo(ctx: Ctx, playerId: number, info: { note?: string; intro?: string; motd?: string }) {
  const p = await getPlayer(ctx, playerId);
  const allianceId = requireRank(p, AllianceRank.VICE_HOST);
  const a = await getAlliance(ctx, allianceId, true);
  if (info.note != null) a.note = String(info.note).slice(0, 2000);
  if (info.intro != null) a.intro = String(info.intro).slice(0, 2000);
  if (info.motd != null) a.motd = String(info.motd).slice(0, 500);
  await saveAlliance(ctx, a);
}

/** Delete an empty alliance and everything hanging off it. */
async function disband(ctx: Ctx, allianceId: number) {
  const a = await getAlliance(ctx, allianceId, true);
  await ctx.tx.update(players).set({ allianceId: null, allianceRank: 0 }).where(eq(players.allianceId, allianceId));
  // players who had applied to it no longer have an application (its requests go with the alliance)
  await ctx.tx
    .update(players)
    .set({ misc: sql`${players.misc} - 'allianceApply' - 'allianceApplyAt'` })
    .where(sql`${players.misc}->>'allianceApply' = ${a.name}`);
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
  const { n } = one(await ctx.tx.select({ n: count() }).from(players).where(eq(players.allianceId, allianceId)));
  if (p.allianceRank === AllianceRank.HOST && Number(n) > 1 && !opts.force) {
    throw new GameError(msg('alliance.hostMustTransfer'), -99);
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
  await announce(ctx, allianceId, msg('alliance.event.left', { name: p.name }), { noSender: true });
}

// ---------------------------------------------------------------------------------------------
// Invitations & applications
// ---------------------------------------------------------------------------------------------

/** alliance.addUsertoAlliance: invite (Presbyter or above). */
export async function invite(ctx: Ctx, playerId: number, userName: string) {
  const p = await getPlayer(ctx, playerId);
  const allianceId = requireRank(p, AllianceRank.PRESIDENT);
  const target = await findPlayerByName(ctx, userName);
  if (!target) throw new GameError(msg('common.playerNamedNotFound', { name: userName }), -41, 404);
  if (target.allianceId) throw new GameError(msg('alliance.playerInOtherAlliance', { name: userName }), -99);
  await ctx.tx
    .insert(allianceRequests)
    .values({ allianceId, playerId: target.id, kind: AllianceRequestKind.INVITE, invitedByName: p.name, createdAt: ctx.now })
    .onConflictDoNothing();
  const a = await getAlliance(ctx, allianceId);
  ctx.push(target.id, PushCmd.SYSTEM_INFO_MESSAGE, {
    alliance: false,
    tV: false,
    noSenderSystemInfo: false,
    msg: msg('alliance.invited', { name: a.name }),
  });
  ctx.push(target.id, PushCmd.ALLIANCE_INVITE, { allianceName: a.name, invitePerson: p.name });
}

/** alliance.canceladdUsertoAlliance */
export async function cancelInvite(ctx: Ctx, playerId: number, userName: string) {
  const p = await getPlayer(ctx, playerId);
  const allianceId = requireRank(p, AllianceRank.PRESIDENT);
  const target = await findPlayerByName(ctx, userName);
  if (!target) throw new GameError(msg('common.playerNamedNotFound', { name: userName }), -41, 404);
  await ctx.tx
    .delete(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, allianceId), eq(allianceRequests.playerId, target.id), eq(allianceRequests.kind, AllianceRequestKind.INVITE)));
}

/** alliance.addUsertoAllianceList: invitations my alliance sent. */
export async function sentInvites(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId);
  const allianceId = requireMember(p);
  const rows = await ctx.tx
    .select({
      userName: players.name,
      prestige: players.prestige,
      rank: players.prestigeRank,
      invitePerson: allianceRequests.invitedByName,
      inviteTime: allianceRequests.createdAt,
    })
    .from(allianceRequests)
    .innerJoin(players, eq(players.id, allianceRequests.playerId))
    .where(and(eq(allianceRequests.allianceId, allianceId), eq(allianceRequests.kind, AllianceRequestKind.INVITE)));
  return rows.map((r) => ({ ...r, prestige: Math.floor(r.prestige) }));
}

/** alliance.leaderWantUserInAllianceList: invitations I received. */
export async function myInvites(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx
    .select({
      allianceName: alliances.name,
      prestige: alliances.prestige,
      rank: alliances.prestigeRank,
      memberCount: alliances.memberCount,
      invitePerson: allianceRequests.invitedByName,
    })
    .from(allianceRequests)
    .innerJoin(alliances, eq(alliances.id, allianceRequests.allianceId))
    .where(and(eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, AllianceRequestKind.INVITE)));
  return rows.map((r) => ({ ...r, prestige: Math.floor(r.prestige) }));
}

/** alliance.agreeComeinAllianceByUser: accept an invitation (needs an Embassy). */
export async function acceptInvite(ctx: Ctx, playerId: number, allianceName: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (p.allianceId) throw new GameError(msg('alliance.alreadyMember'), -99);
  await requireEmbassy(ctx, playerId);
  const a = await allianceByName(ctx, allianceName, true);
  const [inv] = await ctx.tx
    .select()
    .from(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, a.id), eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, AllianceRequestKind.INVITE)));
  if (!inv) throw new GameError(msg('alliance.inviteNotFound'), -99);
  assertRejoinCooldown(p, a.id, ctx.now);
  await joinPlayer(ctx, p, a, AllianceRank.MEMBER);
  await announce(ctx, a.id, msg('alliance.event.joined', { name: p.name }));
}

/** alliance.rejectComeinAlliance */
export async function rejectInvite(ctx: Ctx, playerId: number, allianceName: string) {
  const a = await allianceByName(ctx, allianceName);
  await ctx.tx
    .delete(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, a.id), eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, AllianceRequestKind.INVITE)));
}

async function requireEmbassy(ctx: Ctx, playerId: number) {
  const list = await citiesOf(ctx, playerId);
  if (!list.some((c) => buildingLevel(c.buildings, BuildingType.EMBASSY) >= 1))
    throw new GameError(msg('alliance.buildingRequired', { building: ref.building(BuildingType.EMBASSY) }), -99);
}

/** alliance.userWantInAlliance: apply (one application at a time). */
export async function apply(ctx: Ctx, playerId: number, allianceName: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (p.allianceId) throw new GameError(msg('alliance.alreadyMember'), -99);
  await requireEmbassy(ctx, playerId);
  const a = await allianceByName(ctx, allianceName);
  assertRejoinCooldown(p, a.id, ctx.now);
  await ctx.tx.delete(allianceRequests).where(and(eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, AllianceRequestKind.APPLY)));
  await ctx.tx.insert(allianceRequests).values({ allianceId: a.id, playerId, kind: AllianceRequestKind.APPLY, createdAt: ctx.now });
  p.misc = { ...p.misc, allianceApply: a.name, allianceApplyAt: ctx.now };
  await savePlayer(ctx, p);
  await announce(ctx, a.id, msg('alliance.event.applied', { name: p.name }));
}

/** alliance.cancelUserWantInAlliance */
export async function cancelApplication(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (!p.misc.allianceApply) throw new GameError(msg('alliance.notApplied'), -99);
  await ctx.tx.delete(allianceRequests).where(and(eq(allianceRequests.playerId, playerId), eq(allianceRequests.kind, AllianceRequestKind.APPLY)));
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
  const allianceId = requireRank(p, AllianceRank.PRESIDENT);
  const rows = await ctx.tx
    .select({
      userName: players.name,
      prestige: players.prestige,
      rank: players.prestigeRank,
      inviteTime: allianceRequests.createdAt,
      castleCount: sql<number>`(select count(*) from cities c where c.player_id = "players"."id")`,
    })
    .from(allianceRequests)
    .innerJoin(players, eq(players.id, allianceRequests.playerId))
    .where(and(eq(allianceRequests.allianceId, allianceId), eq(allianceRequests.kind, AllianceRequestKind.APPLY)));
  return rows.map((r) => ({ ...r, prestige: Math.floor(r.prestige), castleCount: Number(r.castleCount) }));
}

/** alliance.agreeComeinAllianceByLeader */
export async function acceptApplication(ctx: Ctx, playerId: number, userName: string) {
  const officer = await getPlayer(ctx, playerId);
  const allianceId = requireRank(officer, AllianceRank.PRESIDENT);
  const target0 = await findPlayerByName(ctx, userName);
  if (!target0) throw new GameError(msg('common.playerNamedNotFound', { name: userName }), -41, 404);
  const target = await getPlayer(ctx, target0.id, { lock: true });
  if (target.allianceId) throw new GameError(msg('alliance.playerInOtherAlliance', { name: userName }), -99);
  const [req] = await ctx.tx
    .select()
    .from(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, allianceId), eq(allianceRequests.playerId, target.id), eq(allianceRequests.kind, AllianceRequestKind.APPLY)));
  if (!req) throw new GameError(msg('alliance.applicationNotFound'), -99);
  const a = await getAlliance(ctx, allianceId, true);
  await joinPlayer(ctx, target, a, AllianceRank.MEMBER);
  await announce(ctx, a.id, msg('alliance.event.joined', { name: target.name }));
}

/** alliance.cancelagreeComeinAlliance: decline an application. */
export async function declineApplication(ctx: Ctx, playerId: number, userName: string) {
  const officer = await getPlayer(ctx, playerId);
  const allianceId = requireRank(officer, AllianceRank.PRESIDENT);
  const target = await findPlayerByName(ctx, userName);
  if (!target) throw new GameError(msg('common.playerNamedNotFound', { name: userName }), -41, 404);
  await ctx.tx
    .delete(allianceRequests)
    .where(and(eq(allianceRequests.allianceId, allianceId), eq(allianceRequests.playerId, target.id), eq(allianceRequests.kind, AllianceRequestKind.APPLY)));
  // only this alliance's application: the player may have applied elsewhere since
  const a = await getAlliance(ctx, allianceId);
  if (target.misc.allianceApply !== a.name) return;
  target.misc = { ...target.misc, allianceApply: undefined, allianceApplyAt: undefined };
  await ctx.tx.update(players).set({ misc: target.misc }).where(eq(players.id, target.id));
}

// ---------------------------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------------------------

/** alliance.setPowerForUserByAlliance: actor must outrank both the old and the new rank. */
export async function setRank(ctx: Ctx, playerId: number, userName: string, rank: number) {
  if (![5, 6, 7, 8].includes(rank)) throw new GameError(msg('alliance.invalidRank'), -99);
  const me = await getPlayer(ctx, playerId);
  const allianceId = requireMember(me);
  const t0 = await findPlayerByName(ctx, userName);
  if (!t0 || t0.allianceId !== me.allianceId) throw new GameError(msg('alliance.memberNotFound'), -99);
  if (t0.id === me.id) throw new GameError(msg('alliance.ownRank'), -99);
  const target = await getPlayer(ctx, t0.id, { lock: true });
  if (me.allianceRank >= target.allianceRank || me.allianceRank >= rank) throw new GameError(msg('alliance.rankTooLow'), -42);
  const limit = RANK_LIMITS[rank];
  if (limit) {
    const { n } = one(
      await ctx.tx
        .select({ n: count() })
        .from(players)
        .where(and(eq(players.allianceId, allianceId), eq(players.allianceRank, rank))),
    );
    if (Number(n) >= limit) throw new GameError(msg('alliance.rankLimit', { count: limit, rank: ref.rank(rank) }), -99);
  }
  const code = rank < target.allianceRank ? 'alliance.event.promoted' : 'alliance.event.demoted';
  target.allianceRank = rank;
  await savePlayer(ctx, target);
  await pushPlayerInfo(ctx, target);
  await announce(ctx, allianceId, msg(code, { actor: me.name, name: target.name, rank: ref.rank(rank) }));
}

/** alliance.resetTopPowerForAlliance: Host hands over to a Vice Host. */
export async function transferHost(ctx: Ctx, playerId: number, userName: string) {
  const me = await getPlayer(ctx, playerId, { lock: true });
  const allianceId = requireMember(me);
  if (me.allianceRank !== AllianceRank.HOST) throw new GameError(msg('alliance.rankTooLow'), -42);
  const t0 = await findPlayerByName(ctx, userName);
  if (!t0 || t0.allianceId !== me.allianceId) throw new GameError(msg('common.playerNamedNotFound', { name: userName }), -41);
  const target = await getPlayer(ctx, t0.id, { lock: true });
  if (target.allianceRank !== AllianceRank.VICE_HOST) {
    throw new GameError(msg('alliance.hostToViceHostOnly'), -88);
  }
  const a = await getAlliance(ctx, allianceId, true);
  target.allianceRank = AllianceRank.HOST;
  me.allianceRank = AllianceRank.VICE_HOST;
  a.leaderPlayerId = target.id;
  await savePlayer(ctx, target);
  await savePlayer(ctx, me);
  await saveAlliance(ctx, a);
  await pushPlayerInfo(ctx, target);
  await pushPlayerInfo(ctx, me);
  await announce(ctx, a.id, msg('alliance.event.newHost', { name: target.name }));
}

/** alliance.kickOutMemberfromAlliance */
export async function kick(ctx: Ctx, playerId: number, userName: string) {
  const me = await getPlayer(ctx, playerId);
  requireMember(me);
  const t0 = await findPlayerByName(ctx, userName);
  if (!t0 || t0.allianceId !== me.allianceId) throw new GameError(msg('alliance.memberNotFound'), -99);
  if (t0.id === me.id) throw new GameError(msg('alliance.kickSelf'), -99);
  if (me.allianceRank >= t0.allianceRank) throw new GameError(msg('alliance.kickHigherRank'), -99);
  const target = await getPlayer(ctx, t0.id, { lock: true });
  const allianceId = target.allianceId;
  if (allianceId == null) throw new GameError(msg('alliance.memberNotFound'), -99);
  target.allianceId = null;
  target.allianceRank = 0;
  target.misc = { ...target.misc, lastAllianceLeftAt: ctx.now, lastAllianceLeftId: allianceId };
  await savePlayer(ctx, target);
  await pushPlayerInfo(ctx, target);
  await announce(ctx, allianceId, msg('alliance.event.removed', { name: target.name, actor: me.name }));
}

/** alliance.messagesForAllianceMember: mail every member (Officer or above). */
export async function massMail(ctx: Ctx, playerId: number, title: string, content: string) {
  const me = await getPlayer(ctx, playerId);
  const allianceId = requireRank(me, AllianceRank.OFFICER);
  for (const id of await memberIds(ctx, allianceId)) {
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
  // ally, neutral or enemy: the three relations a player sets
  const relationMsg = RELATION_MSGS[type];
  if (!relationMsg) throw new GameError(msg('alliance.invalidRelation'), -99);
  const me = await getPlayer(ctx, playerId);
  const allianceId = requireRank(me, AllianceRank.VICE_HOST);
  const mine = await getAlliance(ctx, allianceId, true);
  const target = await allianceByName(ctx, targetName, true);
  if (target.id === mine.id) throw new GameError(msg('alliance.invalidTarget'), -99);
  const [cur] = await ctx.tx
    .select()
    .from(allianceRelations)
    .where(and(eq(allianceRelations.allianceId, mine.id), eq(allianceRelations.targetAllianceId, target.id)));
  if (cur?.relation === type) throw new GameError(msg('alliance.alreadyRelation', { relation: relationMsg }), -99);
  const upsert = async (from: number, to: number, relation: number) =>
    ctx.tx
      .insert(allianceRelations)
      .values({ allianceId: from, targetAllianceId: to, relation, createdAt: ctx.now })
      .onConflictDoUpdate({ target: [allianceRelations.allianceId, allianceRelations.targetAllianceId], set: { relation, createdAt: ctx.now } });
  if (type === Relation.ENEMY) {
    if (ctx.now < mine.warCooldownUntil) throw new GameError(msg('alliance.warCooldown'), -99);
    const until = ctx.now + scaled(BALANCE.allianceWarCooldownMs);
    await upsert(mine.id, target.id, Relation.ENEMY);
    await upsert(target.id, mine.id, Relation.ENEMY);
    mine.warCooldownUntil = until;
    target.warCooldownUntil = Math.max(target.warCooldownUntil, until);
    await saveAlliance(ctx, mine);
    await saveAlliance(ctx, target);
    ctx.broadcast(PushCmd.SYSTEM_INFO_MESSAGE, {
      alliance: false,
      tV: true,
      noSenderSystemInfo: true,
      msg: msg('alliance.warDeclared', { name: mine.name, target: target.name }),
    });
  } else {
    await upsert(mine.id, target.id, type);
  }
  await announce(ctx, target.id, msg('alliance.event.relationSet', { name: mine.name, relation: relationMsg }));
}

/** alliance.dropAllianceFriendshipRelation */
export async function dropRelation(ctx: Ctx, playerId: number, targetName: string) {
  const me = await getPlayer(ctx, playerId);
  const allianceId = requireRank(me, AllianceRank.VICE_HOST);
  const target = await allianceByName(ctx, targetName);
  await ctx.tx.delete(allianceRelations).where(and(eq(allianceRelations.allianceId, allianceId), eq(allianceRelations.targetAllianceId, target.id)));
}
