import { fmt, fmtExact } from '@/lib/format';

export function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-medium tabular-nums" title={fmtExact(value)}>
        {fmt(value)}
      </div>
    </div>
  );
}
