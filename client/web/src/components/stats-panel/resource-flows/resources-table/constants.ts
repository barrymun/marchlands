import { StatGroup } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/** Columns of the resources table: the counter group and its header. */
export const RESOURCE_COLUMNS = [
  {
    group: StatGroup.PRODUCED,
    get label() {
      return i18n.t('stats-panel:resources.columns.produced');
    },
  },
  {
    group: StatGroup.WASTED,
    get label() {
      return i18n.t('stats-panel:resources.columns.wasted');
    },
  },
  {
    group: StatGroup.TAXED,
    get label() {
      return i18n.t('stats-panel:resources.columns.taxed');
    },
  },
  {
    group: StatGroup.PLUNDERED,
    get label() {
      return i18n.t('stats-panel:resources.columns.plundered');
    },
  },
  {
    group: StatGroup.STOLEN,
    get label() {
      return i18n.t('stats-panel:resources.columns.stolen');
    },
  },
  {
    group: StatGroup.GAINED_DAILY_GIFT,
    get label() {
      return i18n.t('stats-panel:resources.columns.dailyGift');
    },
  },
  {
    group: StatGroup.MARKET_BOUGHT,
    get label() {
      return i18n.t('stats-panel:resources.columns.bought');
    },
  },
  {
    group: StatGroup.MARKET_SOLD,
    get label() {
      return i18n.t('stats-panel:resources.columns.sold');
    },
  },
] as const;
