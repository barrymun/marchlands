// Small shared mutations + their push notifications.

import { count, eq } from 'drizzle-orm';
import { GameError, hasResources, RESOURCE_KEYS, type BuffState, type Resources } from '@marchlands/core';
import { alliances, cities } from '@marchlands/db';
import { cityStats, type CityBundle } from './city.ts';
import type { Ctx } from './context.ts';
import { buffsArray, cityBean, playerInfo, resourceBean } from './dto.ts';
import type { CityRow, PlayerRow } from './repo.ts';

export function assertResources(city: CityRow, cost: Partial<Resources>, message = 'Not enough resources.', code = -1) {
  if (!hasResources(city, cost)) throw new GameError(message, code);
}

export function spendResources(city: CityRow, cost: Partial<Resources>, message?: string, code?: number) {
  assertResources(city, cost, message, code);
  for (const k of RESOURCE_KEYS) city[k] -= cost[k] ?? 0;
}

/** Add resources (never negative). Storage caps do not apply to deliveries (orig). */
export function gainResources(city: CityRow, gain: Partial<Resources>, mult = 1) {
  for (const k of RESOURCE_KEYS) city[k] = Math.max(0, city[k] + (gain[k] ?? 0) * mult);
}

export function addPrestige(p: PlayerRow, amount: number) {
  p.prestige = Math.min(2_100_000_000, Math.max(0, p.prestige + amount));
}

// ---- items ----

export const itemCount = (p: PlayerRow, id: string) => p.items[id] ?? 0;

export function addItem(ctx: Ctx, p: PlayerRow, id: string, n: number) {
  const next = Math.max(0, (p.items[id] ?? 0) + n);
  const items = { ...p.items };
  if (next > 0) items[id] = next;
  else delete items[id];
  p.items = items;
  ctx.push(p.id, 'server.ItemUpdate', { items: [{ id, count: next }] });
  if (n) ctx.stat(p.id, 0, { [`items.${n < 0 ? 'used' : 'gained'}.${id}`]: Math.abs(n) });
}

export function consumeItem(ctx: Ctx, p: PlayerRow, id: string, n = 1) {
  if (itemCount(p, id) < n) throw new GameError('Insufficient items.', -24);
  addItem(ctx, p, id, -n);
}

/**
 * (marchlands) Charge `gold` from a city: there are no cents, so what the original sold for cents costs
 * city gold (goldForCents). The caller saves the city and pushes its resources.
 */
export function spendGold(city: CityRow, gold: number) {
  if (gold <= 0) return;
  if (city.gold < gold) throw new GameError(`Not enough gold: ${Math.ceil(gold).toLocaleString('en')} needed.`, -99);
  city.gold -= gold;
}

/** Consume one of `itemId` if owned, otherwise buy it on use with the city's gold (orig: cents). */
export function useItemOrGold(ctx: Ctx, p: PlayerRow, city: CityRow, itemId: string, gold: number) {
  if (itemCount(p, itemId) > 0) addItem(ctx, p, itemId, -1);
  else {
    spendGold(city, gold);
    ctx.stat(p.id, city.id, { 'spent.items.gold': gold, [`items.used.${itemId}`]: 1 });
  }
}

// ---- buffs ----

export const activeBuff = (p: PlayerRow, id: string, now: number): BuffState | undefined => p.buffs.find((b) => b.id === id && b.endTime > now);

/** Set (or extend when `extend`) a timed buff, scheduling its expiry. */
export function setBuff(
  ctx: Ctx,
  p: PlayerRow,
  id: string,
  desc: string,
  endTime: number,
  opts: { extend?: boolean; param?: number; itemId?: string } = {},
) {
  const cur = activeBuff(p, id, ctx.now);
  const end = opts.extend && cur ? cur.endTime + (endTime - ctx.now) : endTime;
  const buff: BuffState = { id, desc, endTime: end, ...(opts.param != null ? { param: opts.param } : {}), ...(opts.itemId ? { itemId: opts.itemId } : {}) };
  p.buffs = [...p.buffs.filter((b) => b.id !== id && b.endTime > ctx.now), buff];
  ctx.schedule({ type: 'buff.expire', dueAt: end, playerId: p.id, refKey: `buff:${p.id}:${id}`, payload: { buffId: id } });
  ctx.push(p.id, 'server.PlayerBuffUpdate', { buffBean: { typeId: id, descName: desc, endTime: end }, updateType: 0 });
}

export function removeBuff(ctx: Ctx, p: PlayerRow, id: string) {
  const had = p.buffs.find((b) => b.id === id);
  p.buffs = p.buffs.filter((b) => b.id !== id);
  ctx.unschedule(`buff:${p.id}:${id}`);
  if (had) ctx.push(p.id, 'server.PlayerBuffUpdate', { buffBean: { typeId: id, descName: had.desc, endTime: had.endTime }, updateType: 1 });
}

// ---- pushes ----

export function pushResources(ctx: Ctx, b: CityBundle) {
  ctx.push(b.player.id, 'server.ResourceUpdate', { castleId: b.city.id, resource: resourceBean(b, cityStats(b, ctx.now)) });
}

export function pushCity(ctx: Ctx, b: CityBundle) {
  ctx.push(b.player.id, 'server.CastleUpdate', { updateType: 2, castleBean: cityBean(b, ctx.now) });
}

export async function playerInfoOf(ctx: Ctx, p: PlayerRow) {
  const [{ n }] = await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, p.id));
  let allianceName = '';
  if (p.allianceId) {
    const [a] = await ctx.tx.select({ name: alliances.name }).from(alliances).where(eq(alliances.id, p.allianceId));
    allianceName = a?.name ?? '';
  }
  return playerInfo(p, { cityCount: Number(n), allianceName });
}

export async function pushPlayerInfo(ctx: Ctx, p: PlayerRow) {
  ctx.push(p.id, 'server.PlayerInfoUpdate', { playerInfo: await playerInfoOf(ctx, p) });
}

export function pushBuffs(ctx: Ctx, p: PlayerRow) {
  ctx.push(p.id, 'server.PlayerBuffsUpdate', { buffs: buffsArray(p.buffs, ctx.now) });
}

/** Validate a free-text name: length and a conservative character set. */
export function cleanName(raw: unknown, min: number, max: number, what = 'Name'): string {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (s.length < min || s.length > max) throw new GameError(`${what} must be ${min}-${max} characters.`, -87);
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(s)) throw new GameError(`${what} contains invalid characters.`, -87);
  return s;
}

const BAD_WORDS = ['penis', 'cock', 'dick', 'asshole', 'fuck', 'shit', 'bitch', 'tits', 'cunt', 'testicle', 'whore', 'nigger', 'fag'];
export function assertClean(s: string) {
  const l = s.toLowerCase();
  if (BAD_WORDS.some((w) => l.includes(w))) throw new GameError('Illegal naming, please choose another name.', -99);
}

/** Escape text shown to other players (chat/mail rendered by HTML-capable clients). */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
