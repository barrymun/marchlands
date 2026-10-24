import type { HeroBean } from '@marchlands/api-client';
import { HeroBuffId, HeroStatus } from '@marchlands/core';

import { STATUS } from '@/components/hero-summary/constants';
import { i18n } from '@/lib/i18n';

type Hero = Pick<HeroBean, 'status' | 'seized'>;

/** A hero's status as a label; a captive is a captive whatever it was doing. */
export const statusLabel = (h: Hero) => (h.seized ? i18n.t('hero-summary:status.captive') : (STATUS[h.status] ?? String(h.status)));

/** The hero is the city's mayor (a captured mayor no longer is). */
export const isMayor = (h: Hero) => h.status === HeroStatus.MAYOR && !h.seized;

/** The hero can be made mayor: at home and idle. */
export const canAppoint = (h: Hero) => h.status === HeroStatus.IDLE && !h.seized;

/** The boosts still running at `now`, the soonest to run out first. A captive's home city is kept as a buff, but is no boost. */
export function runningBoosts(h: Pick<HeroBean, 'buffs'>, now: number): HeroBean['buffs'] {
  return h.buffs.filter((b) => b.id !== HeroBuffId.HOME_CITY && b.endTime > now).sort((a, b) => a.endTime - b.endTime);
}
