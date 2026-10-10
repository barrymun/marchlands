// friend.* (friends and block list) and chat (world / beginner / alliance / private).

import { and, desc, eq, gt, or, sql } from 'drizzle-orm';
import { GameError } from '@marchlands/core';
import { chatMessages, playerRelations, players } from '@marchlands/db';
import type { Ctx } from '../context.ts';
import { escapeHtml } from '../helpers.ts';
import { findPlayerByName, getPlayer } from '../repo.ts';

// ---------------------------------------------------------------------------------------------
// Friends & blocks
// ---------------------------------------------------------------------------------------------

export async function listRelations(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx
    .select({ id: players.id, name: players.name, kind: playerRelations.kind, prestige: players.prestige, lastSeen: players.lastSeenAt })
    .from(playerRelations)
    .innerJoin(players, eq(players.id, playerRelations.otherPlayerId))
    .where(eq(playerRelations.playerId, playerId));
  const view = (k: string) => rows.filter((r) => r.kind === k).map(({ kind: _k, ...r }) => ({ ...r, prestige: Math.floor(r.prestige) }));
  return { friends: view('friend'), blocked: view('block') };
}

export async function addRelation(ctx: Ctx, playerId: number, name: string, kind: 'friend' | 'block') {
  const other = await findPlayerByName(ctx, name);
  if (!other) throw new GameError(`Player ${name} doesn't exist.`, -41, 404);
  if (other.id === playerId) throw new GameError('Invalid target.', -99);
  await ctx.tx.insert(playerRelations).values({ playerId, otherPlayerId: other.id, kind, createdAt: ctx.now }).onConflictDoNothing();
  return { id: other.id, name: other.name };
}

export async function removeRelation(ctx: Ctx, playerId: number, otherId: number, kind: 'friend' | 'block') {
  await ctx.tx
    .delete(playerRelations)
    .where(and(eq(playerRelations.playerId, playerId), eq(playerRelations.otherPlayerId, otherId), eq(playerRelations.kind, kind)));
}

/** friend.isBlockMailPlayer: does `receiver` block `sender`? */
export async function isBlocked(ctx: Ctx, receiverId: number, senderId: number): Promise<boolean> {
  const [row] = await ctx.tx
    .select({ k: playerRelations.kind })
    .from(playerRelations)
    .where(and(eq(playerRelations.playerId, receiverId), eq(playerRelations.otherPlayerId, senderId), eq(playerRelations.kind, 'block')));
  return !!row;
}

// ---------------------------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------------------------

const MAX_CHAT = 300;

function cleanMessage(raw: unknown): string {
  const msg = String(raw ?? '').trim();
  if (!msg) throw new GameError('Empty message.', -99);
  if (msg.length > MAX_CHAT) throw new GameError('Message too long.', -99);
  return escapeHtml(msg);
}

function assertNotMuted(p: { misc: { denyChatUntil?: number } }, now: number) {
  if ((p.misc.denyChatUntil ?? 0) > now) throw new GameError('You are not allowed to speak right now.', -99);
}

/** Colour the message of the top lord / top alliance (orig). */
async function decorate(ctx: Ctx, p: { prestigeRank: number; allianceId: number | null }, msg: string) {
  if (p.prestigeRank === 1) return `<font color="#FF0000">${msg}</font>`;
  if (p.allianceId) {
    const rows = await ctx.tx.execute<{ r: number }>(sql`select prestige_rank r from alliances where id = ${p.allianceId}`);
    if (Number(rows.rows[0]?.r) === 1) return `<font color="#0066FF">${msg}</font>`;
  }
  return msg;
}

/** common.worldChat / common.channelChat (beginner channel); (marchlands) both are free: there are no Speakers. */
export async function worldChat(ctx: Ctx, playerId: number, rawMsg: string, channel: 'world' | 'beginner' = 'world') {
  const p = await getPlayer(ctx, playerId);
  assertNotMuted(p, ctx.now);
  const msg = cleanMessage(rawMsg);
  await ctx.tx.insert(chatMessages).values({ channel, fromPlayerId: p.id, fromName: p.name, message: msg, sentAt: ctx.now });
  ctx.broadcast('server.ChannelChatMsg', {
    msg: await decorate(ctx, p, msg),
    languageType: 0,
    fromUser: p.name,
    fromId: p.id,
    channel,
    time: ctx.now,
  });
}

/** common.allianceChat */
export async function allianceChat(ctx: Ctx, playerId: number, rawMsg: string) {
  const p = await getPlayer(ctx, playerId);
  assertNotMuted(p, ctx.now);
  if (!p.allianceId) throw new GameError('To send an alliance message, you must be a member of an alliance', -99);
  const msg = cleanMessage(rawMsg);
  await ctx.tx
    .insert(chatMessages)
    .values({ channel: 'alliance', allianceId: p.allianceId, fromPlayerId: p.id, fromName: p.name, message: msg, sentAt: ctx.now });
  const memberRows = await ctx.tx.select({ id: players.id }).from(players).where(eq(players.allianceId, p.allianceId));
  ctx.push(
    memberRows.map((r) => r.id),
    'server.AllianceChatMsg',
    { msg, languageType: 0, fromUser: p.name, fromId: p.id, channel: 'alliance', time: ctx.now },
  );
}

/** common.privateChat */
export async function privateChat(ctx: Ctx, playerId: number, targetName: string, rawMsg: string) {
  const p = await getPlayer(ctx, playerId);
  assertNotMuted(p, ctx.now);
  const target = await findPlayerByName(ctx, targetName);
  if (!target) throw new GameError(`Player ${targetName} doesn't exist.`, -41, 404);
  if (target.id === p.id) throw new GameError('Invalid target.', -99);
  const msg = cleanMessage(rawMsg);
  if (await isBlocked(ctx, target.id, p.id)) return; // silently dropped, as if delivered
  await ctx.tx.insert(chatMessages).values({ channel: 'private', fromPlayerId: p.id, fromName: p.name, toPlayerId: target.id, message: msg, sentAt: ctx.now });
  ctx.push(target.id, 'server.PrivateChatMessage', { msg, chatType: 0, fromUser: p.name, fromId: p.id, time: ctx.now });
}

/** Recent history of a channel (world / beginner / alliance / private). */
export async function chatHistory(ctx: Ctx, playerId: number, channel: string, since = 0) {
  const p = await getPlayer(ctx, playerId);
  let where;
  if (channel === 'alliance') {
    if (!p.allianceId) return [];
    where = and(eq(chatMessages.channel, 'alliance'), eq(chatMessages.allianceId, p.allianceId), gt(chatMessages.sentAt, since));
  } else if (channel === 'private') {
    where = and(
      eq(chatMessages.channel, 'private'),
      or(eq(chatMessages.toPlayerId, playerId), eq(chatMessages.fromPlayerId, playerId)),
      gt(chatMessages.sentAt, since),
    );
  } else where = and(eq(chatMessages.channel, channel), gt(chatMessages.sentAt, since));
  const rows = await ctx.tx.select().from(chatMessages).where(where).orderBy(desc(chatMessages.sentAt)).limit(100);
  return rows
    .reverse()
    .map((r) => ({ id: r.id, channel: r.channel, fromUser: r.fromName, fromId: r.fromPlayerId, toId: r.toPlayerId, msg: r.message, time: r.sentAt }));
}
