import type { ReportSummary } from '@marchlands/api-client';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export function ReportRow({ report: r, onOpen }: { report: ReportSummary; onOpen: () => void }) {
  return (
    <TableRow className={cn('cursor-pointer', !r.isRead && 'font-medium')} onClick={onOpen}>
      <TableCell className="w-4 pr-0">{!r.isRead && <span className="block size-2 rounded-full bg-primary" aria-label="unread" />}</TableCell>
      <TableCell>
        <div>{r.title}</div>
        {(r.startPos || r.targetPos) && (
          <div className="text-xs font-normal text-muted-foreground">
            {r.startPos}
            {r.startPos && r.targetPos && ' → '}
            {r.targetPos}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right text-xs font-normal whitespace-nowrap text-muted-foreground">{new Date(r.eventTime).toLocaleString()}</TableCell>
    </TableRow>
  );
}
