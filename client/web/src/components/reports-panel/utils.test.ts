import { describe, expect, it } from 'vitest';

import { ReportKind, ReportOrder } from '@marchlands/core';

import { cleared, isFiltered, listQuery, NO_FILTER, pageToFix, unfiltered } from '@/components/reports-panel/utils';
import { ReportTab } from '@/lib/screen-search';

describe(listQuery.name, () => {
  it('asks for a page of every report when nothing is filtered', () => {
    expect(listQuery(null, NO_FILTER, true, 1, 20)).toEqual({ pageNo: 1, pageSize: 20 });
  });

  it('adds the tab, the trimmed search, the kind and unread', () => {
    expect(listQuery(1, { q: '  207,405 ', kind: ReportKind.BATTLES, unread: true, order: ReportOrder.OLDEST }, true, 3, 20)).toEqual({
      pageNo: 3,
      pageSize: 20,
      type: 1,
      q: '207,405',
      kind: 'battles',
      unread: 'true',
      order: 'oldest',
    });
  });

  it('keeps the trade tab (type 0) and leaves out a blank search and a kind the tab does not show', () => {
    expect(listQuery(0, { q: '   ', kind: ReportKind.RETURNS, unread: false, order: ReportOrder.NEWEST }, false, 1, 20)).toEqual({
      pageNo: 1,
      pageSize: 20,
      type: 0,
    });
  });
});

describe(isFiltered.name, () => {
  it('is false with no filter, or only blanks typed', () => {
    expect(isFiltered(NO_FILTER, true)).toBe(false);
    expect(isFiltered({ ...NO_FILTER, q: '  ' }, true)).toBe(false);
  });

  it('is true for a search, a kind the tab shows, or unread', () => {
    expect(isFiltered({ ...NO_FILTER, q: 'Oak' }, false)).toBe(true);
    expect(isFiltered({ ...NO_FILTER, kind: ReportKind.SCOUTING }, true)).toBe(true);
    expect(isFiltered({ ...NO_FILTER, unread: true }, false)).toBe(true);
  });

  it('ignores a kind the tab does not show, and the order', () => {
    expect(isFiltered({ ...NO_FILTER, kind: ReportKind.SCOUTING }, false)).toBe(false);
    expect(isFiltered({ ...NO_FILTER, order: ReportOrder.OLDEST }, true)).toBe(false);
  });
});

describe(cleared.name, () => {
  it('clears the search and filters but keeps the order', () => {
    expect(cleared({ q: 'Oak', kind: ReportKind.BATTLES, unread: true, order: ReportOrder.OLDEST })).toEqual({ ...NO_FILTER, order: ReportOrder.OLDEST });
    expect(cleared({ ...NO_FILTER, unread: true })).toEqual(NO_FILTER);
  });
});

describe(pageToFix.name, () => {
  it('leaves a page that exists alone', () => {
    expect(pageToFix(1, { totalPage: 3 })).toBeNull();
    expect(pageToFix(3, { totalPage: 3 })).toBeNull();
  });

  it('goes to the last page from one past it', () => {
    expect(pageToFix(7, { totalPage: 5 })).toBe(5);
  });

  it('goes to the first page when nothing matches', () => {
    expect(pageToFix(2, { totalPage: 0 })).toBe(1);
    expect(pageToFix(1, { totalPage: 0 })).toBeNull();
  });

  it('waits for an answer', () => {
    expect(pageToFix(7, null)).toBeNull();
  });
});

describe(unfiltered.name, () => {
  it('clears every filter, the order and the page, keeping the tab and the report open', () => {
    expect(unfiltered(ReportTab.ARMY, 12)).toEqual({ tab: ReportTab.ARMY, q: '', kind: null, unread: false, order: ReportOrder.NEWEST, page: 1, report: 12 });
    expect(unfiltered(ReportTab.ALL, null)).toMatchObject({ tab: ReportTab.ALL, report: null });
  });
});
