import { useTranslation } from 'react-i18next';
import { troopLabel } from '@/components/reports-panel/report-dialog/report-content/utils';
import { fmtExact } from '@/lib/format';

export function TroopList({ troops, empty }: { troops: Record<string, number | undefined>; empty?: string }) {
  const { t } = useTranslation('common');
  const entries = Object.entries(troops).filter(([, n]) => (n ?? 0) > 0);
  if (!entries.length) return <span className="text-muted-foreground">{empty ?? t('actions.none')}</span>;
  return <span className="tabular-nums">{entries.map(([k, n]) => `${fmtExact(n ?? 0)} ${troopLabel(k)}`).join(' · ')}</span>;
}
