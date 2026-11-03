import type { PlanBean, PlanWave } from '@marchlands/api-client';
import { BALANCE, TROOP_ID_BY_KEY, type TroopKey } from '@marchlands/core';

import { fmtExact } from '@/lib/format';
import { troopName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';

/** When one of the player's own unsent waves must leave to land in its place (server time); null for any other wave. */
export const waveLeaves = (plan: Pick<PlanBean, 'landAt'>, wave: Pick<PlanWave, 'position' | 'marchMs'>) =>
  wave.marchMs == null ? null : plan.landAt + wave.position - wave.marchMs;

/** The player's own waves still to send that can still make it, in the plan's order. */
export const sendable = (plan: PlanBean, playerId: number, now: number) =>
  plan.waves.filter((w) => w.playerId === playerId && w.armyId == null && (waveLeaves(plan, w) ?? 0) >= now);

/** A wave's troops as a list: "1,000 Archer, 10 Scout". */
export function troopsText(troops: Record<string, number>): string {
  return Object.entries(troops)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${fmtExact(n)} ${troopName(TROOP_ID_BY_KEY[key as TroopKey])}`)
    .join(i18n.t('common:list.separator'));
}

/** The place in the order a new wave takes: after the last (each lands a millisecond after the one before). */
export const nextPosition = (plan: Pick<PlanBean, 'waves'>) => Math.max(-1, ...plan.waves.map((w) => w.position)) + 1;

/** Whether the plan takes another wave: its second still ahead, and room left in it. */
export const takesWaves = (plan: PlanBean, now: number) => plan.landAt > now && plan.waves.length < BALANCE.warPlans.maxWaves;

/** What a city has set out in the player's waves not yet sent, across all their plans: troops by type and heroes. */
export function plannedFrom(plans: PlanBean[], playerId: number, cityId: number): { troops: Partial<Record<TroopKey, number>>; heroIds: number[] } {
  const troops: Partial<Record<TroopKey, number>> = {};
  const heroIds: number[] = [];
  for (const w of plans.flatMap((p) => p.waves)) {
    if (w.playerId !== playerId || w.cityId !== cityId || w.armyId != null) continue;
    for (const [k, n] of Object.entries(w.troops)) troops[k as TroopKey] = (troops[k as TroopKey] ?? 0) + n;
    if (w.heroId != null) heroIds.push(w.heroId);
  }
  return { troops, heroIds };
}
