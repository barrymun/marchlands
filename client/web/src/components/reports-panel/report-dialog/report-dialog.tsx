import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommand } from '@/hooks/use-game';
import { useSticky } from '@/hooks/use-sticky';
import { api, unwrap } from '@/lib/api';
import { rk } from '@/components/reports-panel/constants';
import { ReportContent } from '@/components/reports-panel/report-dialog/report-content/report-content';

export function ReportDialog({ reportId, onClose }: { reportId: number | null; onClose: () => void }) {
  const id = useSticky(reportId);
  const detail = useQuery({
    queryKey: rk.detail(id ?? 0),
    enabled: id != null,
    queryFn: () => unwrap(api.GET('/api/v1/reports/{reportId}', { params: { path: { reportId: id! } } })),
  });
  const remove = useCommand(
    (reportId: number) => unwrap(api.POST('/api/v1/reports/delete', { body: { ids: [reportId] } })),
    () => [['reports']],
    'Report deleted',
  );
  // opening a report marks it read on the server: refresh the list and the unread counters
  const qc = useQueryClient();
  const loadedId = detail.data?.id;
  useEffect(() => {
    if (loadedId == null) return;
    void qc.invalidateQueries({ queryKey: ['reports', 'list'] });
    void qc.invalidateQueries({ queryKey: rk.unread });
  }, [loadedId, qc]);
  const r = detail.data;
  return (
    <Dialog open={reportId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{r?.title ?? 'Report'}</DialogTitle>
          <DialogDescription>
            {r && (
              <>
                {r.startPos}
                {r.startPos && r.targetPos && ' → '}
                {r.targetPos}
                {(r.startPos || r.targetPos) && ' · '}
                {new Date(r.eventTime).toLocaleString()}
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
              onClick={() => remove.mutate(r.id, { onSuccess: onClose })}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
