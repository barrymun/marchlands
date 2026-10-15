import { useTranslation } from 'react-i18next';

import type { ArmyBean } from '@marchlands/api-client';
import { ArmyDirection } from '@marchlands/core';

import { MISSION_NAMES } from '@/components/armies-panel/constants';
import { Countdown } from '@/components/countdown/countdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fmt } from '@/lib/format';
import { translateMessage } from '@/lib/messages';

export function ArmyRow({ army: a, tone, onRecall }: { army: ArmyBean; tone?: 'destructive'; onRecall?: () => void }) {
  const { t } = useTranslation(['armies-panel', 'common']);
  const total = a.troop ? Object.values(a.troop).reduce((s, n) => s + n, 0) : null;
  const status = a.direction === ArmyDirection.BACKWARD ? t('row.returning') : a.direction === ArmyDirection.STAY ? t('row.stationed') : t('row.marching');
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <Badge variant={tone ?? 'secondary'}>{MISSION_NAMES[a.missionType] ?? a.missionType}</Badge>
          <span>
            {translateMessage(a.startPosName)} → {translateMessage(a.targetPosName)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {a.king && `${a.king} · `}
          {a.hero ? t('common:level.namedParens', { name: a.hero, level: a.heroLevel }) : t('common:noHero')}
          {total != null && ` · ${t('common:troops', { count: total, n: fmt(total) })}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {status}
          {a.direction !== ArmyDirection.STAY && (
            <>
              {' '}
              · <Countdown endTime={a.reachTime} />
            </>
          )}
        </span>
        {onRecall && (
          <Button size="xs" variant="outline" onClick={onRecall}>
            {t('row.recall')}
          </Button>
        )}
      </div>
    </div>
  );
}
