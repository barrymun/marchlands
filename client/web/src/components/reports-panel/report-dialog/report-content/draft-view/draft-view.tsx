import { useTranslation } from 'react-i18next';

import type { ReportBody } from '@marchlands/core';

import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';
import { translateMessage } from '@/lib/messages';

/** Troops a held historic city drafted from a barbarian city, by itself or as its holder chose. */
export function DraftView({ draft: d }: { draft: Extract<ReportBody, { kind: 'draft' }>['draft'] }) {
  const { t } = useTranslation('reports-panel');
  return (
    <div className="grid gap-1.5 text-sm">
      <p>
        {d.auto
          ? d.scouted > 0
            ? t('draft.autoScouted', { city: d.city, count: d.scouted })
            : t('draft.auto', { city: d.city })
          : t('draft.manual', { city: d.city })}
      </p>
      <Line label={t('labels.target')}>{translateMessage(d.target)}</Line>
      <Line label={t('labels.drafted')}>
        <TroopList troops={d.troops} />
      </Line>
    </div>
  );
}
