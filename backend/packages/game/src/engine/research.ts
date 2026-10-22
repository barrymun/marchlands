// Research completion (timed event) and settling a lord's cities before their rates change.

import { PushCmd } from '@marchlands/contracts';
import { addHeroExp, buildingLevel, BuildingType, PrestigeAction, prestigeOf, researchHeroExp, TechType } from '@marchlands/core';

import { type CityBundle, loadBundle, mayorOf, settleAndReport } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { heroBean } from '#/dto.ts';
import { resyncHeroGear } from '#/engine/heroes.ts';
import { addPrestige, pushPlayerInfo, pushResources } from '#/helpers.ts';
import { citiesOf, getPlayer, type PlayerRow, saveCity, saveHero, savePlayer } from '#/repo.ts';

export const refKey = (playerId: number, techId: number) => `research:${playerId}:${techId}`;

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
  ctx.stat(playerId, r.cityId ?? 0, { 'levels.research': 1 });
  const home = bundles.find((b) => b.city.id === r.cityId) ?? bundles[0];
  const th = home ? buildingLevel(home.city.buildings, BuildingType.TOWN_HALL) : 1;
  const gain = prestigeOf(PrestigeAction.RESEARCH, techId, level, th);
  addPrestige(p, gain);
  const mayor = home ? mayorOf(home.heroes) : undefined;
  if (home && mayor) {
    addHeroExp(mayor, researchHeroExp(techId, level, th));
    await saveHero(ctx, mayor);
    ctx.push(playerId, PushCmd.HERO_UPDATE, { castleId: home.city.id, hero: heroBean(mayor), updateType: 2 });
  }
  await savePlayer(ctx, p);
  ctx.push(playerId, PushCmd.RESEARCH_COMPLETE_UPDATE, { castleId: r.cityId ?? home?.city.id ?? 0, typeId: techId, level });
  for (const b of bundles) pushResources(ctx, b);
  await pushPlayerInfo(ctx, p);
  // Hero Enhancement raises every hero's gear (gear.ts)
  if (techId === TechType.HERO_ENHANCEMENT) await resyncHeroGear(ctx, playerId);
}
