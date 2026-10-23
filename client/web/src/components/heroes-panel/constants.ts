import { HeroStatus } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/** A hero's status as a label, in the current locale. */
export const STATUS: Record<number, string> = {
  get [HeroStatus.IDLE]() {
    return i18n.t('heroes-panel:status.idle');
  },
  get [HeroStatus.MAYOR]() {
    return i18n.t('heroes-panel:status.mayor');
  },
  get [HeroStatus.ATTACK]() {
    return i18n.t('heroes-panel:status.marching');
  },
  get [HeroStatus.SEIZED]() {
    return i18n.t('heroes-panel:status.captive');
  },
  get [HeroStatus.RETURN]() {
    return i18n.t('heroes-panel:status.returning');
  },
};

/**
 * The Heroes page's tabs, in order; the first is shown when the address names none or one it doesn't know. `?tab=inn`
 * (the Inn's building, the mayor chip) shows the heroes with the Inn brought into view.
 */
export const HERO_TABS = ['heroes', 'gear'] as const;
