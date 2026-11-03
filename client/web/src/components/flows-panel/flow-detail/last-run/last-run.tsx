import { useTranslation } from 'react-i18next';

import type { Flow } from '@marchlands/api-client';

import { RunReport } from '@/components/flows-panel/flow-detail/run-report/run-report';
import { ago } from '@/components/flows-panel/utils';
import { useNow } from '@/hooks/use-now';

export function LastRun({ run: r }: { run: NonNullable<Flow['lastRun']> }) {
  const { t } = useTranslation('flows-panel');
  const now = useNow(10_000);
  return (
    <RunReport
      title={
        r.finishedAt == null
          ? t('runFlow.lastRun.inProgress', { run: r.run, started: ago(now, r.startedAt) })
          : t('runFlow.lastRun.ended', { run: r.run, started: ago(now, r.startedAt), ended: ago(now, r.finishedAt) })
      }
      preview={false}
      cities={r.cities}
      skipped={r.skippedCities}
    />
  );
}
