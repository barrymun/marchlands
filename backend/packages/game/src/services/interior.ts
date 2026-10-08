// interior.* and city.* — tax, work rates, comfort, levy, city settings and teleporting.

import { and, count, eq, inArray, ne } from 'drizzle-orm';
import { BALANCE, BASIC_RESOURCES, GameError, scaled, TileType, tileXY, type ResourceSet } from '@marchlands/core';
import { armies, tiles } from '@marchlands/db';
import { cityStats, openOwnCity, viewCity, viewOwnCity } from '../city.ts';
import type { Ctx } from '../context.ts';
import { cityBean } from '../dto.ts';
import { activeBuff, assertClean, cleanName, consumeItem, itemCount, pushCity, pushResources, setBuff } from '../helpers.ts';
import { saveCity, savePlayer } from '../repo.ts';
import { pickOpenFlat } from './world.ts';

export async function getCity(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewOwnCity(ctx, playerId, cityId);
  if (b.city.playerId !== playerId) throw new GameError('Invalid castle.', -99, 403);
  return cityBean(b, ctx.now);
}

/** interior.modifyTaxRate */
export async function setTaxRate(ctx: Ctx, playerId: number, cityId: number, rate: number) {
  if (!Number.isInteger(rate) || rate < 0 || rate > 100) throw new GameError('Tax rate must be between 0 and 100.', -99);
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
    if (!Number.isInteger(v) || v < 0 || v > 100) throw new GameError('Work rates must be between 0 and 100.', -99);
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
    if (!Number.isInteger(v) || v < 0 || v > 100) throw new GameError('Invalid store percent.', -99);
    next[r] = v;
  }
  if (BASIC_RESOURCES.reduce((s, r) => s + next[r], 0) > 100) throw new GameError('Store percentages may total at most 100.', -99);
  b.city.storePercent = next;
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

function cooldownMessage(left: number, what: string) {
  const min = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return `${min}m ${sec}s interval needed for next ${what}.`;
}

/** interior.pacifyPeople: 1 relief, 2 praying, 3 blessing, 4 population raising. */
export async function comfort(ctx: Ctx, playerId: number, cityId: number, typeId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const last = b.city.misc.lastComfortAt ?? 0;
  const cd = scaled(BALANCE.comfortCooldownMs);
  if (ctx.now - last < cd) throw new GameError(cooldownMessage(last + cd - ctx.now, 'comforting'), -34);
  const stats = cityStats(b, ctx.now);
  const maxPop = stats.maxPopulation;
  const c = b.city;
  let bonusBlessing = false;
  switch (typeId) {
    case 1:
      if (c.food < maxPop) throw new GameError('Not enough food.', -99);
      c.food -= maxPop;
      c.loyalty = Math.min(100, c.loyalty + 5);
      c.grievance = Math.max(0, c.grievance - 15);
      break;
    case 2:
      if (c.food < maxPop) throw new GameError('Not enough food.', -99);
      c.food -= maxPop;
      c.loyalty = Math.min(100, c.loyalty + 25);
      c.grievance = Math.max(0, c.grievance - 5);
      break;
    case 3: {
      const gold = Math.floor(maxPop / 10);
      if (c.gold < gold) throw new GameError('Not enough gold.', -99);
      c.gold -= gold;
      c.food += maxPop;
      if (Math.floor(ctx.rng.next() * 10) === 1) {
        c.food += maxPop;
        bonusBlessing = true;
      }
      break;
    }
    case 4:
      if (c.food < maxPop * 5) throw new GameError('Not enough food.', -99);
      c.food -= maxPop * 5;
      c.population = Math.min(maxPop, c.population + Math.floor(maxPop / 20));
      break;
    default:
      throw new GameError('Invalid comfort type.', -99);
  }
  c.misc = { ...c.misc, lastComfortAt: ctx.now };
  pushResources(ctx, b);
  await saveCity(ctx, c);
  return { freeBlessing: bonusBlessing };
}

/** interior.taxation (levy): 1 gold, 2 food, 3 wood, 4 stone, 5 iron; costs 20 loyalty. */
export async function levy(ctx: Ctx, playerId: number, cityId: number, typeId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const last = b.city.misc.lastLevyAt ?? 0;
  const cd = scaled(BALANCE.levyCooldownMs);
  if (ctx.now - last < cd) throw new GameError(cooldownMessage(last + cd - ctx.now, 'levy'), -34);
  const c = b.city;
  if (c.loyalty <= BALANCE.levyLoyaltyCost) throw new GameError('Loyalty too low. Please comfort first.', -99);
  const pop = Math.floor(c.population);
  switch (typeId) {
    case 1:
      c.gold += Math.floor(pop / 10);
      break;
    case 2:
      c.food += pop;
      break;
    case 3:
      c.wood += pop;
      break;
    case 4:
      c.stone += Math.floor(pop / 2);
      break;
    case 5:
      c.iron += Math.floor(pop * 0.4);
      break;
    default:
      throw new GameError('Invalid levy type.', -99);
  }
  c.loyalty -= BALANCE.levyLoyaltyCost;
  c.misc = { ...c.misc, lastLevyAt: ctx.now };
  pushResources(ctx, b);
  await saveCity(ctx, c);
}

