// quest.* — evaluates the quest catalogue against the lord's state; finished quests can be
// claimed once for their award (orig sent a single hard-coded dummy quest).

import { and, count, eq, inArray } from 'drizzle-orm';
import { evaluateTarget, GameError, HeroStatus, QUEST_CATALOGUE, questById, questGroups, TROOP_KEY_LIST, FORT_KEY_LIST, type QuestSnapshot } from '@evony/core';
import { heroes, mails, playerRelations, questProgress, tiles } from '@evony/db';
import { openOwnCity } from '../city.ts';
import type { Ctx } from '../context.ts';
import { addItem, gainResources, pushResources } from '../helpers.ts';
import { citiesOf, getPlayer, saveCity, savePlayer } from '../repo.ts';

async function snapshot(ctx: Ctx, playerId: number): Promise<QuestSnapshot> {
  const p = await getPlayer(ctx, playerId);
  const cityRows = await citiesOf(ctx, playerId);
  const buildings: Record<number, number[]> = {};
  const troops: Record<string, number> = {};
  let population = 0;
  let minTax = 100;
  for (const c of cityRows) {
    for (const b of c.buildings) (buildings[b.typeId] ??= []).push(b.level);
    for (const k of TROOP_KEY_LIST) troops[k] = (troops[k] ?? 0) + (c.troops[k] ?? 0);
    for (const k of FORT_KEY_LIST) troops[k] = (troops[k] ?? 0) + (c.forts[k] ?? 0);
    population += c.population;
    minTax = Math.min(minTax, c.taxRate);
  }
  const cityIds = cityRows.map((c) => c.id);
  const heroRows = cityIds.length
    ? await ctx.tx
        .select({ status: heroes.status })
        .from(heroes)
        .where(and(inArray(heroes.cityId, cityIds), eq(heroes.inTavern, false), eq(heroes.playerId, playerId)))
    : [];
  const [{ n: valleys }] = cityIds.length ? await ctx.tx.select({ n: count() }).from(tiles).where(inArray(tiles.ownerCityId, cityIds)) : [{ n: 0 }];
  const [{ n: sent }] = await ctx.tx.select({ n: count() }).from(mails).where(and(eq(mails.playerId, playerId), eq(mails.type, 3)));
  const [{ n: friends }] = await ctx.tx.select({ n: count() }).from(playerRelations).where(and(eq(playerRelations.playerId, playerId), eq(playerRelations.kind, 'friend')));
  return {
    buildings,
    research: Object.fromEntries(Object.entries(p.research).map(([k, v]) => [Number(k), v.level])),
    troops,
    heroes: heroRows.length,
    hasMayor: heroRows.some((h) => h.status === HeroStatus.MAYOR),
    inAlliance: !!p.allianceId,
    cities: cityRows.length,
    valleys: Number(valleys),
    prestige: p.prestige,
    population,
    minTaxRate: minTax,
    mailsSent: Number(sent),
    friends: Number(friends),
  };
}

async function progressMap(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx.select().from(questProgress).where(eq(questProgress.playerId, playerId));
  return new Map(rows.map((r) => [r.questId, r.status]));
}

/** quest.getQuestType: quest groups with counts of finished-but-unclaimed quests. */
export async function questTypes(ctx: Ctx, playerId: number) {
  const list = await questList(ctx, playerId);
  return questGroups()
    .filter((g) => QUEST_CATALOGUE.some((q) => q.groupId === g.typeId))
    .map((g) => ({
      typeId: g.typeId,
      name: g.name,
      description: g.description,
      isFinish: list.some((q) => q.groupId === g.typeId && q.isFinish && !q.claimed),
    }));
}

/** quest.getQuestList */
export async function questList(ctx: Ctx, playerId: number, groupId?: number) {
  const s = await snapshot(ctx, playerId);
  const progress = await progressMap(ctx, playerId);
  return QUEST_CATALOGUE.filter((q) => groupId == null || q.groupId === groupId)
    .filter((q) => (q.after ?? []).every((id) => progress.get(id) === 2))
    .map((q) => {
      const targets = q.targets.map((t) => ({ name: t.name, finished: evaluateTarget(t.target, s) }));
      const claimed = progress.get(q.id) === 2;
      return {
        questId: q.id,
        groupId: q.groupId,
        name: q.name,
        description: q.description,
        targets,
        award: q.award,
        isFinish: claimed || targets.every((t) => t.finished),
        claimed,
      };
    });
}

/** quest.award: claim a finished quest's reward into a city. */
export async function claimQuest(ctx: Ctx, playerId: number, questId: number, cityId: number) {
  const q = questById(questId);
  if (!q) throw new GameError('Quest not found.', -99, 404);
  const b = await openOwnCity(ctx, playerId, cityId);
  const [done] = await ctx.tx.select().from(questProgress).where(and(eq(questProgress.playerId, playerId), eq(questProgress.questId, questId))).for('update');
  if (done?.status === 2) throw new GameError('Reward already claimed.', -99);
  const s = await snapshot(ctx, playerId);
  if (!q.targets.every((t) => evaluateTarget(t.target, s))) throw new GameError('Quest not finished yet.', -99);
  if (q.award.resources) gainResources(b.city, q.award.resources);
  for (const [id, n] of Object.entries(q.award.items ?? {})) addItem(ctx, b.player, id, n);
  await ctx.tx
    .insert(questProgress)
    .values({ playerId, questId, status: 2, updatedAt: ctx.now })
    .onConflictDoUpdate({ target: [questProgress.playerId, questProgress.questId], set: { status: 2, updatedAt: ctx.now } });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
  return q.award;
}

/** Daily gift (quest type 3 in the original client): one Amulet a day. */
export async function claimDailyGift(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const day = new Date(ctx.now).toISOString().slice(0, 10);
  if (p.misc.dailyGiftDay === day) throw new GameError('You already received today’s gift.', -99);
  p.misc = { ...p.misc, dailyGiftDay: day };
  addItem(ctx, p, 'player.box.gambling.3', 1);
  await savePlayer(ctx, p);
  return { items: { 'player.box.gambling.3': 1 } };
}
