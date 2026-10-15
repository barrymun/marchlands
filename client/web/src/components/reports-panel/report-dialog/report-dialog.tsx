import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getReportsByReportIdOptions,
  getReportsByReportIdQueryKey,
  getReportsQueryKey,
  getReportsUnreadQueryKey,
  postReportsDeleteMutation,
} from '@marchlands/api-client';

import { ReportContent } from '@/components/reports-panel/report-dialog/report-content/report-content';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommand } from '@/hooks/use-game';
import { useSticky } from '@/hooks/use-sticky';
import { dateTime } from '@/lib/format';
import { translateMessage } from '@/lib/messages';
import { allOf } from '@/lib/query-keys';

export function ReportDialog({ reportId, onClose }: { reportId: number | null; onClose: () => void }) {
  const { t } = useTranslation(['reports-panel', 'common']);
  const id = useSticky(reportId);
  const detail = useQuery({
    ...getReportsByReportIdOptions({ path: { reportId: id ?? 0 } }),
    enabled: id != null,
  });
  const remove = useCommand(
    postReportsDeleteMutation(),
    () => [allOf(getReportsQueryKey), getReportsUnreadQueryKey(), allOf(getReportsByReportIdQueryKey)],
    t('dialog.deleted'),
  );
  // opening a report marks it read on the server: refresh the list and the unread counters
  const qc = useQueryClient();
  const loadedId = detail.data?.id;
  useEffect(() => {
    if (loadedId == null) return;
    void qc.invalidateQueries({ queryKey: allOf(getReportsQueryKey) });
    void qc.invalidateQueries({ queryKey: getReportsUnreadQueryKey() });
  }, [loadedId, qc]);
  const r = detail.data;
  return (
    <Dialog open={reportId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{r ? translateMessage(r.title) : t('dialog.title')}</DialogTitle>
          <DialogDescription>
            {r && (
              <>
                {r.startPos && translateMessage(r.startPos)}
                {r.startPos && r.targetPos && ' → '}
                {r.targetPos && translateMessage(r.targetPos)}
                {(r.startPos || r.targetPos) && ' · '}
                {dateTime(r.eventTime)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {detail.isPending ? <Skeleton className="h-48" /> : r ? <ReportContent report={r} /> : null}
        {r && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ body: { ids: [r.id] } }, { onSuccess: onClose })}
            >
              <Trash2 /> {t('common:actions.delete')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
