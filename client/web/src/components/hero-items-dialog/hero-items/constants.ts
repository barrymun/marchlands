import { i18n } from '@/lib/i18n';

/** The attribute a boost item raises, as a label in the current locale. */
export const ATTR_LABEL = {
  get power() {
    return i18n.t('common:heroAttributes.attack');
  },
  get management() {
    return i18n.t('common:heroAttributes.politics');
  },
  get stratagem() {
    return i18n.t('common:heroAttributes.intelligence');
  },
};
