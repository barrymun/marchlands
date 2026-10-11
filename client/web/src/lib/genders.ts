import { i18n } from '@/lib/i18n';

/** The genders a player can pick (playerInfo.sex). */
export const GENDERS = [
  {
    value: 0,
    get label() {
      return i18n.t('common:genders.male');
    },
  },
  {
    value: 1,
    get label() {
      return i18n.t('common:genders.female');
    },
  },
];
