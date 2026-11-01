import type { PlanBean, PlanWave } from '@marchlands/api-client';
import { TROOP_ID_BY_KEY, type TroopKey } from '@marchlands/core';

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
