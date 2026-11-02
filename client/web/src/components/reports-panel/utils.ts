import type { GetReportsData } from '@marchlands/api-client';
import { ReportOrder } from '@marchlands/core';

import type { ReportFilter } from '@/components/reports-panel/types';
import { REPORT_SEARCH, type ReportTab } from '@/lib/screen-search';
import { defaultsOf, type SearchValues } from '@/lib/search-state';

export const NO_FILTER: ReportFilter = { q: '', kind: null, unread: false, order: ReportOrder.NEWEST };

/** The list query for a tab, a filter and a page: the kind only where the tab shows it, an empty search left out. */
export function listQuery(type: number | null, filter: ReportFilter, kinds: boolean, pageNo: number, pageSize: number): NonNullable<GetReportsData['query']> {
  const q = filter.q.trim();
  return {
    pageNo,
    pageSize,
    ...(type != null && { type }),
    ...(q && { q }),
    ...(kinds && filter.kind && { kind: filter.kind }),
    ...(filter.unread && { unread: 'true' as const }),
    ...(filter.order !== ReportOrder.NEWEST && { order: filter.order }),
  };
}

/** The filter with nothing narrowing the list, in the same order. */
export const cleared = (filter: ReportFilter): ReportFilter => ({ ...NO_FILTER, order: filter.order });

/** Whether anything narrows the list on this tab (its kind filter only counts where it shows; the order narrows nothing). */
export const isFiltered = (filter: ReportFilter, kinds: boolean) => filter.q.trim() !== '' || (kinds && filter.kind != null) || filter.unread;

/**
 * The page to go to when the list's answer says this page no longer exists (reports expired or were deleted since):
 * the last there is; null while it exists. Give it only the answer for this very page: the previous page's, still on
 * show while it loads, says nothing about this one.
 */
export function pageToFix(page: number, answer: { totalPage: number } | null): number | null {
  if (!answer) return null;
  const last = Math.max(1, answer.totalPage);
  return page > last ? last : null;
}

/** The list as nobody narrowed it, on the same tab with the same report open: where filters the server refused go. */
export function unfiltered(tab: ReportTab, report: number | null): SearchValues<typeof REPORT_SEARCH> {
  return { ...defaultsOf(REPORT_SEARCH), tab, report };
}
