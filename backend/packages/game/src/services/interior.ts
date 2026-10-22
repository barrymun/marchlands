// interior.* and city.* — tax, work rates, comfort, city settings and teleporting.

import { and, count, eq, inArray, ne } from 'drizzle-orm';

import {
  BALANCE,
  BASIC_RESOURCES,
  BuffId,
  dur,
  GameError,
  itemGoldPrice,
  ItemId,
  msg,
  ref,
  type ResourceSet,
  scaled,
  TileType,
  tileXY,
} from '@marchlands/core';
import { armies, one, tiles } from '@marchlands/db';

import { cityStats, openOwnCity, viewCity, viewOwnCity } from '#/city.ts';
import type { Ctx } from '#/context.ts';
import { cityBean } from '#/dto.ts';
import { activeBuff, assertClean, cleanName, pushCity, pushResources, setBuff, useItemOrGold } from '#/helpers.ts';
import { saveCity, savePlayer } from '#/repo.ts';

export async function getCity(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewOwnCity(ctx, playerId, cityId);
  if (b.city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  return cityBean(b, ctx.now);
}

/** interior.modifyTaxRate */
export async function setTaxRate(ctx: Ctx, playerId: number, cityId: number, rate: number) {
  if (!Number.isInteger(rate) || rate < 0 || rate > 100) throw new GameError(msg('city.taxRateRange'), -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  b.city.taxRate = rate;
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** interior.modifyCommenceRate */
export async function setWorkRates(ctx: Ctx, playerId: number, cityId: number, rates: Partial<ResourceSet>) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const next = { ...b.city.workRates };
  for (const r of BASIC_RESOURCES) {
    const v = rates[r];
    if (v == null) continue;
    if (!Number.isInteger(v) || v < 0 || v > 100) throw new GameError(msg('city.workRateRange'), -99);
    next[r] = v;
  }
  b.city.workRates = next;
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** city.modifyStorePercent: share of each resource kept in the warehouse (protected). */
export async function setStorePercent(ctx: Ctx, playerId: number, cityId: number, pct: Partial<ResourceSet>) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const next = { ...b.city.storePercent };
  for (const r of BASIC_RESOURCES) {
    const v = pct[r];
    if (v == null) continue;
    if (!Number.isInteger(v) || v < 0 || v > 100) throw new GameError(msg('city.invalidStorePercent'), -99);
    next[r] = v;
  }
  if (BASIC_RESOURCES.reduce((s, r) => s + (next[r] ?? 0), 0) > 100) throw new GameError(msg('city.storePercentTotal'), -99);
  b.city.storePercent = next;
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** The comfort cooldown, with the time left (ms) as minutes and seconds. */
function cooldownMessage(left: number) {
  return msg('city.comfortCooldown', { time: dur(left) });
}

/**
 * interior.pacifyPeople: 3 blessing (gold for food), 4 population raising (food for people).
 * (marchlands) 1 relief and 2 praying only raised loyalty, which lords' cities do not have.
 */
export async function comfort(ctx: Ctx, playerId: number, cityId: number, typeId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const last = b.city.misc.lastComfortAt ?? 0;
  const cd = scaled(BALANCE.comfortCooldownMs);
  if (ctx.now - last < cd) throw new GameError(cooldownMessage(last + cd - ctx.now), -34);
  const stats = cityStats(b, ctx.now);
  const maxPop = stats.maxPopulation;
  const c = b.city;
  const before = { gold: c.gold, food: c.food };
  let bonusBlessing = false;
  switch (typeId) {
    case 3: {
      const gold = Math.floor(maxPop / 10);
      if (c.gold < gold) throw new GameError(msg('common.notEnoughGold'), -99);
      c.gold -= gold;
      c.food += maxPop;
      if (Math.floor(ctx.rng.next() * 10) === 1) {
        c.food += maxPop;
        bonusBlessing = true;
      }
      break;
    }
    case 4:
      if (c.food < maxPop * 5) throw new GameError(msg('city.notEnoughFood'), -99);
      c.food -= maxPop * 5;
      c.population = Math.min(maxPop, c.population + Math.floor(maxPop / 20));
      break;
    default:
      throw new GameError(msg('city.invalidComfortType'), -99);
  }
  c.misc = { ...c.misc, lastComfortAt: ctx.now };
  ctx.stat(playerId, cityId, {
    'spent.comfort.gold': Math.max(0, before.gold - c.gold),
    'spent.comfort.food': Math.max(0, before.food - c.food),
    'gained.blessing.food': Math.max(0, c.food - before.food),
  });
  pushResources(ctx, b);
  await saveCity(ctx, c);
  return { freeBlessing: bonusBlessing };
}

/** interior.getResourceProduceData */
export async function productionBreakdown(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  const s = cityStats(b, ctx.now);
  return BASIC_RESOURCES.map((r, i) => ({
    typeid: i + 1,
    resource: r,
    basicOutput: BALANCE.baseProductionPerHour,
    fieldOutput: Math.round(s.fieldProduction[r] * s.efficiency),
    bonus: s.bonus[r],
    armyConsumption: r === 'food' ? Math.round(s.upkeep) : 0,
    totalOutput: Math.round(s.rates[r]),
    commenceRate: b.city.workRates[r] ?? 100,
    maxLabour: s.workers[r],
    storage: s.storage[r],
  }));
}

/** city.modifyCastleName */
export async function renameCity(ctx: Ctx, playerId: number, cityId: number, name?: string, logoUrl?: string) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (name != null) {
    const n = cleanName(name, 1, 20, msg('common.cityName'));
    assertClean(n);
    b.city.name = n;
  }
  if (logoUrl != null) {
    if (!/^images\/icon\/cityLogo\/[\w.-]+$/.test(logoUrl)) throw new GameError(msg('city.invalidLogo'), -99);
    b.city.logoUrl = logoUrl;
  }
  pushCity(ctx, b);
  await saveCity(ctx, b.city);
}

/** army.setArmyGoOut / city settings */
export async function setCityFlags(ctx: Ctx, playerId: number, cityId: number, flags: { goOutForBattle?: boolean; allowAlliance?: boolean }) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (flags.goOutForBattle != null) b.city.goOutForBattle = flags.goOutForBattle;
  if (flags.allowAlliance != null) b.city.allowAlliance = flags.allowAlliance;
  await saveCity(ctx, b.city);
}

const TELEPORTER = ItemId.CITY_TELEPORTER;

/**
 * city.advMoveCastle: the City Teleporter moves the city to a free flat of the lord's choice, then
 * cools down (BALANCE.teleportCooldownMs); one not owned is bought with the city's gold on use.
 * (marchlands) the original's City Teleporter picked a random flat in a state; the Adv City Teleporter,
 * which chose the tile, is removed. All troops must be home.
 */
export async function moveCity(ctx: Ctx, playerId: number, cityId: number, targetTileId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (activeBuff(b.player, BuffId.TELEPORT_COOLDOWN, ctx.now)) throw new GameError(msg('city.teleportCooldown', { item: ref.item(TELEPORTER) }), -90);
  const { n: out } = one(await ctx.tx.select({ n: count() }).from(armies).where(eq(armies.cityId, cityId)));
  if (Number(out) > 0) throw new GameError(msg('city.recallTroopsFirst'), -77);
  const { n: guests } = one(
    await ctx.tx
      .select({ n: count() })
      .from(armies)
      .where(and(eq(armies.targetTileId, b.city.tileId), ne(armies.playerId, playerId))),
  );
  if (Number(guests) > 0) throw new GameError(msg('city.foreignTroops'), -77);

  const target = targetTileId;
  const [t] = await ctx.tx.select().from(tiles).where(eq(tiles.id, target)).for('update');
  if (!t || t.type !== TileType.FLAT || t.cityId != null || t.ownerCityId != null) throw new GameError(msg('city.notFreeFlat'), -25);
  useItemOrGold(ctx, b.player, b.city, TELEPORTER, itemGoldPrice(TELEPORTER) ?? 0);
  await ctx.tx.update(tiles).set({ cityId: null, type: TileType.FLAT, ownerPlayerId: null, updatedAt: ctx.now }).where(eq(tiles.id, b.city.tileId));
  await ctx.tx.update(tiles).set({ cityId, type: TileType.CASTLE, ownerPlayerId: playerId, ownerCityId: null, updatedAt: ctx.now }).where(eq(tiles.id, target));
  // occupied valleys are lost when the city moves away
  const valleyIds = b.valleys.map((v) => v.id);
  if (valleyIds.length) await ctx.tx.update(tiles).set({ ownerCityId: null, ownerPlayerId: null, updatedAt: ctx.now }).where(inArray(tiles.id, valleyIds));
  b.valleys = [];
  b.city.tileId = target;
  setBuff(ctx, b.player, BuffId.TELEPORT_COOLDOWN, msg('buff.teleportCooldown'), ctx.now + BALANCE.teleportCooldownMs);
  pushCity(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
  return { fieldId: target, ...tileXY(target) };
}
