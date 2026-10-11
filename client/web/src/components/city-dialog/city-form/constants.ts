import { i18n } from '@/lib/i18n';
import { ItemId } from '@marchlands/core';

export const TELEPORT = ItemId.CITY_TELEPORTER;

/** Field resource labels ("Lumber"), in the current locale. */
export const FIELD_LABEL = {
  get food() {
    return i18n.t('common:resources.food');
  },
  get wood() {
    return i18n.t('common:resources.wood');
  },
  get stone() {
    return i18n.t('common:resources.stone');
  },
  get iron() {
    return i18n.t('common:resources.iron');
  },
};
