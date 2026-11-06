import { useTranslation } from 'react-i18next';

import { type ReportBody, type ReportBodyKind } from '@marchlands/core';

import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';
import { ResourceList } from '@/components/reports-panel/report-dialog/report-content/resource-list/resource-list';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';

export function MovementView({ movement: m }: { movement: Extract<ReportBody, { kind: typeof ReportBodyKind.MOVEMENT }>['movement'] }) {
  const { t } = useTranslation(['reports-panel', 'common']);
  return (
    <div className="grid gap-1.5 text-sm">
      {'from' in m && <Line label={t('labels.from')}>{m.from}</Line>}
      <Line label={t('labels.hero')}>{m.hero ? t('common:level.named', { name: m.hero.name, level: m.hero.level }) : t('none')}</Line>
      <Line label={t('labels.troops')}>
        <TroopList troops={m.troops} />
      </Line>
      {'resources' in m && (
        <Line label={'heroReturned' in m ? t('labels.resources') : t('labels.broughtHome')}>
          <ResourceList res={m.resources} empty={t('common:nothing')} />
        </Line>
      )}
      {'heroReturned' in m && m.heroReturned && <p className="text-xs text-muted-foreground">{t('movement.heroReturned')}</p>}
    </div>
  );
}
