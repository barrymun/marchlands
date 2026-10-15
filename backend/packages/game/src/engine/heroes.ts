// Hero helpers shared with other services: pushes, hero slots, the tavern, mayors, gear and
// expiring hero buffs.

import { and, eq } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import { buildingLevel, BuildingType, type GeneratedHero, HeroBuffId, HeroStatus, syncHeroGear } from '@marchlands/core';
import { heroes } from '@marchlands/db';

import { type CityBundle, openOwnCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { heroBean } from '#/dto.ts';
import { pushResources } from '#/helpers.ts';
import { gearOfHero, getHero, type HeroRow, saveCity, saveHero } from '#/repo.ts';

export const pushHero = (ctx: Ctx, playerId: number, h: HeroRow, updateType: 0 | 1 | 2) =>
  ctx.push(playerId, PushCmd.HERO_UPDATE, { castleId: h.cityId, hero: heroBean(h), updateType });

/** Hired heroes (incl. captives held) a city has room for: Feasting Hall level. */
export const heroSlots = (b: CityBundle) => buildingLevel(b.city.buildings, BuildingType.FEASTING_HALL);

export function heroValues(g: GeneratedHero) {
  return {
    name: g.name,
    logoUrl: g.logoUrl,
    level: g.level,
    experience: g.experience,
    upgradeExp: g.upgradeExp,
    loyalty: g.loyalty,
    basePower: g.basePower,
    baseManagement: g.baseManagement,
    baseStratagem: g.baseStratagem,
    power: g.power,
    management: g.management,
    stratagem: g.stratagem,
    remainPoint: g.remainPoint,
  };
}

export async function clearTavern(ctx: Ctx, cityId: number) {
  await ctx.tx.delete(heroes).where(and(eq(heroes.cityId, cityId), eq(heroes.inTavern, true)));
}

/**
 * A mayor's politics drives the city's production, so before changing a mayor's stats the city is
 * settled at the old rate (openOwnCity), and afterwards the new rates are pushed and saved.
 */
export async function openMayorCity(ctx: Ctx, h: HeroRow) {
  if (h.status !== HeroStatus.MAYOR || h.playerId == null) return null;
  return openOwnCity(ctx, h.playerId, h.cityId);
}
export async function closeMayorCity(ctx: Ctx, b: CityBundle | null, h: HeroRow) {
  if (!b) return;
  b.heroes = b.heroes.map((x) => (x.id === h.id ? h : x));
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/**
 * Re-apply the lord's gear to every hero they own (after Hero Enhancement research or a new star, and at worker
 * start-up, heroGearJob). Mayors' cities are settled at the old rates first, as with any change to a mayor's
 * attributes. Returns how many heroes changed.
 */
export async function resyncHeroGear(ctx: Ctx, playerId: number): Promise<number> {
  const owned = await ctx.tx
    .select()
    .from(heroes)
    .where(and(eq(heroes.playerId, playerId), eq(heroes.inTavern, false)))
    .for('update');
  let changed = 0;
  for (const h of owned) {
    const probe = { ...h };
    if (!syncHeroGear(probe, await gearOfHero(ctx, h))) continue;
    const city = await openMayorCity(ctx, h);
    await saveHero(ctx, h);
    pushHero(ctx, playerId, h, 2);
    await closeMayorCity(ctx, city, h);
    changed++;
  }
  return changed;
}

export async function expireHeroBuff(ctx: Ctx, heroId: number, attr: string) {
  const h = await getHero(ctx, heroId, { lock: true }).catch(() => null);
  if (!h) return;
  const b = h.buffs.find((x) => x.id === attr);
  if (!b || b.endTime > ctx.now) return;
  const city = attr === HeroBuffId.MANAGEMENT ? await openMayorCity(ctx, h) : null;
  h.buffs = h.buffs.filter((x) => x.id !== attr);
  if (attr === HeroBuffId.POWER) h.powerBuffAdded = 0;
  if (attr === HeroBuffId.MANAGEMENT) h.managementBuffAdded = 0;
  if (attr === HeroBuffId.STRATAGEM) h.stratagemBuffAdded = 0;
  await saveHero(ctx, h);
  if (h.playerId) pushHero(ctx, h.playerId, h, 2);
  await closeMayorCity(ctx, city, h);
}
