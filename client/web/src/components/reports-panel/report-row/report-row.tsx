import { useTranslation } from 'react-i18next';

import type { ReportSummary } from '@marchlands/api-client';

import { TableCell, TableRow } from '@/components/ui/table';
import { dateTime } from '@/lib/format';
import { translateMessage } from '@/lib/messages';
import { cn } from '@/lib/utils';

/** One report: from `md` its places get a column each, below that they go under its title. */
export function ReportRow({ report: r, onOpen }: { report: ReportSummary; onOpen: () => void }) {
  const { t } = useTranslation('reports-panel');
  const from = r.startPos && translateMessage(r.startPos);
  const to = r.targetPos && translateMessage(r.targetPos);
  return (
    <TableRow className={cn('cursor-pointer', !r.isRead && 'font-medium')} onClick={onOpen}>
      <TableCell className="w-4 pe-0">{!r.isRead && <span className="block size-2 rounded-full bg-primary" aria-label={t('unread')} />}</TableCell>
      <TableCell>
        <div>{translateMessage(r.title)}</div>
        {(from || to) && (
          <div className="text-xs font-normal text-muted-foreground md:hidden">
            {from}
            {from && to && ' → '}
            {to}
          </div>
        )}
      </TableCell>
      <TableCell className="hidden text-sm font-normal text-muted-foreground md:table-cell">{from}</TableCell>
      <TableCell className="hidden text-sm font-normal text-muted-foreground md:table-cell">{to}</TableCell>
      <TableCell className="text-end text-xs font-normal whitespace-nowrap text-muted-foreground tabular-nums">{dateTime(r.eventTime)}</TableCell>
    </TableRow>
  );
}
