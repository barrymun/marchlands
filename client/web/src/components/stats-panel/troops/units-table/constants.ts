import { UnitGroup } from '@/components/stats-panel/constants';
import { i18n } from '@/lib/i18n';

/** Columns of the units table: the counter group and its header. */
export const UNIT_COLUMNS = [
  {
    group: UnitGroup.TRAINED,
    get label() {
      return i18n.t('stats-panel:units.columns.trained');
    },
  },
  {
    group: UnitGroup.KILLED,
    get label() {
      return i18n.t('stats-panel:units.columns.killed');
    },
  },
  {
    group: UnitGroup.DIED,
    get label() {
      return i18n.t('stats-panel:units.columns.died');
    },
  },
  {
    group: UnitGroup.INJURED,
    get label() {
      return i18n.t('stats-panel:units.columns.injured');
    },
  },
  {
    group: UnitGroup.HEALED,
    get label() {
      return i18n.t('stats-panel:units.columns.healed');
    },
  },
  {
    group: UnitGroup.DESERTED,
    get label() {
      return i18n.t('stats-panel:units.columns.deserted');
    },
  },
  {
    group: UnitGroup.DISBANDED,
    get label() {
      return i18n.t('stats-panel:units.columns.disbanded');
    },
  },
] as const;
