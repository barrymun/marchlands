// Small shared mutations + their push notifications.

import { count, eq } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import { type BuffId, type BuffState, GameError, hasResources, type Message, msg, RESOURCE_KEYS, type Resources } from '@marchlands/core';
import { alliances, cities } from '@marchlands/db';

import { type CityBundle, cityStats } from '#/city.ts';
import type { Ctx } from '#/context.ts';
import { cityBean, playerInfo, resourceBean } from '#/dto.ts';
import type { CityRow, PlayerRow } from '#/repo.ts';

export function spendResources(city: CityRow, cost: Partial<Resources>, message: Message = msg('common.notEnoughResources'), code = -1) {
  if (!hasResources(city, cost)) throw new GameError(message, code);
  for (const k of RESOURCE_KEYS) city[k] -= cost[k] ?? 0;
}

/** Add resources (never negative). Storage caps do not apply to deliveries (orig). */
export function gainResources(city: CityRow, gain: Partial<Resources>, mult = 1) {
  for (const k of RESOURCE_KEYS) city[k] = Math.max(0, city[k] + (gain[k] ?? 0) * mult);
}

export function addPrestige(p: PlayerRow, amount: number) {
  p.prestige = Math.min(2_100_000_000, Math.max(0, p.prestige + amount));
}

/** Change the player's refund credit for a troop or fortification (disbandRefund in core): + after training, - on a refund. */
export function addRefundCredit(p: PlayerRow, key: string, units: number) {
  const next = Math.max(0, (p.misc.refundCredit?.[key] ?? 0) + units);
  const { [key]: _, ...rest } = p.misc.refundCredit ?? {};
  p.misc = { ...p.misc, refundCredit: next > 0 ? { ...rest, [key]: next } : rest };
}

// ---- items ----

export const itemCount = (p: PlayerRow, id: string) => p.items[id] ?? 0;

export function addItem(ctx: Ctx, p: PlayerRow, id: string, n: number) {
  const next = Math.max(0, (p.items[id] ?? 0) + n);
  const items = { ...p.items };
  if (next > 0) items[id] = next;
  else delete items[id];
  p.items = items;
  ctx.push(p.id, PushCmd.ITEM_UPDATE, { items: [{ id, count: next }] });
  if (n) ctx.stat(p.id, 0, { [`items.${n < 0 ? 'used' : 'gained'}.${id}`]: Math.abs(n) });
}

export function consumeItem(ctx: Ctx, p: PlayerRow, id: string, n = 1) {
  if (itemCount(p, id) < n) throw new GameError(msg('common.insufficientItems'), -24);
  addItem(ctx, p, id, -n);
}

/**
 * (marchlands) Charge `gold` from a city: there are no cents, so what the original sold for cents costs
 * city gold (goldForCents). The caller saves the city and pushes its resources.
 */
export function spendGold(city: CityRow, gold: number) {
  if (gold <= 0) return;
  if (city.gold < gold) throw new GameError(msg('common.notEnoughGoldFor', { amount: Math.ceil(gold) }), -99);
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

export const activeBuff = (p: PlayerRow, id: BuffId, now: number): BuffState | undefined => p.buffs.find((b) => b.id === id && b.endTime > now);

/** Set (or extend when `extend`) a timed buff, scheduling its expiry. `desc`: what it does (`buff.*`). */
export function setBuff(ctx: Ctx, p: PlayerRow, id: BuffId, desc: Message, endTime: number, opts: { extend?: boolean; param?: number; itemId?: string } = {}) {
  const cur = activeBuff(p, id, ctx.now);
  const end = opts.extend && cur ? cur.endTime + (endTime - ctx.now) : endTime;
  const buff: BuffState = { id, desc, endTime: end, ...(opts.param != null ? { param: opts.param } : {}), ...(opts.itemId ? { itemId: opts.itemId } : {}) };
  p.buffs = [...p.buffs.filter((b) => b.id !== id && b.endTime > ctx.now), buff];
  ctx.schedule({ type: 'buff.expire', dueAt: end, playerId: p.id, refKey: `buff:${p.id}:${id}`, payload: { buffId: id } });
  ctx.push(p.id, PushCmd.PLAYER_BUFF_UPDATE, { buffBean: { typeId: id, desc, endTime: end }, updateType: 0 });
}

export function removeBuff(ctx: Ctx, p: PlayerRow, id: BuffId) {
  const had = p.buffs.find((b) => b.id === id);
  p.buffs = p.buffs.filter((b) => b.id !== id);
  ctx.unschedule(`buff:${p.id}:${id}`);
  if (had) ctx.push(p.id, PushCmd.PLAYER_BUFF_UPDATE, { buffBean: { typeId: id, desc: had.desc, endTime: had.endTime }, updateType: 1 });
}

// ---- pushes ----

export function pushResources(ctx: Ctx, b: CityBundle) {
  ctx.push(b.player.id, PushCmd.RESOURCE_UPDATE, { castleId: b.city.id, resource: resourceBean(b, cityStats(b, ctx.now)) });
}

export function pushCity(ctx: Ctx, b: CityBundle) {
  ctx.push(b.player.id, PushCmd.CASTLE_UPDATE, { updateType: 2, castleBean: cityBean(b, ctx.now) });
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
  ctx.push(p.id, PushCmd.PLAYER_INFO_UPDATE, { playerInfo: await playerInfoOf(ctx, p) });
}

/** Validate a free-text name: length and a conservative character set. */
/** `what` names the thing being named in the messages (common.playerName, cityName, heroName). */
export function cleanName(raw: unknown, min: number, max: number, what: Message = msg('common.name')): string {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (s.length < min || s.length > max) throw new GameError(msg('common.nameLength', { what, min, max }), -87);
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(s)) throw new GameError(msg('common.nameInvalid', { what }), -87);
  return s;
}

const BAD_WORDS = ['penis', 'cock', 'dick', 'asshole', 'fuck', 'shit', 'bitch', 'tits', 'cunt', 'testicle', 'whore', 'nigger', 'fag'];
export function assertClean(s: string) {
  const l = s.toLowerCase();
  if (BAD_WORDS.some((w) => l.includes(w))) throw new GameError(msg('common.nameNotAllowed'), -99);
}

/** Escape text shown to other players (chat/mail rendered by HTML-capable clients). */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
