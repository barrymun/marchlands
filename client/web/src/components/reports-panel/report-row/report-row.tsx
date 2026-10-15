import { useTranslation } from 'react-i18next';

import type { ReportSummary } from '@marchlands/api-client';

import { TableCell, TableRow } from '@/components/ui/table';
import { dateTime } from '@/lib/format';
import { translateMessage } from '@/lib/messages';
import { cn } from '@/lib/utils';

export function ReportRow({ report: r, onOpen }: { report: ReportSummary; onOpen: () => void }) {
  const { t } = useTranslation('reports-panel');
  return (
    <TableRow className={cn('cursor-pointer', !r.isRead && 'font-medium')} onClick={onOpen}>
      <TableCell className="w-4 pr-0">{!r.isRead && <span className="block size-2 rounded-full bg-primary" aria-label={t('unread')} />}</TableCell>
      <TableCell>
        <div>{translateMessage(r.title)}</div>
        {(r.startPos || r.targetPos) && (
          <div className="text-xs font-normal text-muted-foreground">
            {r.startPos && translateMessage(r.startPos)}
            {r.startPos && r.targetPos && ' → '}
            {r.targetPos && translateMessage(r.targetPos)}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right text-xs font-normal whitespace-nowrap text-muted-foreground">{dateTime(r.eventTime)}</TableCell>
    </TableRow>
  );
}
