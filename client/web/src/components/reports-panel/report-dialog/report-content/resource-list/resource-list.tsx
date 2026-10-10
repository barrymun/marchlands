import { fmtExact } from '@/lib/format';
import { RES_LABEL } from '@/components/reports-panel/report-dialog/report-content/constants';

export function ResourceList({ res, empty = 'None' }: { res: Record<string, number | undefined>; empty?: string }) {
  const entries = Object.entries(res).filter(([, n]) => (n ?? 0) > 0);
  if (!entries.length) return <span className="text-muted-foreground">{empty}</span>;
  return <span className="tabular-nums">{entries.map(([k, n]) => `${fmtExact(n ?? 0)} ${RES_LABEL[k] ?? k}`).join(' · ')}</span>;
}
