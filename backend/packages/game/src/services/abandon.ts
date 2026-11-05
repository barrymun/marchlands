// (marchlands) Abandoning a city (docs/features/abandoning-a-city.md): a real hour's notice that can be cancelled.

import { BALANCE, GameError, msg } from '@marchlands/core';

import { openOwnCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { abandonRef, keepsRegularCity } from '#/engine/abandon.ts';
import { pushCity } from '#/helpers.ts';
import { saveCity } from '#/repo.ts';

/** Start the hour, after which the city and all the player has in it are gone. Refused unless a regular city would remain. */
export async function abandonCity(ctx: Ctx, playerId: number, cityId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (b.city.abandonAt) throw new GameError(msg('city.abandonAlready'), -99);
  if (!(await keepsRegularCity(ctx, playerId, cityId))) throw new GameError(msg('city.abandonKeepRegular'), -99);
  b.city.abandonAt = ctx.now + BALANCE.abandon.delayMs;
  ctx.schedule({ type: 'city.abandon', dueAt: b.city.abandonAt, playerId, cityId, refKey: abandonRef(cityId), payload: {} });
  await saveCity(ctx, b.city);
  pushCity(ctx, b);
  return { abandonAt: b.city.abandonAt };
}

/** Keep the city after all, at any time before its hour is up. */
export async function cancelAbandon(ctx: Ctx, playerId: number, cityId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (!b.city.abandonAt) throw new GameError(msg('city.abandonNotRunning'), -99);
  b.city.abandonAt = 0;
  ctx.unschedule(abandonRef(cityId));
  await saveCity(ctx, b.city);
  pushCity(ctx, b);
}
