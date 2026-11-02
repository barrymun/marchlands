import type { ReportKind, ReportOrder } from '@marchlands/core';

/** What the list is narrowed to, besides the tab. */
export interface ReportFilter {
  /** coordinates, or part of a name, as typed */
  q: string;
  kind: ReportKind | null;
  unread: boolean;
  /** which reports come first: a sort, not a filter, so it's kept when the filters are cleared */
  order: ReportOrder;
}
