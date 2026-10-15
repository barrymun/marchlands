// A new lord's first city and beginner protection.

import { BALANCE, BuffId, type BuildingState, BuildingStatus, type Message, msg } from '@marchlands/core';
import { mails } from '@marchlands/db';

import { type Ctx } from '#/context.ts';
import { pushMailCounts } from '#/engine/mail.ts';
import { activeBuff, pushPlayerInfo } from '#/helpers.ts';
import { type PlayerRow } from '#/repo.ts';

/** Starting city: Town Hall level 1, 100k of every resource (orig createNewPlayer). */
export function initialCity(playerId: number, tileId: number, name: string, now: number) {
  const buildings: BuildingState[] = [{ positionId: -1, typeId: 31, level: 1, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 }];
  const r = BALANCE.startingResources;
  return {
    playerId,
    tileId,
    name,
    gold: r,
    food: r,
    wood: r,
    stone: r,
    iron: r,
    resourcesAt: now,
    population: BALANCE.startPopulation,
    taxRate: BALANCE.startTaxRate,
    buildings,
    misc: { lastTickAt: now },
    createdAt: now,
  };
}

/** Why a player can't be attacked (null: they can). */
export function isProtected(p: PlayerRow, now: number): Message | null {
  if (p.beginner) return msg('player.protected.beginner');
  if (activeBuff(p, BuffId.TRUCE, now)) return msg('player.protected.truce');
  if (activeBuff(p, BuffId.HOLIDAY, now)) return msg('player.protected.holiday');
  return null;
}

/** Beginner protection ends after 7 days or Town Hall level 5 (orig CheckBeginner). */
export async function checkBeginner(ctx: Ctx, p: PlayerRow, townHallLevel?: number) {
  if (!p.beginner) return;
  const expired = ctx.now - p.createdAt > BALANCE.beginnerProtectionMs;
  if (expired || (townHallLevel ?? 0) >= BALANCE.beginnerTownHallLevel) {
    p.beginner = false;
    if (p.status === 3) p.status = 0;
    await ctx.tx.insert(mails).values({
      playerId: p.id,
      type: 2,
      title: '',
      content: '',
      system: { title: msg('player.mail.protectionExpired.title'), content: msg('player.mail.protectionExpired.content') },
      sentAt: ctx.now,
    });
    await pushMailCounts(ctx, p.id);
    await pushPlayerInfo(ctx, p);
  }
}
