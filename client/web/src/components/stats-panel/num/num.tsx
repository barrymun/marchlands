import { TableCell } from '@/components/ui/table';
import { fmt, fmtExact } from '@/lib/format';

export function Num({ v }: { v?: number }) {
  return (
    <TableCell className="text-right tabular-nums" title={v ? fmtExact(v) : undefined}>
      {v ? fmt(v) : <span className="text-muted-foreground">—</span>}
    </TableCell>
  );
}
