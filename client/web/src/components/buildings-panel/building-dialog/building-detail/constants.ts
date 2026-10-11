import { i18n } from '@/lib/i18n';

/** What each resource is called inside a sentence ("800 lumber"), in the current locale. */
export const REFUND_NAMES = {
  get gold() {
    return i18n.t('common:resourcesInline.gold');
  },
  get food() {
    return i18n.t('common:resourcesInline.food');
  },
  get wood() {
    return i18n.t('common:resourcesInline.wood');
  },
  get stone() {
    return i18n.t('common:resourcesInline.stone');
  },
  get iron() {
    return i18n.t('common:resourcesInline.iron');
  },
};
