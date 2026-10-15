import { useTranslation } from 'react-i18next';
import { resourceKeyLabel } from '@/components/reports-panel/report-dialog/report-content/utils';
import { fmtExact } from '@/lib/format';

export function ResourceList({ res, empty }: { res: Record<string, number | undefined>; empty?: string }) {
  const { t } = useTranslation('common');
  const entries = Object.entries(res).filter(([, n]) => (n ?? 0) > 0);
  if (!entries.length) return <span className="text-muted-foreground">{empty ?? t('actions.none')}</span>;
  return <span className="tabular-nums">{entries.map(([k, n]) => `${fmtExact(n ?? 0)} ${resourceKeyLabel(k)}`).join(' · ')}</span>;
}
