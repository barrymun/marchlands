import { Mission } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/** A mission's name in the current locale (getters, so the names follow a locale change). */
export const MISSION_NAMES: Record<number, string> = {
  get [Mission.TRANSPORT]() {
    return i18n.t('armies-panel:missions.transport');
  },
  get [Mission.REINFORCE]() {
    return i18n.t('armies-panel:missions.reinforce');
  },
  get [Mission.SCOUT]() {
    return i18n.t('armies-panel:missions.scout');
  },
  get [Mission.BUILD_CITY]() {
    return i18n.t('armies-panel:missions.buildCity');
  },
  get [Mission.ATTACK]() {
    return i18n.t('armies-panel:missions.attack');
  },
};
