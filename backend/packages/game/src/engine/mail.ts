// Mail counts and system mail, sent by other services.

import { MailType } from '@marchlands/core';
import { and, count, eq } from 'drizzle-orm';
import { mails } from '@marchlands/db';
import { type Ctx } from '#/context.ts';
import { PushCmd } from '@marchlands/contracts';

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
  ctx.push(playerId, PushCmd.NEW_MAIL, await mailCounts(ctx, playerId));
}

/** System mail (or mail on behalf of a lord, e.g. alliance circulars). */
export async function sendSystemMail(ctx: Ctx, toId: number, title: string, content: string, from?: { fromId: number; fromName: string }) {
  await ctx.tx.insert(mails).values({
    playerId: toId,
    type: from ? MailType.INBOX : MailType.SYSTEM,
    otherPlayerId: from?.fromId ?? null,
    otherPlayerName: from?.fromName ?? '', // system mail: no sender (the client says it came from the game)
    title: title.slice(0, 100),
    content: content.slice(0, 5000),
    sentAt: ctx.now,
  });
  await pushMailCounts(ctx, toId);
}
