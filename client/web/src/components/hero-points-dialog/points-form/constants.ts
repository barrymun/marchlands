import { i18n } from '@/lib/i18n';

/** The attributes points go to; `label` and `hint` are in the current locale. */
export const STATS = [
  {
    key: 'management',
    get label() {
      return i18n.t('common:heroAttributes.politics');
    },
    get hint() {
      return i18n.t('hero-points-dialog:hints.politics');
    },
    added: 'managementAdded',
    buff: 'managementBuffAdded',
  },
  {
    key: 'power',
    get label() {
      return i18n.t('common:heroAttributes.attack');
    },
    get hint() {
      return i18n.t('hero-points-dialog:hints.attack');
    },
    added: 'powerAdded',
    buff: 'powerBuffAdded',
  },
  {
    key: 'stratagem',
    get label() {
      return i18n.t('common:heroAttributes.intelligence');
    },
    get hint() {
      return i18n.t('hero-points-dialog:hints.intelligence');
    },
    added: 'stratagemAdded',
    buff: 'stratagemBuffAdded',
  },
] as const;

export const HOLY_WATER = 'hero.reset.1';
