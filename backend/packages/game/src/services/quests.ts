// quest.* — evaluates the quest catalogue against the lord's state; finished quests can be
// claimed once for their award (orig sent a single hard-coded dummy quest).

import { and, count, eq, inArray } from 'drizzle-orm';

import {
  BALANCE,
  evaluateTarget,
  FORT_KEY_LIST,
  GameError,
  HeroStatus,
  msg,
  PlayerRelationKind,
  QUEST_CATALOGUE,
  questById,
  questGroupsWithQuests,
  type QuestSnapshot,
  questTargetMessage,
  TROOP_KEY_LIST,
} from '@marchlands/core';
import { heroes, mails, one, playerRelations, questProgress, tiles } from '@marchlands/db';

import { openOwnCity } from '#/city.ts';
import type { Ctx } from '#/context.ts';
import { addItem, gainResources, pushResources } from '#/helpers.ts';
import { citiesOf, getPlayer, saveCity, savePlayer } from '#/repo.ts';
import { prefixed } from '#/stats.ts';

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
  const { n: valleys } = one(cityIds.length ? await ctx.tx.select({ n: count() }).from(tiles).where(inArray(tiles.ownerCityId, cityIds)) : [{ n: 0 }]);
  const { n: sent } = one(
    await ctx.tx
      .select({ n: count() })
      .from(mails)
      .where(and(eq(mails.playerId, playerId), eq(mails.type, 3))),
  );
  const { n: friends } = one(
    await ctx.tx
      .select({ n: count() })
      .from(playerRelations)
      .where(and(eq(playerRelations.playerId, playerId), eq(playerRelations.kind, PlayerRelationKind.FRIEND))),
  );
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

/** quest.getQuestType: quest groups with counts of finished-but-unclaimed quests (named by the client, `data-quests` by group id). */
export async function questTypes(ctx: Ctx, playerId: number) {
  const list = await questList(ctx, playerId);
  return questGroupsWithQuests().map((g) => ({
    id: g.id,
    typeId: g.typeId,
    isFinish: list.some((q) => q.groupId === g.id && q.isFinish && !q.claimed),
  }));
}

/** quest.getQuestList: quests are named by the client (`data-quests` by quest id); descriptions and targets are messages. */
export async function questList(ctx: Ctx, playerId: number, groupId?: number) {
  const s = await snapshot(ctx, playerId);
  const progress = await progressMap(ctx, playerId);
  return QUEST_CATALOGUE.filter((q) => groupId == null || q.groupId === groupId)
    .filter((q) => (q.after ?? []).every((id) => progress.get(id) === 2))
    .map((q) => {
      const targets = q.targets.map((t) => ({ text: questTargetMessage(t), finished: evaluateTarget(t, s) }));
      const claimed = progress.get(q.id) === 2;
      return {
        questId: q.id,
        groupId: q.groupId,
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
  if (!q) throw new GameError(msg('quest.notFound'), -99, 404);
  const b = await openOwnCity(ctx, playerId, cityId);
  const [done] = await ctx.tx
    .select()
    .from(questProgress)
    .where(and(eq(questProgress.playerId, playerId), eq(questProgress.questId, questId)))
    .for('update');
  if (done?.status === 2) throw new GameError(msg('quest.alreadyClaimed'), -99);
  const s = await snapshot(ctx, playerId);
  if (!q.targets.every((t) => evaluateTarget(t, s))) throw new GameError(msg('quest.notFinished'), -99);
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

/** Daily gift (quest type 3 in the original client); (marchlands) a fixed bundle of resources (BALANCE.dailyGift), not an Amulet. */
export async function claimDailyGift(ctx: Ctx, playerId: number, cityId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const day = new Date(ctx.now).toISOString().slice(0, 10);
  if (b.player.misc.dailyGiftDay === day) throw new GameError(msg('quest.dailyGiftClaimed'), -99);
  b.player.misc = { ...b.player.misc, dailyGiftDay: day };
  const resources = { ...BALANCE.dailyGift };
  gainResources(b.city, resources);
  ctx.stat(playerId, cityId, prefixed('gained.dailyGift', resources));
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
  return { resources };
}
