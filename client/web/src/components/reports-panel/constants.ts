import { i18n } from '@/lib/i18n';

export const TABS = [
  {
    id: 'all',
    get label() {
      return i18n.t('reports-panel:tabs.all');
    },
    type: null,
    count: 'count',
  },
  {
    id: 'army',
    get label() {
      return i18n.t('reports-panel:tabs.army');
    },
    type: 1,
    count: 'army_count',
  },
  {
    id: 'trade',
    get label() {
      return i18n.t('reports-panel:tabs.trade');
    },
    type: 0,
    count: 'trade_count',
  },
  {
    id: 'other',
    get label() {
      return i18n.t('reports-panel:tabs.other');
    },
    type: 2,
    count: 'other_count',
  },
] as const;
export const PAGE_SIZE = 20;