/** interior.getResourceProduceData */
export async function productionBreakdown(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError('Invalid castle.', -99, 403);
  const s = cityStats(b, ctx.now);
  return BASIC_RESOURCES.map((r, i) => ({
    typeid: i + 1,
    resource: r,
    basicOutput: BALANCE.baseProductionPerHour,
    fieldOutput: Math.round(s.fieldProduction[r] * s.efficiency),
    bonusPercent: Math.round(s.bonus[r] * 100),
    armyConsumption: r === 'food' ? Math.round(s.upkeep) : 0,
    totalOutput: Math.round(s.rates[r]),
    commenceRate: b.city.workRates[r],
    maxLabour: s.workers[r],
    storage: s.storage[r],
  }));
}

/** city.modifyCastleName */
export async function renameCity(ctx: Ctx, playerId: number, cityId: number, name?: string, logoUrl?: string) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (name != null) {
    const n = cleanName(name, 1, 20, 'City name');
    assertClean(n);
    b.city.name = n;
  }
  if (logoUrl != null) {
    if (!/^images\/icon\/cityLogo\/[\w.-]+$/.test(logoUrl)) throw new GameError('Invalid city logo.', -99);
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

/**
 * city.moveCastle (City Teleporter, random flat in a state) and city.advMoveCastle
 * (Adv City Teleporter, chosen flat; 12h cooldown). All troops must be home.
 */
export async function moveCity(ctx: Ctx, playerId: number, cityId: number, opts: { zoneId?: number; targetTileId?: number }) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const advanced = opts.targetTileId != null;
  const item = advanced ? 'player.more.castle.1.a' : 'consume.move.1';
  if (itemCount(b.player, item) <= 0) throw new GameError(advanced ? 'No Adv City Teleporter.' : 'No City Teleporter.', -90);
  if (advanced && activeBuff(b.player, 'MoveCastleCoolDownBuff', ctx.now)) throw new GameError('Adv City Teleporter is in cooldown.', -90);
  const [{ n: out }] = await ctx.tx.select({ n: count() }).from(armies).where(eq(armies.cityId, cityId));
  if (Number(out) > 0) throw new GameError('You must recall all of your troops before you teleport your city.', -77);
  const [{ n: guests }] = await ctx.tx
    .select({ n: count() })
    .from(armies)
    .where(and(eq(armies.targetTileId, b.city.tileId), ne(armies.playerId, playerId)));
  if (Number(guests) > 0) throw new GameError('Foreign troops are marching to or stationed in this city.', -77);

  let target: number;
  if (advanced) {
    target = opts.targetTileId!;
    const [t] = await ctx.tx.select().from(tiles).where(eq(tiles.id, target)).for('update');
    if (!t || t.type !== TileType.FLAT || t.cityId != null || t.ownerCityId != null) throw new GameError('No open flats exist.', -25);
  } else {
    if (!Number.isInteger(opts.zoneId) || opts.zoneId! < 0 || opts.zoneId! > 15) throw new GameError('Trying to teleport to an invalid zone.', -90);
    target = await pickOpenFlat(ctx, opts.zoneId!);
  }
  consumeItem(ctx, b.player, item);
  await ctx.tx.update(tiles).set({ cityId: null, type: TileType.FLAT, ownerPlayerId: null, updatedAt: ctx.now }).where(eq(tiles.id, b.city.tileId));
  await ctx.tx.update(tiles).set({ cityId, type: TileType.CASTLE, ownerPlayerId: playerId, ownerCityId: null, updatedAt: ctx.now }).where(eq(tiles.id, target));
  // occupied valleys are lost when the city moves away
  const valleyIds = b.valleys.map((v) => v.id);
  if (valleyIds.length) await ctx.tx.update(tiles).set({ ownerCityId: null, ownerPlayerId: null, updatedAt: ctx.now }).where(inArray(tiles.id, valleyIds));
  b.valleys = [];
  b.city.tileId = target;
  if (advanced) setBuff(ctx, b.player, 'MoveCastleCoolDownBuff', 'Adv City Teleporter in cooldown.', ctx.now + scaled(BALANCE.teleportCooldownMs));
  pushCity(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
  return { fieldId: target, ...tileXY(target) };
}
