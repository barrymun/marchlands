import { StatGroup } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/** Rows of the spending table: the counter group and its label. */
export const SPENDING = [
  {
    group: StatGroup.SPENT_BUILDING,
    get label() {
      return i18n.t('stats-panel:spending.groups.building');
    },
  },
  {
    group: StatGroup.SPENT_RESEARCH,
    get label() {
      return i18n.t('stats-panel:spending.groups.research');
    },
  },
  {
    group: StatGroup.SPENT_TRAINING,
    get label() {
      return i18n.t('stats-panel:spending.groups.training');
    },
  },
  {
    group: StatGroup.SPENT_HEALING,
    get label() {
      return i18n.t('stats-panel:spending.groups.healing');
    },
  },
  {
    group: StatGroup.SPENT_SPEEDUPS,
    get label() {
      return i18n.t('stats-panel:spending.groups.speedups');
    },
  },
  {
    group: StatGroup.SPENT_ITEMS,
    get label() {
      return i18n.t('stats-panel:spending.groups.items');
    },
  },
  {
    group: StatGroup.SPENT_HEROES,
    get label() {
      return i18n.t('stats-panel:spending.groups.heroes');
    },
  },
  {
    group: StatGroup.SPENT_VALLEYS,
    get label() {
      return i18n.t('stats-panel:spending.groups.valleys');
    },
  },
  {
    group: StatGroup.SPENT_COMFORT,
    get label() {
      return i18n.t('stats-panel:spending.groups.comfort');
    },
  },
  {
    group: StatGroup.SPENT_OTHER,
    get label() {
      return i18n.t('stats-panel:spending.groups.other');
    },
  },
] as const;
