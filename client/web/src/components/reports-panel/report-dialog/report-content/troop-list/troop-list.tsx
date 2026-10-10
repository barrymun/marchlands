import { fmtExact } from '@/lib/format';
import { troopLabel } from '@/components/reports-panel/report-dialog/report-content/utils';

export function TroopList({ troops, empty = 'None' }: { troops: Record<string, number | undefined>; empty?: string }) {
  const entries = Object.entries(troops).filter(([, n]) => (n ?? 0) > 0);
  if (!entries.length) return <span className="text-muted-foreground">{empty}</span>;
  return <span className="tabular-nums">{entries.map(([k, n]) => `${fmtExact(n ?? 0)} ${troopLabel(k)}`).join(' · ')}</span>;
}
