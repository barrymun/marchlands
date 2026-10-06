// tech.* — research is per lord; each city's Academy researches up to BALANCE.researchQueues
// techs at a time (orig 1) and a tech can only be researched in one city at once.

import {
  BALANCE,
  BuildingType,
  buildingLevel,
  checkRequirements,
  coinsForSpeedup,
  GameError,
  prestigeOf,
  PrestigeAction,
  requirementsMet,
  researchConfig,
  researchCost,
  researchHeroExp,
  researchMaxLevel,
  researchTimeMs,
  scaled,
  SPEEDUP_ITEMS,
  TECH_IDS,
  TECH_NAMES,
  techEffect,
  techInfo,
  assertCanResearch,
  type ResearchState,
} from '@evony/core';
import { loadBundle, mayorOf, mayorStats, openOwnCity, settleAndReport, viewCity, type CityBundle } from '../city.ts';
import type { Ctx } from '../context.ts';
import { heroBean } from '../dto.ts';
import { addPrestige, gainResources, pushPlayerInfo, pushResources, spendCents, spendResources, useItemOrCents } from '../helpers.ts';
import { citiesOf, getPlayer, saveCity, saveHero, savePlayer, type PlayerRow } from '../repo.ts';

const refKey = (playerId: number, techId: number) => `research:${playerId}:${techId}`;

/** Techs being researched in a given city. */
export function researchesInCity(research: ResearchState, cityId: number): number[] {
  return Object.entries(research)
    .filter(([, r]) => r.cityId === cityId && r.endTime)
    .map(([id]) => Number(id));
}

/** The city's research to act on: `techId` when given, else the only one running. */
function pickResearch(research: ResearchState, cityId: number, techId?: number): number {
  const busy = researchesInCity(research, cityId);
  if (techId != null) {
    if (!busy.includes(techId)) throw new GameError('That technology is not being researched in this city.', -99);
    return techId;
  }
  if (busy.length === 0) throw new GameError('No research in progress.', -99);
  if (busy.length > 1) throw new GameError('Several researches are running: choose one.', -99);
  return busy[0];
}

/** tech.getResearchList */
export async function researchList(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError('Invalid castle.', -99, 403);
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
      return {
        typeId: techId,
        name: TECH_NAMES[techId],
        level: r.level,
        maxLevel: max,
        effectiveLevel: Math.min(academy, r.level),
        upgrading: !!r.endTime,
        castleId: r.cityId ?? null,
        startTime: r.startTime ?? 0,
        endTime: r.endTime ?? 0,
        permission: !full && !r.endTime && !!next && requirementsMet(checks),
        description: techInfo(techId).summary,
        effect: techEffect(techId, Math.min(academy, r.level)),
        nextEffect: next ? techEffect(techId, r.level + 1) : '',
        unlocks: techInfo(techId).unlocks,
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
    throw new GameError(`This city already researches ${BALANCE.researchQueues} technologies at once.`, -99);
  }
  if (research[techId]?.endTime) throw new GameError('This technology is already being researched in another city.', -99);
  assertCanResearch(techId, b.city.buildings, research, b.player.items);
  const level = (research[techId]?.level ?? 0) + 1;
  spendResources(b.city, researchCost(techId, level), 'Not enough resources.', -99);
  const ms = researchTimeMs(techId, level, mayorStats(b.heroes));
  b.player.research = { ...research, [techId]: { level: level - 1, cityId, startTime: ctx.now, endTime: ctx.now + ms } };
  ctx.schedule({ type: 'research', dueAt: ctx.now + ms, playerId, cityId, refKey: refKey(playerId, techId), payload: { techId } });
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
  gainResources(b.city, researchCost(techId, r.level + 1), BALANCE.cancelResearchRefund);
  b.player.research = { ...b.player.research, [techId]: { level: r.level } };
  ctx.unschedule(refKey(playerId, techId));
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

/** tech.getCoinsNeed */
export async function researchSpeedupCost(ctx: Ctx, playerId: number, cityId: number, which?: number) {
  const p = await getPlayer(ctx, playerId);
  const techId = pickResearch(p.research, cityId, which);
  const left = Math.max(0, (p.research[techId].endTime ?? 0) - ctx.now);
  return { coinsNeed: coinsForSpeedup(left), timeLeft: left };
}

/** tech.speedUpResearch */
export async function speedupResearch(ctx: Ctx, playerId: number, cityId: number, itemId: string, which?: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const techId = pickResearch(p.research, cityId, which);
  const r = p.research[techId];
  const end = r.endTime!;
  const left = Math.max(0, end - ctx.now);
  let reduce: number;
  if (itemId === 'free.speed') {
    if (left > scaled(BALANCE.freeSpeedupMs)) throw new GameError('Free speed-up is only available for the last 5 minutes.', -99);
    reduce = left;
  } else if (itemId === 'coins.speed') {
    spendCents(ctx, p, coinsForSpeedup(left));
    reduce = left;
  } else {
    const eff = SPEEDUP_ITEMS[itemId];
    if (!eff) throw new GameError('Invalid speed up.', -99);
    useItemOrCents(ctx, p, itemId, eff.cents);
    reduce = scaled(eff.reduce(end - (r.startTime ?? ctx.now), () => ctx.rng.next()));
  }
  const newEnd = Math.max(ctx.now, end - reduce);
  p.research = { ...p.research, [techId]: { ...r, endTime: newEnd } };
  ctx.schedule({ type: 'research', dueAt: newEnd, playerId, cityId, refKey: refKey(playerId, techId), payload: { techId } });
  ctx.push(playerId, 'server.ResearchUpdate', { castleId: cityId, typeId: techId, endTime: newEnd });
  await savePlayer(ctx, p);
  return { endTime: newEnd };
}

/** Settle every city of a lord before something that changes all their rates (tech, buffs). */
export async function settleAllCities(ctx: Ctx, p: PlayerRow): Promise<CityBundle[]> {
  const out: CityBundle[] = [];
  for (const c of await citiesOf(ctx, p.id, { lock: true })) {
    const b = await loadBundle(ctx, c, p);
    await settleAndReport(ctx, b);
    await saveCity(ctx, b.city);
    out.push(b);
  }
  return out;
}

/** Research completion (timed event). */
export async function completeResearch(ctx: Ctx, playerId: number, techId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const r = p.research[techId];
  if (!r?.endTime) return;
  if (r.endTime > ctx.now) {
    ctx.schedule({ type: 'research', dueAt: r.endTime, playerId, cityId: r.cityId, refKey: refKey(playerId, techId), payload: { techId } });
    return;
  }
  const bundles = await settleAllCities(ctx, p);
  const level = r.level + 1;
  p.research = { ...p.research, [techId]: { level } };
  const home = bundles.find((b) => b.city.id === r.cityId) ?? bundles[0];
  const th = home ? buildingLevel(home.city.buildings, BuildingType.TOWN_HALL) : 1;
  const gain = prestigeOf(PrestigeAction.RESEARCH, techId, level, th);
  addPrestige(p, gain);
  const mayor = home ? mayorOf(home.heroes) : undefined;
  if (mayor) {
    mayor.experience += researchHeroExp(techId, level, th);
    await saveHero(ctx, mayor);
    ctx.push(playerId, 'server.HeroUpdate', { castleId: home!.city.id, hero: heroBean(mayor), updateType: 2 });
  }
  await savePlayer(ctx, p);
  ctx.push(playerId, 'server.ResearchCompleteUpdate', { castleId: r.cityId!, typeId: techId, level });
  for (const b of bundles) pushResources(ctx, b);
  await pushPlayerInfo(ctx, p);
}
