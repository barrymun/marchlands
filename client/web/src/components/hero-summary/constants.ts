import { HeroStatus } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/** A hero's status as a label, in the current locale. */
export const STATUS: Record<number, string> = {
  get [HeroStatus.IDLE]() {
    return i18n.t('hero-summary:status.idle');
  },
  get [HeroStatus.MAYOR]() {
    return i18n.t('hero-summary:status.mayor');
  },
  get [HeroStatus.ATTACK]() {
    return i18n.t('hero-summary:status.marching');
  },
  get [HeroStatus.RETURN]() {
    return i18n.t('hero-summary:status.returning');
  },
};
