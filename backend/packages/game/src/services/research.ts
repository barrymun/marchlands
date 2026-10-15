// tech.* — research is per lord; each city's Academy researches up to BALANCE.researchQueues
// techs at a time (orig 1) and a tech can only be researched in one city at once.

import { PushCmd } from '@marchlands/contracts';
import {
  assertCanResearch,
  BALANCE,
  buildingLevel,
  BuildingType,
  checkRequirements,
  dur,
  GameError,
  goldForSpeedup,
  msg,
  ref,
  requirementsMet,
  researchConfig,
  researchCost,
  researchesInCity,
  researchMaxLevel,
  type ResearchState,
  researchTimeMs,
  scaled,
  SPEEDUP_ITEMS,
  SpeedupId,
  speedupItemGold,
  TECH_IDS,
  techEffect,
  techInfo,
} from '@marchlands/core';

import { mayorStats, openOwnCity, viewCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { refKey } from '#/engine/research.ts';
import { gainResources, pushResources, spendGold, spendResources, useItemOrGold } from '#/helpers.ts';
import { getPlayer, saveCity, savePlayer } from '#/repo.ts';
import { prefixed } from '#/stats.ts';

/** The city's research to act on: `techId` when given, else the only one running. */
function pickResearch(research: ResearchState, cityId: number, techId?: number): number {
  const busy = researchesInCity(research, cityId);
  if (techId != null) {
    if (!busy.includes(techId)) throw new GameError(msg('research.notResearching', { tech: ref.tech(techId) }), -99);
    return techId;
  }
  if (busy.length === 0) throw new GameError(msg('research.noResearch'), -99);
  if (busy.length > 1) throw new GameError(msg('research.chooseResearch'), -99);
  return busy[0];
}

/** tech.getResearchList */
export async function researchList(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  const academy = buildingLevel(b.city.buildings, BuildingType.ACADEMY);
  const busy = researchesInCity(b.player.research, cityId);
  const full = busy.length >= BALANCE.researchQueues;
  return {
    academyLevel: academy,
    researching: busy[0] ?? null,
    researchingIds: busy,
    slots: BALANCE.researchQueues,
    techs: TECH_IDS.map((techId) => {
      const r = b.player.research[techId] ?? { level: 0 };
      const max = researchMaxLevel(techId);
      const next = r.level < max ? researchConfig(techId, r.level + 1) : undefined;
      const checks = next ? checkRequirements(next.requires, b.city.buildings, b.player.research, b.player.items) : [];
      const info = techInfo(techId);
      return {
        typeId: techId,
        level: r.level,
        maxLevel: max,
        effectiveLevel: Math.min(academy, r.level),
        upgrading: !!r.endTime,
        castleId: r.cityId ?? null,
        startTime: r.startTime ?? 0,
        endTime: r.endTime ?? 0,
        permission: !full && !r.endTime && !!next && requirementsMet(checks),
        description: info.summary,
        effect: techEffect(techId, Math.min(academy, r.level)),
        nextEffect: next ? techEffect(techId, r.level + 1) : null,
        unlocks: info.unlocks,
        next: next ? { ...next.cost, time: Math.ceil(researchTimeMs(techId, r.level + 1, mayorStats(b.heroes)) / 1000), requirements: checks } : null,
      };
    }),
  };
}

/** tech.research */
export async function startResearch(ctx: Ctx, playerId: number, cityId: number, techId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const research = b.player.research;
  if (researchesInCity(research, cityId).length >= BALANCE.researchQueues) {
    throw new GameError(msg('research.queueFull', { count: BALANCE.researchQueues }), -99);
  }
  if (research[techId]?.endTime) throw new GameError(msg('research.alreadyResearching', { tech: ref.tech(techId) }), -99);
  assertCanResearch(techId, b.city.buildings, research, b.player.items);
  const level = (research[techId]?.level ?? 0) + 1;
  const cost = researchCost(techId, level);
  spendResources(b.city, cost, msg('common.notEnoughResources'), -99);
  ctx.stat(playerId, cityId, prefixed('spent.research', cost));
  const ms = researchTimeMs(techId, level, mayorStats(b.heroes));
  b.player.research = { ...research, [techId]: { level: level - 1, cityId, startTime: ctx.now, endTime: ctx.now + ms } };
  ctx.schedule({ type: 'research', dueAt: ctx.now + ms, playerId, cityId, refKey: refKey(playerId, techId), payload: { techId } });
  // other open clients (e.g. the activity dock on another device) refresh their research list
  ctx.push(playerId, PushCmd.RESEARCH_UPDATE, { castleId: cityId, typeId: techId, endTime: ctx.now + ms });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
  return { typeId: techId, level: level - 1, startTime: ctx.now, endTime: ctx.now + ms, castleId: cityId };
}

/** tech.cancelResearch: refunds a third of the cost (orig). */
export async function cancelResearch(ctx: Ctx, playerId: number, cityId: number, which?: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const techId = pickResearch(b.player.research, cityId, which);
  const r = b.player.research[techId];
  const paid = researchCost(techId, r.level + 1);
  gainResources(b.city, paid, BALANCE.cancelResearchRefund);
  ctx.stat(playerId, cityId, prefixed('spent.research', paid, -BALANCE.cancelResearchRefund));
  b.player.research = { ...b.player.research, [techId]: { level: r.level } };
  ctx.unschedule(refKey(playerId, techId));
  ctx.push(playerId, PushCmd.RESEARCH_UPDATE, { castleId: cityId, typeId: techId, endTime: 0 });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

/** tech.getCoinsNeed */
export async function researchSpeedupCost(ctx: Ctx, playerId: number, cityId: number, which?: number) {
  const p = await getPlayer(ctx, playerId);
  const techId = pickResearch(p.research, cityId, which);
  const left = Math.max(0, (p.research[techId].endTime ?? 0) - ctx.now);
  return { goldNeed: goldForSpeedup(left), timeLeft: left };
}

/** tech.speedUpResearch */
export async function speedupResearch(ctx: Ctx, playerId: number, cityId: number, itemId: string, which?: number) {
  // the researching city pays in gold for what is not owned
  const b = await openOwnCity(ctx, playerId, cityId);
  const p = b.player;
  const techId = pickResearch(p.research, cityId, which);
  const r = p.research[techId];
  const end = r.endTime!;
  const left = Math.max(0, end - ctx.now);
  let reduce: number;
  if (itemId === SpeedupId.FREE) {
    if (left > scaled(BALANCE.freeSpeedupMs)) throw new GameError(msg('common.freeSpeedupTooEarly', { time: dur(scaled(BALANCE.freeSpeedupMs)) }), -99);
    reduce = left;
  } else if (itemId === SpeedupId.GOLD) {
    const gold = goldForSpeedup(left);
    spendGold(b.city, gold);
    ctx.stat(playerId, cityId, { 'spent.speedups.gold': gold });
    reduce = left;
  } else {
    const eff = SPEEDUP_ITEMS[itemId];
    if (!eff) throw new GameError(msg('common.invalidSpeedup'), -99);
    useItemOrGold(ctx, p, b.city, itemId, speedupItemGold(itemId));
    reduce = scaled(eff.reduce(end - (r.startTime ?? ctx.now), () => ctx.rng.next()));
  }
  const newEnd = Math.max(ctx.now, end - reduce);
  // (marchlands) the start moves back by the time saved, like construction (buildings.ts speedup)
  p.research = { ...p.research, [techId]: { ...r, startTime: (r.startTime ?? ctx.now) - (end - newEnd), endTime: newEnd } };
  ctx.schedule({ type: 'research', dueAt: newEnd, playerId, cityId, refKey: refKey(playerId, techId), payload: { techId } });
  ctx.push(playerId, PushCmd.RESEARCH_UPDATE, { castleId: cityId, typeId: techId, endTime: newEnd });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, p);
  return { endTime: newEnd };
}
