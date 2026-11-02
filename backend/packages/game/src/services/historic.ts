// (marchlands) A held historic city's daily draft, as its holder chooses (docs/features/historical-cities.md): draft
// from a barbarian city in its area by hand, or let it draft by itself (the default, jobs.ts draftJob).

import { BALANCE, draftedToday, draftsUsed, GameError, inSeatArea, msg, nextAutoDraftAt } from '@marchlands/core';

import { openOwnCity, viewCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { draft, draftable, pickDraftTarget, seatLevelOf } from '#/engine/draft.ts';
import { pushCity } from '#/helpers.ts';
import { getTile, saveCity } from '#/repo.ts';

/**
 * Draft from a city in the seat's area now (a barbarian city or a lower historic city, one it hasn't drafted today), as
 * one of its drafts today: the one given, or without one the one it would pick drafting by itself (pickDraftTarget: the
 * highest level, the strongest when it has a scout).
 */
export async function draftNow(ctx: Ctx, playerId: number, cityId: number, tileId?: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const level = seatLevelOf(b.city);
  if (!level) throw new GameError(msg('city.notHistoric'), -99);
  if (draftsUsed(b.city, ctx.now) >= BALANCE.historic.draftsPerDay)
    throw new GameError(msg('city.noDraftsLeft', { count: BALANCE.historic.draftsPerDay }), -99);
  let scouted = 0;
  if (tileId == null) {
    const target = await pickDraftTarget(ctx, b.city, level);
    if (!target) throw new GameError(msg('city.noDraftTarget'), -99);
    ({ scouted } = target);
    tileId = target.tile.id;
  }
  const tile = await getTile(ctx, tileId, { lock: true });
  if (!draftable(tile, level)) throw new GameError(msg('city.draftNotTarget'), -99);
  if (!inSeatArea(b.city.tileId, level, tile.id)) throw new GameError(msg('city.draftOutOfArea'), -99);
  if (draftedToday(b.city, ctx.now).includes(tile.id)) throw new GameError(msg('city.draftedToday'), -99);
  const troops = await draft(ctx, b.city, tile, { auto: false, scouted });
  if (!troops) throw new GameError(msg('city.nothingToDraft'), -99);
  return { troops };
}

/** Let a seat draft by itself (from the next part of the day), or only when its holder chooses. */
export async function setDraftAuto(ctx: Ctx, playerId: number, cityId: number, auto: boolean) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (!seatLevelOf(b.city)) throw new GameError(msg('city.notHistoric'), -99);
  if (auto && !b.city.draftAuto) b.city.draftNextAt = nextAutoDraftAt(ctx.now);
  b.city.draftAuto = auto;
  await saveCity(ctx, b.city);
  pushCity(ctx, await viewCity(ctx, cityId));
}
