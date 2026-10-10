import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getReportsByReportIdQueryKey, getReportsOptions, getReportsQueryKey, getReportsUnreadQueryKey, postReportsReadMutation } from '@marchlands/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommand } from '@/hooks/use-game';
import { allOf } from '@/lib/query-keys';
import { PAGE_SIZE, TABS } from '@/components/reports-panel/constants';
import { useUnreadReports } from '@/components/reports-panel/hooks';
import { ReportRow } from '@/components/reports-panel/report-row/report-row';
import { ReportDialog } from '@/components/reports-panel/report-dialog/report-dialog';

export function ReportsPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const type = TABS.find((t) => t.id === tab)!.type;
  const unread = useUnreadReports();
  const list = useQuery({
    ...getReportsOptions({ query: { type: type ?? undefined, pageNo: page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });
  const markAll = useCommand(
    postReportsReadMutation(),
    () => [allOf(getReportsQueryKey), getReportsUnreadQueryKey(), allOf(getReportsByReportIdQueryKey)],
    'All reports marked as read',
  );
  const reports = list.data?.reports ?? [];
  const totalPage = Math.max(1, list.data?.totalPage ?? 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as typeof tab);
              setPage(1);
            }}
          >
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                  {t.label}
                  {(unread.data?.[t.count] ?? 0) > 0 && <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{unread.data?.[t.count]}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" disabled={!unread.data?.count || markAll.isPending} onClick={() => markAll.mutate({ body: {} })}>
            Mark all read
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {list.isPending && <Skeleton className="h-40" />}
        {list.data && reports.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No reports.</p>}
        {reports.length > 0 && (
          <Table>
            <TableBody>
              {reports.map((r) => (
                <ReportRow key={r.id} report={r} onOpen={() => setOpen(r.id)} />
              ))}
            </TableBody>
          </Table>
        )}
        {totalPage > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button size="icon-sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {page} / {totalPage}
            </span>
            <Button size="icon-sm" variant="outline" disabled={page >= totalPage} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Reports are kept for 30 days.</p>
      </CardContent>
      <ReportDialog reportId={open} onClose={() => setOpen(null)} />
    </Card>
  );
}
