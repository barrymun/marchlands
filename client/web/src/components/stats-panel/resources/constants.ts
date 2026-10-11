import { i18n } from '@/lib/i18n';

/** Columns of the resources table: the counter group and its header. */
export const RESOURCE_COLUMNS = [
  {
    group: 'produced',
    get label() {
      return i18n.t('stats-panel:resources.columns.produced');
    },
  },
  {
    group: 'wasted',
    get label() {
      return i18n.t('stats-panel:resources.columns.wasted');
    },
  },
  {
    group: 'taxed',
    get label() {
      return i18n.t('stats-panel:resources.columns.taxed');
    },
  },
  {
    group: 'plundered',
    get label() {
      return i18n.t('stats-panel:resources.columns.plundered');
    },
  },
  {
    group: 'stolen',
    get label() {
      return i18n.t('stats-panel:resources.columns.stolen');
    },
  },
  {
    group: 'gained.dailyGift',
    get label() {
      return i18n.t('stats-panel:resources.columns.dailyGift');
    },
  },
  {
    group: 'market.bought',
    get label() {
      return i18n.t('stats-panel:resources.columns.bought');
    },
  },
  {
    group: 'market.sold',
    get label() {
      return i18n.t('stats-panel:resources.columns.sold');
    },
  },
] as const;
