import type { ReactNode } from 'react';
import { fmt, fmtExact } from '@/lib/format';

/** A headline number: what it counts, the number (exact in its title), and a line about it. */
export function StatTile({ label, value, sub }: { label: string; value: number; sub?: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-xl border bg-card p-3 text-card-foreground">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums" title={fmtExact(value)}>
        {fmt(value)}
      </div>
      <div className="truncate text-xs text-muted-foreground">{sub ?? ' '}</div>
    </div>
  );
}
