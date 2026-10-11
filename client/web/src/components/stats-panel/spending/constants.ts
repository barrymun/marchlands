import { i18n } from '@/lib/i18n';

/** Rows of the spending table: the counter group and its label. */
export const SPENDING = [
  {
    group: 'building',
    get label() {
      return i18n.t('stats-panel:spending.groups.building');
    },
  },
  {
    group: 'research',
    get label() {
      return i18n.t('stats-panel:spending.groups.research');
    },
  },
  {
    group: 'training',
    get label() {
      return i18n.t('stats-panel:spending.groups.training');
    },
  },
  {
    group: 'healing',
    get label() {
      return i18n.t('stats-panel:spending.groups.healing');
    },
  },
  {
    group: 'speedups',
    get label() {
      return i18n.t('stats-panel:spending.groups.speedups');
    },
  },
  {
    group: 'items',
    get label() {
      return i18n.t('stats-panel:spending.groups.items');
    },
  },
  {
    group: 'heroes',
    get label() {
      return i18n.t('stats-panel:spending.groups.heroes');
    },
  },
  {
    group: 'valleys',
    get label() {
      return i18n.t('stats-panel:spending.groups.valleys');
    },
  },
  {
    group: 'comfort',
    get label() {
      return i18n.t('stats-panel:spending.groups.comfort');
    },
  },
  {
    group: 'other',
    get label() {
      return i18n.t('stats-panel:spending.groups.other');
    },
  },
] as const;
