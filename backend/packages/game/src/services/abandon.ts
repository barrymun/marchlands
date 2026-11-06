// (marchlands) Abandoning a city (docs/features/abandoning-a-city.md): a real hour's notice that can be cancelled.

import { and, eq, ne } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  addTroops,
  ArmyDirection,
  BALANCE,
  BuildingType,
  dur,
  GameError,
  HeroStatus,
  type Message,
  Mission,
  msg,
  ref,
  ReportBodyKind,
  splitCounts,
  TimedEventType,
  totalTroops,
} from '@marchlands/core';
import { armies } from '@marchlands/db';

import { openOwnCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { troopBean } from '#/dto.ts';
import { abandonRef, keepsRegularCity } from '#/engine/abandon.ts';
import { cityPosition, isWaiting } from '#/engine/armies.ts';
import { heroSlots, pushHero } from '#/engine/heroes.ts';
import { createReport } from '#/engine/reports.ts';
import { gainResources, pushCity, pushPlayerInfo, pushResources } from '#/helpers.ts';
import { saveCity, saveHero, savePlayer } from '#/repo.ts';

/** Start the hour, after which the city and all the player has in it are gone. Refused unless a regular city would remain. */
export async function abandonCity(ctx: Ctx, playerId: number, cityId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (b.city.abandonAt) throw new GameError(msg('city.abandonAlready'), -99);
  if (!(await keepsRegularCity(ctx, playerId, cityId))) throw new GameError(msg('city.abandonKeepRegular'), -99);
  b.city.abandonAt = ctx.now + BALANCE.abandon.delayMs;
  ctx.schedule({ type: TimedEventType.CITY_ABANDON, dueAt: b.city.abandonAt, playerId, cityId, refKey: abandonRef(cityId), payload: {} });
  await saveCity(ctx, b.city);
  pushCity(ctx, b);
  return { abandonAt: b.city.abandonAt };
}

/** Keep the city after all, at any time before its hour is up. */
export async function cancelAbandon(ctx: Ctx, playerId: number, cityId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (!b.city.abandonAt) throw new GameError(msg('city.abandonNotRunning'), -99);
  // what moved out stays where it went, so this would be a free teleport without a price (moveOutCity)
  const moved = b.city.misc.movedOutFor === b.city.abandonAt;
  b.city.abandonAt = 0;
  ctx.unschedule(abandonRef(cityId));
  await saveCity(ctx, b.city);
  pushCity(ctx, b);
  if (moved) {
    b.player.misc = { ...b.player.misc, moveOutBlockedUntil: ctx.now + BALANCE.abandon.moveOutCooldownMs };
    await savePlayer(ctx, b.player);
    await pushPlayerInfo(ctx, b.player);
  }
}

/**
 * What can leave a city being abandoned leaves it at once for the player's other cities: its troops at home, injured troops
 * and resources shared evenly between `targetCityIds`, and the heroes chosen, its mayor included, each to its own city with a
 * free Feasting Hall slot. Armies out, queues and fortifications stay, as do heroes out with an army. As often as they like
 * during the hour, but not with an enemy army on its way (or it's a perfect dodge), one still waiting to leave not counting, as
 * the player can't see it. Keeping the city afterwards doesn't bring anything back (cancelAbandon).
 */
export async function moveOutCity(ctx: Ctx, playerId: number, cityId: number, targetCityIds: number[], heroMoves: { heroId: number; cityId: number }[] = []) {
  const from = await openOwnCity(ctx, playerId, cityId);
  const { city } = from;
  if (!city.abandonAt) throw new GameError(msg('city.moveOutNotAbandoning'), -99);
  const blockedUntil = from.player.misc.moveOutBlockedUntil ?? 0;
  if (blockedUntil > ctx.now) throw new GameError(msg('city.moveOutCooldown', { time: dur(blockedUntil - ctx.now) }), -99);
  const places = [...new Set([...targetCityIds, ...heroMoves.map((m) => m.cityId)])];
  if (!places.length || places.includes(cityId) || new Set(targetCityIds).size !== targetCityIds.length) throw new GameError(msg('city.moveOutTarget'), -99);
  const coming = await ctx.tx
    .select()
    .from(armies)
    .where(
      and(eq(armies.targetTileId, city.tileId), eq(armies.direction, ArmyDirection.FORWARD), eq(armies.mission, Mission.ATTACK), ne(armies.playerId, playerId)),
    );
  if (coming.some((a) => !isWaiting(a, ctx.now))) throw new GameError(msg('city.moveOutUnderAttack'), -99);

  // always locked in the one order, whichever way round they were chosen; the first chosen still gets what's left over
  const opened = new Map<number, Awaited<ReturnType<typeof openOwnCity>>>();
  for (const id of [...places].sort((a, b) => a - b)) opened.set(id, await openOwnCity(ctx, playerId, id));
  if ([...opened.values()].some((t) => t.city.abandonAt)) throw new GameError(msg('city.moveOutTarget'), -99);
  const targets = targetCityIds.flatMap((id) => opened.get(id) ?? []);

  // the heroes are checked before anything moves: a mayor may go, an army's hero can't
  const moving = heroMoves.map((move) => {
    const hero = from.heroes.find((h) => h.id === move.heroId);
    const to = opened.get(move.cityId);
    if (!hero || !to) throw new GameError(msg('common.heroNotFound'), -80);
    if (hero.status !== HeroStatus.IDLE && hero.status !== HeroStatus.MAYOR) throw new GameError(msg('hero.notIdle'), -80);
    return { hero, to };
  });
  if (new Set(moving.map((m) => m.hero.id)).size !== moving.length) throw new GameError(msg('common.heroNotFound'), -80);
  for (const to of opened.values()) {
    if (to.heroes.length + moving.filter((m) => m.to === to).length > heroSlots(to))
      throw new GameError(msg('hero.noVacancy', { building: ref.building(BuildingType.FEASTING_HALL) }), -80);
  }

  const resources = { gold: city.gold, food: city.food, wood: city.wood, stone: city.stone, iron: city.iron };
  // a city being abandoned goes on producing, so a fraction of a resource isn't something to move
  const anything = totalTroops(city.troops) + totalTroops(city.injuredTroops) + Object.values(resources).reduce((sum, n) => sum + Math.floor(n), 0) > 0;
  if (targets.length && !anything && !moving.length) throw new GameError(msg('city.moveOutNothing'), -99);
  if (targets.length && anything) {
    const troops = splitCounts(city.troops, targets.length);
    const injured = splitCounts(city.injuredTroops, targets.length);
    const goods = splitCounts(resources, targets.length);
    for (const [i, t] of targets.entries()) {
      t.city.troops = addTroops(t.city.troops, troops[i] ?? {});
      t.city.injuredTroops = addTroops(t.city.injuredTroops, injured[i] ?? {});
      gainResources(t.city, goods[i] ?? {});
    }
    city.troops = {};
    city.injuredTroops = {};
    Object.assign(city, { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 });
  }
  for (const { hero, to } of moving) {
    Object.assign(hero, { cityId: to.city.id, status: HeroStatus.IDLE });
    await saveHero(ctx, hero);
    from.heroes = from.heroes.filter((h) => h.id !== hero.id);
    to.heroes = [...to.heroes, hero];
    pushHero(ctx, playerId, hero, 2);
  }
  city.misc = { ...city.misc, movedOutFor: city.abandonAt };

  for (const b of [from, ...opened.values()]) {
    await saveCity(ctx, b.city);
    pushCity(ctx, b);
    pushResources(ctx, b);
    ctx.push(playerId, PushCmd.TROOP_UPDATE, { castleId: b.city.id, troop: troopBean(b.city.troops) });
    ctx.push(playerId, PushCmd.INJURED_TROOP_UPDATE, { castleId: b.city.id, troop: troopBean(b.city.injuredTroops) });
  }
  const position = cityPosition(city.name, city.tileId);
  const report = (text: Message) =>
    createReport(ctx, {
      playerId,
      title: msg('report.title.cityMovedOut'),
      startPos: position,
      targetPos: position,
      body: { kind: ReportBodyKind.TEXT, text },
    });
  if (targets.length && anything) await report(msg('report.cityMovedOut', { name: city.name, cities: targets.map((t) => t.city.name) }));
  if (moving.length) {
    const heroes = moving.map((m) => msg('report.heroMovedTo', { hero: m.hero.name, city: m.to.city.name }));
    await report(msg('report.heroesMovedOut', { name: city.name, heroes }));
  }
}
