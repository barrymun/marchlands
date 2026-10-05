// mail.* — inbox (1), system (2) and sent (3) folders. Each participant owns a copy.

import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { GameError } from '@evony/core';
import { mails } from '@evony/db';
import type { Ctx } from '../context.ts';
import { escapeHtml } from '../helpers.ts';
import { findPlayerByName, getPlayer } from '../repo.ts';
import { isBlocked } from './social.ts';

export const MailFolder = { INBOX: 1, SYSTEM: 2, SENT: 3 } as const;

export async function mailCounts(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx
    .select({ type: mails.type, n: count() })
    .from(mails)
    .where(and(eq(mails.playerId, playerId), eq(mails.readAt, 0)))
    .groupBy(mails.type);
  const n = (t: number) => Number(rows.find((r) => r.type === t)?.n ?? 0);
  return { count: n(1) + n(2), count_inbox: n(1), count_system: n(2) };
}

export async function pushMailCounts(ctx: Ctx, playerId: number) {
  ctx.push(playerId, 'server.NewMail', await mailCounts(ctx, playerId));
}

/** System mail (or mail on behalf of a lord, e.g. alliance circulars). */
export async function sendSystemMail(ctx: Ctx, toId: number, title: string, content: string, from?: { fromId: number; fromName: string }) {
  await ctx.tx.insert(mails).values({
    playerId: toId,
    type: from ? MailFolder.INBOX : MailFolder.SYSTEM,
    otherPlayerId: from?.fromId ?? null,
    otherPlayerName: from?.fromName ?? 'System',
    title: title.slice(0, 100),
    content: content.slice(0, 5000),
    sentAt: ctx.now,
  });
  await pushMailCounts(ctx, toId);
}

/** mail.sendMail */
export async function sendMail(ctx: Ctx, playerId: number, toName: string, rawTitle: string, rawContent: string) {
  const sender = await getPlayer(ctx, playerId);
  const target = await findPlayerByName(ctx, toName);
  if (!target) throw new GameError(`Player ${toName} doesn't exist.`, -41, 404);
  if (target.id === playerId) throw new GameError('invalid mailing operation.', -21);
  const title = escapeHtml(String(rawTitle ?? '').trim()).slice(0, 100);
  const content = escapeHtml(String(rawContent ?? '').trim()).slice(0, 5000);
  if (!title || !content) throw new GameError('Title and content are required.', -99);
  if (!(await isBlocked(ctx, target.id, sender.id))) {
    await ctx.tx.insert(mails).values({ playerId: target.id, type: MailFolder.INBOX, otherPlayerId: sender.id, otherPlayerName: sender.name, title, content, sentAt: ctx.now });
    await pushMailCounts(ctx, target.id);
  }
  await ctx.tx.insert(mails).values({
    playerId,
    type: MailFolder.SENT,
    otherPlayerId: target.id,
    otherPlayerName: target.name,
    title,
    content,
    sentAt: ctx.now,
    readAt: ctx.now,
  });
}

const bean = (m: typeof mails.$inferSelect, me: { id: number; name: string }) => ({
  mailid: m.id,
  type_id: m.type,
  title: m.title,
  sender: m.type === MailFolder.SENT ? me.name : m.otherPlayerName || 'System',
  receiver: m.type === MailFolder.SENT ? m.otherPlayerName : me.name,
  playerId: m.otherPlayerId,
  receiveTime: m.sentAt,
  isRead: m.readAt > 0,
});

/** mail.receiveMailList */
export async function listMail(ctx: Ctx, playerId: number, type: number, pageNo: number, pageSize: number) {
  if (![1, 2, 3].includes(type)) throw new GameError('Invalid data.', -99);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new GameError('Invalid data.', -99);
  const me = await getPlayer(ctx, playerId);
  const page = Math.max(1, pageNo || 1);
  const where = and(eq(mails.playerId, playerId), eq(mails.type, type));
  const [{ n }] = await ctx.tx.select({ n: count() }).from(mails).where(where);
  const rows = await ctx.tx.select().from(mails).where(where).orderBy(desc(mails.sentAt), desc(mails.id)).limit(pageSize).offset((page - 1) * pageSize);
  return { pageNo: page, pageSize, totalPage: Math.ceil(Number(n) / pageSize), mails: rows.map((m) => bean(m, me)) };
}

/** mail.readMail */
export async function readMail(ctx: Ctx, playerId: number, mailId: number) {
  const me = await getPlayer(ctx, playerId);
  const [m] = await ctx.tx.select().from(mails).where(and(eq(mails.id, mailId), eq(mails.playerId, playerId)));
  if (!m) throw new GameError('Mail not found.', -99, 404);
  if (!m.readAt) {
    await ctx.tx.update(mails).set({ readAt: ctx.now }).where(eq(mails.id, mailId));
    await pushMailCounts(ctx, playerId);
  }
  return { ...bean(m, me), content: m.content, isRead: true };
}

/** mail.readOverMailList */
export async function markMailRead(ctx: Ctx, playerId: number, ids: number[]) {
  if (!ids.length) return;
  await ctx.tx.update(mails).set({ readAt: ctx.now }).where(and(eq(mails.playerId, playerId), inArray(mails.id, ids), eq(mails.readAt, 0)));
  await pushMailCounts(ctx, playerId);
}

/** mail.deleteMail */
export async function deleteMail(ctx: Ctx, playerId: number, ids: number[]) {
  if (!ids.length) return;
  await ctx.tx.delete(mails).where(and(eq(mails.playerId, playerId), inArray(mails.id, ids)));
  await pushMailCounts(ctx, playerId);
}
