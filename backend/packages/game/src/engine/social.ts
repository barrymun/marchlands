// The block list, checked before mail and private chat.

import { and, eq } from 'drizzle-orm';
import { playerRelations } from '@marchlands/db';
import { type Ctx } from '#/context.ts';

/** friend.isBlockMailPlayer: does `receiver` block `sender`? */
export async function isBlocked(ctx: Ctx, receiverId: number, senderId: number): Promise<boolean> {
  const [row] = await ctx.tx
    .select({ k: playerRelations.kind })
    .from(playerRelations)
    .where(and(eq(playerRelations.playerId, receiverId), eq(playerRelations.otherPlayerId, senderId), eq(playerRelations.kind, 'block')));
  return !!row;
}
