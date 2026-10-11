import { i18n } from '@/lib/i18n';

/** Columns of the units table: the counter group and its header. */
export const UNIT_COLUMNS = [
  {
    group: 'trained',
    get label() {
      return i18n.t('stats-panel:units.columns.trained');
    },
  },
  {
    group: 'killed',
    get label() {
      return i18n.t('stats-panel:units.columns.killed');
    },
  },
  {
    group: 'died',
    get label() {
      return i18n.t('stats-panel:units.columns.died');
    },
  },
  {
    group: 'injured',
    get label() {
      return i18n.t('stats-panel:units.columns.injured');
    },
  },
  {
    group: 'healed',
    get label() {
      return i18n.t('stats-panel:units.columns.healed');
    },
  },
  {
    group: 'deserted',
    get label() {
      return i18n.t('stats-panel:units.columns.deserted');
    },
  },
  {
    group: 'disbanded',
    get label() {
      return i18n.t('stats-panel:units.columns.disbanded');
    },
  },
] as const;
