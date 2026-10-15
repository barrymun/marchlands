import { Trans, useTranslation } from 'react-i18next';

import { getGameSpeed, type ReportBody } from '@marchlands/core';

import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';
import { dateTime, signedRate } from '@/lib/format';
import { cn } from '@/lib/utils';

export function DesertionView({ desertion: d }: { desertion: Extract<ReportBody, { kind: 'desertion' }>['desertion'] }) {
  const { t } = useTranslation('reports-panel');
  const perHour = (n: number) => signedRate(n);
  return (
    <div className="grid gap-1.5 text-sm">
      <p>
        {t('desertion.intro', {
          city: d.city,
          gameHour: getGameSpeed() === 1 ? t('desertion.gameHourReal') : t('desertion.gameHourScaled', { speed: getGameSpeed() }),
        })}
      </p>
      <Line label={t('labels.deserted')}>
        <TroopList troops={d.troops} />
      </Line>
      <Line label={t('labels.between')}>{t('desertion.between', { from: dateTime(d.from), to: dateTime(d.to) })}</Line>
      <Line label={t('labels.food')}>
        <Trans
          t={t}
          i18nKey="desertion.food"
          values={{ produced: perHour(d.food.production), upkeep: signedRate(-d.food.upkeep), net: perHour(d.food.net) }}
          components={{ net: <span className={cn('font-medium', d.food.net < 0 && 'text-destructive')} /> }}
        />
      </Line>
      {d.food.net < 0 && <p className="text-xs text-muted-foreground">{t('desertion.stillRunningOut')}</p>}
    </div>
  );
}
