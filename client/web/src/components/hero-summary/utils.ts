import type { HeroBean } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';
import { STATUS } from '@/components/hero-summary/constants';

type Hero = Pick<HeroBean, 'status'>;

/** A hero's status as a label. */
export const statusLabel = (h: Hero) => STATUS[h.status] ?? String(h.status);

/** The hero is the city's mayor (a captured mayor no longer is). */
export const isMayor = (h: Hero) => h.status === HeroStatus.MAYOR;

/** The hero can be made mayor: at home and idle. */
export const canAppoint = (h: Hero) => h.status === HeroStatus.IDLE;

/** The boosts still running at `now`, the soonest to run out first. */
export function runningBoosts(h: Pick<HeroBean, 'buffs'>, now: number): HeroBean['buffs'] {
  return h.buffs.filter((b) => b.endTime > now).sort((a, b) => a.endTime - b.endTime);
}
