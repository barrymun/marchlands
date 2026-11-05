// hero.* — tavern, hiring, mayor, attribute points, levels, loyalty, items.

import { eq } from 'drizzle-orm';

import {
  BALANCE,
  buildingLevel,
  BuildingType,
  experienceItemGain,
  GameError,
  GEAR_STATS,
  gearStarCost,
  gearStarLimit,
  type GearStat,
  HERO_ATTRIBUTE_ITEMS,
  HERO_NAME_MAX,
  heroAtMaxLevel,
  heroAttributeBuffEnd,
  heroAwardCost,
  heroBuffAmount,
  heroBuffBase,
  heroBuffDesc,
  HeroBuffId,
  heroItemGoldPrice,
  heroPointCap,
  HeroStatus,
  isGearPiece,
  itemGoldPrice,
  ItemId,
  levelUpAll,
  lordGear,
  loyaltyAfterMedal,
  msg,
  ref,
  tavernRefreshCost,
  TechType,
  TimedEventType,
} from '@marchlands/core';
import { heroes } from '@marchlands/db';

import { type CityBundle, openOwnCity, viewCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { heroBean } from '#/dto.ts';
import { closeMayorCity, fillTavern, heroSlots, hireOffer, openMayorCity, pushHero, rerollTavern, resyncHeroGear } from '#/engine/heroes.ts';
import { addItem, assertClean, cleanName, consumeItem, itemCount, pushResources, spendGold, spendResources } from '#/helpers.ts';
import { getHero, getPlayer, heroesOfCity, type HeroRow, saveCity, saveHero, savePlayer } from '#/repo.ts';

async function own(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  return b;
}

/** Heroes living in a city. */
export async function listHeroes(ctx: Ctx, playerId: number, cityId: number) {
  const b = await own(ctx, playerId, cityId);
  return { heroes: b.heroes.map(heroBean), slots: heroSlots(b) };
}

/**
 * Put the city's heroes in the lord's order: `heroIds` first, in that order; heroes left out keep their
 * place after them (e.g. one hired while the list was being dragged).
 */
export async function reorderHeroes(ctx: Ctx, playerId: number, cityId: number, heroIds: number[]) {
  await own(ctx, playerId, cityId);
  const list = await heroesOfCity(ctx, cityId, { lock: true });
  const byId = new Map(list.map((h) => [h.id, h]));
  const first = [...new Set(heroIds)].flatMap((id) => byId.get(id) ?? []);
  const order = [...first, ...list.filter((h) => !first.includes(h))];
  for (const [i, h] of order.entries()) {
    if (h.sortOrder !== i + 1)
      await ctx.tx
        .update(heroes)
        .set({ sortOrder: i + 1 })
        .where(eq(heroes.id, h.id));
  }
  return listHeroes(ctx, playerId, cityId);
}

/** hero.getHerosListFromTavern */
export async function tavern(ctx: Ctx, playerId: number, cityId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (buildingLevel(b.city.buildings, BuildingType.INN) < 1) throw new GameError(msg('hero.needInn', { building: ref.building(BuildingType.INN) }), -1);
  const offers = await fillTavern(ctx, b, false);
  return tavernBean(b, offers);
}

function tavernBean(b: CityBundle, offers: HeroRow[]) {
  return {
    posCount: heroSlots(b) - b.heroes.length,
    heros: offers.map(heroBean),
    refreshCost: tavernRefreshCost(buildingLevel(b.city.buildings, BuildingType.INN)),
  };
}

/**
 * hero.refreshHerosListFromTavern: new offers. The original only accepted a Hero Hunting item;
 * (marchlands) the lord pays gold instead (BALANCE.tavernRefreshGoldPerInnLevel x Inn level).
 */
export async function refreshTavern(ctx: Ctx, playerId: number, cityId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const inn = buildingLevel(b.city.buildings, BuildingType.INN);
  if (inn < 1) throw new GameError(msg('hero.needInn', { building: ref.building(BuildingType.INN) }), -99);
  const offers = await rerollTavern(ctx, b);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  return tavernBean(b, offers);
}

/** hero.hireHero (by offer id rather than the original's name matching). */
export async function hire(ctx: Ctx, playerId: number, cityId: number, heroId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (heroSlots(b) <= b.heroes.length) throw new GameError(msg('hero.noVacancy', { building: ref.building(BuildingType.FEASTING_HALL) }), -99);
  const h = await getHero(ctx, heroId, { lock: true });
  if (!h.inTavern || h.cityId !== cityId) throw new GameError(msg('common.heroNotFound'), -99, 404);
  await hireOffer(ctx, b, h);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  return heroBean(h);
}

async function ownHero(ctx: Ctx, playerId: number, heroId: number) {
  const h = await getHero(ctx, heroId, { lock: true });
  if (h.playerId !== playerId || h.inTavern) throw new GameError(msg('common.heroNotFound'), -99, 404);
  return h;
}

/** hero.fireHero */
export async function fire(ctx: Ctx, playerId: number, heroId: number) {
  const pre = await ownHero(ctx, playerId, heroId);
  const b = await openOwnCity(ctx, playerId, pre.cityId);
  const h = await getHero(ctx, heroId, { lock: true });
  if (h.status !== HeroStatus.IDLE) throw new GameError(msg('hero.notIdle'), -80);
  if (h.locked) throw new GameError(msg('hero.locked', { name: h.name }), -80);
  await ctx.tx.delete(heroes).where(eq(heroes.id, heroId));
  b.heroes = b.heroes.filter((x) => x.id !== heroId);
  pushHero(ctx, playerId, h, 1);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** Lock or unlock a hero: a locked hero cannot be dismissed. */
export async function setHeroLocked(ctx: Ctx, playerId: number, heroId: number, locked: boolean) {
  const h = await ownHero(ctx, playerId, heroId);
  h.locked = locked;
  await saveHero(ctx, h);
  pushHero(ctx, playerId, h, 2);
  return heroBean(h);
}

/** hero.promoteToChief: appoint the city's mayor (castellan). */
export async function appointMayor(ctx: Ctx, playerId: number, heroId: number) {
  const pre = await ownHero(ctx, playerId, heroId);
  const b = await openOwnCity(ctx, playerId, pre.cityId);
  const h = b.heroes.find((x) => x.id === heroId);
  if (!h) throw new GameError(msg('common.heroNotFound'), -99, 404);
  if (h.status !== HeroStatus.IDLE && h.status !== HeroStatus.MAYOR) throw new GameError(msg('hero.notIdle'), -80);
  for (const other of b.heroes) {
    if (other.status === HeroStatus.MAYOR && other.id !== heroId) {
      other.status = HeroStatus.IDLE;
      await saveHero(ctx, other);
      pushHero(ctx, playerId, other, 2);
    }
  }
  h.status = HeroStatus.MAYOR;
  await saveHero(ctx, h);
  pushHero(ctx, playerId, h, 2);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** hero.dischargeChief */
export async function dischargeMayor(ctx: Ctx, playerId: number, cityId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const m = b.heroes.find((x) => x.status === HeroStatus.MAYOR);
  if (!m) throw new GameError(msg('hero.noMayor'), -99);
  m.status = HeroStatus.IDLE;
  await saveHero(ctx, m);
  pushHero(ctx, playerId, m, 2);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** hero.resetPoint: consumes Holy Water, or buys one with the hero's city gold (the original never charged for it). */
export async function resetPoints(ctx: Ctx, playerId: number, heroId: number) {
  const h = await ownHero(ctx, playerId, heroId);
  if (h.status !== HeroStatus.IDLE && h.status !== HeroStatus.MAYOR) throw new GameError(msg('hero.notIdle'), -80);
  const p = await getPlayer(ctx, playerId, { lock: true });
  let city = await openMayorCity(ctx, h);
  if (itemCount(p, ItemId.HOLY_WATER) > 0) addItem(ctx, p, ItemId.HOLY_WATER, -1);
  else {
    city ??= await openOwnCity(ctx, playerId, h.cityId);
    spendGold(city.city, itemGoldPrice(ItemId.HOLY_WATER) ?? 0);
    ctx.stat(playerId, city.city.id, { 'spent.items.gold': itemGoldPrice(ItemId.HOLY_WATER) ?? 0, 'items.used.hero.reset.1': 1 });
  }
  Object.assign(h, { power: h.basePower, management: h.baseManagement, stratagem: h.baseStratagem, remainPoint: h.level });
  await saveHero(ctx, h);
  await savePlayer(ctx, p);
  pushHero(ctx, playerId, h, 2);
  await closeMayorCity(ctx, city, h);
  return heroBean(h);
}

/** hero.addPoint: new absolute totals, never lower than current. */
export async function assignPoints(ctx: Ctx, playerId: number, heroId: number, v: { power: number; management: number; stratagem: number }) {
  const h = await ownHero(ctx, playerId, heroId);
  const cap = heroPointCap(h);
  const ints = [v.power, v.management, v.stratagem].every((n) => Number.isInteger(n));
  if (!ints || v.power + v.management + v.stratagem > cap || v.power < h.power || v.management < h.management || v.stratagem < h.stratagem) {
    throw new GameError(msg('hero.invalidPoints'), -99);
  }
  const city = await openMayorCity(ctx, h);
  Object.assign(h, { power: v.power, management: v.management, stratagem: v.stratagem, remainPoint: cap - (v.power + v.management + v.stratagem) });
  await saveHero(ctx, h);
  pushHero(ctx, playerId, h, 2);
  await closeMayorCity(ctx, city, h);
  return heroBean(h);
}

/** hero.levelUp; (marchlands) takes every level the experience pays for in one go, up to BALANCE.heroMaxLevel. */
export async function levelUp(ctx: Ctx, playerId: number, heroId: number) {
  const h = await ownHero(ctx, playerId, heroId);
  if (heroAtMaxLevel(h)) throw new GameError(msg('hero.maxLevel', { level: BALANCE.heroMaxLevel }), -99);
  // a higher level can unlock more gear (gear tier), which may change a mayor's politics
  const city = await openMayorCity(ctx, h);
  const levels = levelUpAll(h);
  if (levels === 0) throw new GameError(msg('hero.notEnoughExperience'), -99);
  ctx.stat(playerId, h.cityId, { 'levels.hero': levels });
  await saveHero(ctx, h);
  pushHero(ctx, playerId, h, 2);
  await closeMayorCity(ctx, city, h);
  return heroBean(h);
}

/** (marchlands) Choose the attribute the lord's gear boosts on this hero; free, any time. */
export async function setHeroGearStat(ctx: Ctx, playerId: number, heroId: number, stat: GearStat) {
  if (!GEAR_STATS.includes(stat)) throw new GameError(msg('hero.invalidAttribute'), -99);
  const h = await ownHero(ctx, playerId, heroId);
  const city = await openMayorCity(ctx, h);
  h.gearStat = stat;
  await saveHero(ctx, h);
  pushHero(ctx, playerId, h, 2);
  await closeMayorCity(ctx, city, h);
  return heroBean(h);
}

/** (marchlands) The lord's gear: Hero Enhancement level and stars per piece. */
export async function gearState(ctx: Ctx, playerId: number) {
  return lordGear(await getPlayer(ctx, playerId));
}

/** (marchlands) Add a star to one gear piece for every hero, paid in medals (gearStarCost). */
export async function buyGearStar(ctx: Ctx, playerId: number, pieceId: string) {
  if (!isGearPiece(pieceId)) throw new GameError(msg('hero.invalidGearPiece'), -99);
  const p = await getPlayer(ctx, playerId, { lock: true });
  const stars = p.misc.gearStars?.[pieceId] ?? 0;
  if (stars >= BALANCE.heroGear.maxStars) throw new GameError(msg('hero.gearMaxStars'), -99);
  const limit = gearStarLimit(lordGear(p));
  if (stars >= limit) throw new GameError(msg('hero.gearStarLimit', { tech: ref.tech(TechType.HERO_ENHANCEMENT), limit, level: stars + 1 }), -99);
  const cost = gearStarCost(stars + 1);
  if (itemCount(p, cost.itemId) < cost.count) throw new GameError(msg('hero.notEnoughMedals', { item: ref.item(cost.itemId), amount: cost.count }), -99);
  addItem(ctx, p, cost.itemId, -cost.count);
  p.misc = { ...p.misc, gearStars: { ...p.misc.gearStars, [pieceId]: stars + 1 } };
  await savePlayer(ctx, p);
  await resyncHeroGear(ctx, playerId);
  return lordGear(p);
}

/** hero.awardGold: +5 loyalty for level x 100 gold. */
export async function reward(ctx: Ctx, playerId: number, heroId: number) {
  const pre = await ownHero(ctx, playerId, heroId);
  if (pre.loyalty >= BALANCE.heroMaxLoyalty) throw new GameError(msg('hero.fullyLoyal'), -99);
  const b = await openOwnCity(ctx, playerId, pre.cityId);
  const h = b.heroes.find((x) => x.id === heroId);
  if (!h) throw new GameError(msg('common.heroNotFound'), -99, 404);
  spendResources(b.city, { gold: heroAwardCost(h.level) }, msg('common.notEnoughGold'), -99);
  ctx.stat(playerId, b.city.id, { 'spent.heroes.gold': heroAwardCost(h.level) });
  h.loyalty = Math.min(BALANCE.heroMaxLoyalty, h.loyalty + 5);
  await saveHero(ctx, h);
  pushHero(ctx, playerId, h, 2);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  return heroBean(h);
}

/** hero.useItem: experience books, loyalty medals, attribute items. */
export async function useHeroItem(ctx: Ctx, playerId: number, heroId: number, itemId: string, payWith?: 'gold') {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const h = await ownHero(ctx, playerId, heroId);
  let city = HERO_ATTRIBUTE_ITEMS[itemId] === 'management' ? await openMayorCity(ctx, h) : null;
  // buying with gold (asked for, or the item is not owned): the hero's city pays (BALANCE.heroItemGold)
  let paidInGold = false;
  const price = heroItemGoldPrice(itemId, h.upgradeExp);
  if (payWith === 'gold' && price == null) throw new GameError(msg('hero.itemNotForGold'), -99);
  if (price != null && (payWith === 'gold' || itemCount(p, itemId) <= 0)) {
    city ??= await openOwnCity(ctx, playerId, h.cityId);
    if (city.city.gold < price) throw new GameError(msg('common.notEnoughGoldFor', { amount: price }), -99);
    city.city.gold -= price;
    ctx.stat(playerId, city.city.id, { 'spent.items.gold': price, [`items.used.${itemId}`]: 1 });
    paidInGold = true;
  }
  if (BALANCE.items.experienceBooks[itemId]) {
    if (heroAtMaxLevel(h)) throw new GameError(msg('hero.maxLevelNoExperience', { level: BALANCE.heroMaxLevel }), -99);
    const gain = experienceItemGain(itemId, h.upgradeExp);
    if (!gain) throw new GameError(msg('hero.invalidItem'), -99);
    if (!paidInGold) consumeItem(ctx, p, itemId);
    h.experience += gain;
  } else if (BALANCE.items.medalLoyalty[itemId]) {
    if (itemCount(p, itemId) <= 0) throw new GameError(msg('common.insufficientItems'), -99);
    addItem(ctx, p, itemId, -1);
    h.loyalty = loyaltyAfterMedal(h.loyalty, itemId);
  } else if (HERO_ATTRIBUTE_ITEMS[itemId]) {
    const attr = HERO_ATTRIBUTE_ITEMS[itemId];
    if (!paidInGold) consumeItem(ctx, p, itemId);
    const amount = heroBuffAmount(heroBuffBase(h, attr));
    // (marchlands) stacks like the lord's item boosts: another use adds its time to what is left (orig: restarted it)
    const running = h.buffs.find((x) => x.id === attr && x.endTime > ctx.now);
    const endTime = heroAttributeBuffEnd(ctx.now, running?.endTime);
    h.buffs = [...h.buffs.filter((x) => x.id !== attr), { id: attr, desc: heroBuffDesc(attr), endTime, param: amount }];
    if (attr === HeroBuffId.POWER) h.powerBuffAdded = amount;
    if (attr === HeroBuffId.MANAGEMENT) h.managementBuffAdded = amount;
    if (attr === HeroBuffId.STRATAGEM) h.stratagemBuffAdded = amount;
    ctx.schedule({ type: TimedEventType.HERO_BUFF, dueAt: endTime, playerId, refKey: `herobuff:${h.id}:${attr}`, payload: { heroId: h.id, attr } });
  } else throw new GameError(msg('hero.invalidItem'), -99);
  await saveHero(ctx, h);
  await savePlayer(ctx, p);
  pushHero(ctx, playerId, h, 2);
  await closeMayorCity(ctx, city, h);
  return heroBean(h);
}

/** hero.changeName */
export async function renameHero(ctx: Ctx, playerId: number, heroId: number, name: string) {
  const h = await ownHero(ctx, playerId, heroId);
  const n = cleanName(name, 1, HERO_NAME_MAX, msg('common.heroName'));
  assertClean(n);
  h.name = n;
  await saveHero(ctx, h);
  pushHero(ctx, playerId, h, 2);
  return heroBean(h);
}
