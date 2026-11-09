import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { getReportsByReportIdQueryKey, getReportsOptions, getReportsQueryKey, getReportsUnreadQueryKey, postReportsReadMutation } from '@marchlands/api-client';

import { AutoReadSwitch } from '@/components/reports-panel/auto-read-switch/auto-read-switch';
import { PAGE_SIZE, TABS } from '@/components/reports-panel/constants';
import { useUnreadReports } from '@/components/reports-panel/hooks';
import { ReportDialog } from '@/components/reports-panel/report-dialog/report-dialog';
import { ReportFilters } from '@/components/reports-panel/report-filters/report-filters';
import { ReportRow } from '@/components/reports-panel/report-row/report-row';
import type { ReportFilter } from '@/components/reports-panel/types';
import { cleared, isFiltered, listQuery, pageToFix, unfiltered } from '@/components/reports-panel/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommand } from '@/hooks/use-game';
import { useSearchState, useSearchText } from '@/hooks/use-search-state';
import { isRefusal, retryUnlessRefused } from '@/lib/errors';
import { fmtExact } from '@/lib/format';
import { allOf } from '@/lib/query-keys';
import { REPORT_SEARCH } from '@/lib/screen-search';

/**
 * The player's reports, by tab, searched and filtered. Where the player is (the tab, the filters, the page, the report
 * open) is in the address (`REPORT_SEARCH`), so a reload lands in the same place; an address that no longer fits (a
 * page past the last, a report since deleted, filters the server won't take) falls back quietly rather than failing.
 */
export function ReportsPanel() {
  const { t } = useTranslation('reports-panel');
  const navigate = useNavigate();
  const [s, set] = useSearchState(REPORT_SEARCH);
  // the box shows each key; the address, and so the list, follows once typing pauses
  const [q, setQ] = useSearchText(s.q, (text) => set({ q: text, page: 1 }));
  // whether this visit opened the report shown (a step the back button takes), so that closing it steps back over it
  const [pushed, setPushed] = useState(false);
  const current = TABS.find((tb) => tb.id === s.tab) ?? TABS[0]; // tab is one of TABS' ids
  const filter: ReportFilter = { q, kind: s.kind, unread: s.unread, order: s.order };
  const filtered = isFiltered(filter, current.kinds);
  const unread = useUnreadReports();
  const list = useQuery({
    ...getReportsOptions({ query: listQuery(current.type, { ...filter, q: s.q }, current.kinds, s.page, PAGE_SIZE) }),
    placeholderData: keepPreviousData,
    retry: retryUnlessRefused,
  });
  const markAll = useCommand(
    postReportsReadMutation(),
    () => [allOf(getReportsQueryKey), getReportsUnreadQueryKey(), allOf(getReportsByReportIdQueryKey)],
    t('markedAllRead'),
  );
  const refilter = (f: ReportFilter) => {
    setQ(f.q);
    set({ q: f.q, kind: f.kind, unread: f.unread, order: f.order, page: 1 });
  };
  const openReport = (id: number) => {
    setPushed(true);
    set({ report: id }, { push: true });
  };
  const closeReport = () => {
    if (!pushed) {
      set({ report: null });
      return;
    }
    setPushed(false);
    void navigate(-1);
  };

  // a page past the last (reports expired or were deleted since): the last there is
  const fixPage = pageToFix(s.page, list.data && !list.isPlaceholderData ? list.data : null);
  useEffect(() => {
    if (fixPage != null) set({ page: fixPage });
  }, [fixPage, set]);
  // filters the server won't take (an address from an older version): this tab as nobody narrowed it, not an error
  const refused = isRefusal(list.error);
  const { tab, report } = s;
  useEffect(() => {
    if (refused) set(unfiltered(tab, report));
  }, [refused, tab, report, set]);

  const reports = list.data?.reports ?? [];
  const totalPage = Math.max(1, list.data?.totalPage ?? 1);
  const page = s.page;
  const total = list.data?.total ?? 0;

  return (
    <Card>
      {/* the tabs show the reports below them: the root adds no box (contents), the list is its panel */}
      <Tabs value={s.tab} onValueChange={(v) => set({ tab: REPORT_SEARCH.tab.read(v), page: 1 })} className="contents">
        <CardHeader className="grid gap-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <TabsList>
              {TABS.map((tb) => (
                <TabsTrigger key={tb.id} value={tb.id} className="gap-1.5">
                  {tb.label}
                  {(unread.data?.[tb.count] ?? 0) > 0 && <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{unread.data?.[tb.count]}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <AutoReadSwitch />
              <Button size="sm" variant="outline" disabled={!unread.data?.count || markAll.isPending} onClick={() => markAll.mutate({ body: {} })}>
                {t('markAllRead')}
              </Button>
            </div>
          </div>
          <ReportFilters value={filter} kinds={current.kinds} filtered={filtered} onSearch={setQ} onChange={refilter} />
        </CardHeader>
        <TabsContent value={s.tab} asChild className="flex-none text-[length:inherit]">
          <CardContent className="grid gap-2">
            {list.isPending && <Skeleton className="h-40" />}
            {list.data && filtered && reports.length > 0 && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {t('found', { count: total, n: fmtExact(total) })}
              </p>
            )}
            {list.data && reports.length === 0 && (
              <div className="grid justify-items-center gap-2 py-10 text-center text-sm text-muted-foreground" aria-live="polite">
                <p>{filtered ? t('noMatches') : t('noReports')}</p>
                {filtered && (
                  <Button size="sm" variant="outline" onClick={() => refilter(cleared(filter))}>
                    {t('filters.clear')}
                  </Button>
                )}
              </div>
            )}
            {reports.length > 0 && (
              <Table className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <TableHeader className="hidden md:table-header-group">
                  <TableRow>
                    <TableHead className="w-4 pe-0" />
                    <TableHead>{t('columns.report')}</TableHead>
                    <TableHead>{t('labels.from')}</TableHead>
                    <TableHead>{t('labels.to')}</TableHead>
                    <TableHead className="text-end">{t('columns.time')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <ReportRow key={r.id} report={r} onOpen={() => openReport(r.id)} />
                  ))}
                </TableBody>
              </Table>
            )}
            {totalPage > 1 && (
              <div className="flex items-center justify-end gap-2 text-sm">
                <Button size="icon-sm" variant="outline" disabled={page <= 1} onClick={() => set({ page: page - 1 })} aria-label={t('previousPage')}>
                  <ChevronLeft className="rtl:-scale-x-100" />
                </Button>
                <span className="tabular-nums text-muted-foreground">
                  {page} / {totalPage}
                </span>
                <Button size="icon-sm" variant="outline" disabled={page >= totalPage} onClick={() => set({ page: page + 1 })} aria-label={t('nextPage')}>
                  <ChevronRight className="rtl:-scale-x-100" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('keptFor')}</p>
          </CardContent>
        </TabsContent>
      </Tabs>
      <ReportDialog reportId={s.report} onClose={closeReport} />
    </Card>
  );
}
