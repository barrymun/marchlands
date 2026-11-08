import { ItemId } from '@marchlands/core';
import { i18n } from '@/lib/i18n';
import type { NumberRange } from '@/lib/ranges';

export const TELEPORT = ItemId.LOCATORS_CHARTER;

/** A rate typed as a whole percent, as the server takes it (the tax and work rates). */
export const PERCENT_RANGE = { min: 0, max: 100 } as const satisfies NumberRange;

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
