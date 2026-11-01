// (marchlands) A held historic city's daily draft, as its holder chooses (docs/features/historical-cities.md): draft
// from a barbarian city in its area by hand, or let it draft by itself (the default, jobs.ts draftJob).

import { BALANCE, draftsUsed, GameError, inSeatArea, msg, nextAutoDraftAt } from '@marchlands/core';

import { openOwnCity, viewCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { draft, draftable, seatLevelOf } from '#/engine/draft.ts';
import { pushCity } from '#/helpers.ts';
import { getTile, saveCity } from '#/repo.ts';

/** Draft from a barbarian city in the seat's area now, as one of its drafts today. */
export async function draftNow(ctx: Ctx, playerId: number, cityId: number, tileId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const level = seatLevelOf(b.city);
  if (!level) throw new GameError(msg('city.notHistoric'), -99);
  if (draftsUsed(b.city, ctx.now) >= BALANCE.historic.draftsPerDay)
    throw new GameError(msg('city.noDraftsLeft', { count: BALANCE.historic.draftsPerDay }), -99);
  const tile = await getTile(ctx, tileId, { lock: true });
  if (!draftable(tile)) throw new GameError(msg('city.draftNotBarbarian'), -99);
  if (!inSeatArea(b.city.tileId, level, tile.id)) throw new GameError(msg('city.draftOutOfArea'), -99);
  const troops = await draft(ctx, b.city, tile, { auto: false, scouted: 0 });
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
