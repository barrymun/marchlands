// gamemaster.* — operator tools (the original only had chat cheats gated on the name "Daisy").
// Callers must check the account's is_admin flag.

import { eq } from 'drizzle-orm';
import {
  BuildingStatus,
  buildingMaxLevel,
  createRandomHero,
  GameError,
  itemConfig,
  researchMaxLevel,
  RESOURCE_KEYS,
  type ResourceSet,
  TechType,
} from '@marchlands/core';
import { accounts, heroes } from '@marchlands/db';
import { openOwnCity } from '../city.ts';
import type { Ctx } from '../context.ts';
import { addItem, pushCity, pushPlayerInfo } from '../helpers.ts';
import { findPlayerByName, getPlayer, saveCity, saveHero, savePlayer } from '../repo.ts';
import { heroValues, pushHero, resyncHeroGear } from './heroes.ts';
import { sendSystemMail } from './mail.ts';
import { PushCmd } from '@marchlands/contracts';

async function target(ctx: Ctx, name: string) {
  const p = await findPlayerByName(ctx, name);
  if (!p) throw new GameError(`Player ${name} doesn't exist.`, -41, 404);
  return getPlayer(ctx, p.id, { lock: true });
}

export async function grantItems(ctx: Ctx, playerName: string, items: Record<string, number>) {
  const p = await target(ctx, playerName);
  for (const [id, n] of Object.entries(items)) {
    if (!itemConfig(id)) throw new GameError(`Unknown item ${id}.`, -99);
    if (!Number.isInteger(n) || n === 0) throw new GameError('Invalid amount.', -99);
    addItem(ctx, p, id, n);
  }
  await savePlayer(ctx, p);
}

export async function setResources(ctx: Ctx, cityId: number, playerId: number, res: Partial<ResourceSet>) {
  const b = await openOwnCity(ctx, playerId, cityId);
  for (const k of RESOURCE_KEYS) if (res[k] != null) b.city[k] = Math.max(0, Number(res[k]));
  await saveCity(ctx, b.city);
  pushCity(ctx, b);
}

export async function setBuilding(ctx: Ctx, cityId: number, playerId: number, positionId: number, typeId: number, level: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (level < 0 || level > buildingMaxLevel(typeId)) throw new GameError('Invalid level.', -99);
  const rest = b.city.buildings.filter((x) => x.positionId !== positionId);
  b.city.buildings = level === 0 ? rest : [...rest, { positionId, typeId, level, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 }];
  await saveCity(ctx, b.city);
  pushCity(ctx, b);
}

export async function setTechnology(ctx: Ctx, playerName: string, techId: number, level: number) {
  const p = await target(ctx, playerName);
  if (level < 0 || level > researchMaxLevel(techId)) throw new GameError('Invalid level.', -99);
  p.research = { ...p.research, [techId]: { level } };
  await savePlayer(ctx, p);
  if (techId === TechType.HERO_ENHANCEMENT) await resyncHeroGear(ctx, p.id);
}

export async function addHero(ctx: Ctx, cityId: number, playerId: number, innLevel: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const g = createRandomHero(Math.max(1, Math.min(20, innLevel)), ctx.rng);
  const [row] = await ctx.tx
    .insert(heroes)
    .values({ ...heroValues(g), playerId, cityId: b.city.id, createdAt: ctx.now })
    .returning();
  await saveHero(ctx, row); // applies the lord's gear
  pushHero(ctx, playerId, row, 0);
  return row.id;
}

export async function setBan(ctx: Ctx, accountId: number, banned: boolean, reason = '') {
  await ctx.tx
    .update(accounts)
    .set({ status: banned ? 1 : 0, banReason: reason })
    .where(eq(accounts.id, accountId));
}

export async function mute(ctx: Ctx, playerName: string, minutes: number) {
  const p = await target(ctx, playerName);
  p.misc = { ...p.misc, denyChatUntil: ctx.now + minutes * 60_000 };
  await savePlayer(ctx, p);
}

export function broadcast(ctx: Ctx, msg: string, tv = true) {
  ctx.broadcast(PushCmd.SYSTEM_INFO_MESSAGE, { alliance: false, tV: tv, noSenderSystemInfo: true, msg });
}

export async function mailPlayer(ctx: Ctx, playerName: string, title: string, content: string) {
  const p = await target(ctx, playerName);
  await sendSystemMail(ctx, p.id, title, content);
}

/** Toggle beginner protection / set title / population for testing and support cases. */
export async function setPlayerFlags(ctx: Ctx, playerName: string, flags: { beginner?: boolean; title?: number }) {
  const p = await target(ctx, playerName);
  if (flags.beginner != null) p.beginner = flags.beginner;
  if (flags.title != null) p.title = Math.max(0, Math.min(9, flags.title));
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

export async function setCityStats(ctx: Ctx, cityId: number, playerId: number, stats: { population?: number; troops?: Record<string, number> }) {
  const b = await openOwnCity(ctx, playerId, cityId);
  if (stats.population != null) b.city.population = Math.max(0, stats.population);
  if (stats.troops) b.city.troops = { ...b.city.troops, ...stats.troops };
  await saveCity(ctx, b.city);
  pushCity(ctx, b);
}
