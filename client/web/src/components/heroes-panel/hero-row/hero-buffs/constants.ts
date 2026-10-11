import { HeroBuffId } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/** The attribute a hero boost raises, as a label in the current locale. */
export const BUFF_LABEL: Partial<Record<HeroBuffId, string>> = {
  get [HeroBuffId.POWER]() {
    return i18n.t('common:heroAttributes.attack');
  },
  get [HeroBuffId.MANAGEMENT]() {
    return i18n.t('common:heroAttributes.politics');
  },
  get [HeroBuffId.STRATAGEM]() {
    return i18n.t('common:heroAttributes.intelligence');
  },
};
