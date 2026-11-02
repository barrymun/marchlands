import { ReportKind, ReportOrder } from '@marchlands/core';
import { i18n } from '@/lib/i18n';
import { ReportTab } from '@/lib/screen-search';

export const TABS = [
  {
    id: ReportTab.ALL,
    get label() {
      return i18n.t('reports-panel:tabs.all');
    },
    type: null,
    count: 'count',
    /** the kind filter applies: every kind turns up on this tab */
    kinds: true,
  },
  {
    id: ReportTab.ARMY,
    get label() {
      return i18n.t('reports-panel:tabs.army');
    },
    type: 1,
    count: 'army_count',
    kinds: true,
  },
  {
    id: ReportTab.TRADE,
    get label() {
      return i18n.t('reports-panel:tabs.trade');
    },
    type: 0,
    count: 'trade_count',
    kinds: false,
  },
  {
    id: ReportTab.OTHER,
    get label() {
      return i18n.t('reports-panel:tabs.other');
    },
    type: 2,
    count: 'other_count',
    kinds: false,
  },
] as const;
export const PAGE_SIZE = 20;

/** The kind filter's choice for every kind (a Select item can't have an empty value). */
export const ANY_KIND = 'any';

export const KIND_OPTIONS = [
  ReportKind.BATTLES,
  ReportKind.SCOUTING,
  ReportKind.RETURNS,
  ReportKind.MOVEMENTS,
  ReportKind.OTHER,
] as const satisfies readonly ReportKind[];

export const ORDER_OPTIONS = [ReportOrder.NEWEST, ReportOrder.OLDEST] as const satisfies readonly ReportOrder[];
