import { useTranslation } from 'react-i18next';
import type { Flow } from '@marchlands/api-client';
import { useNow } from '@/hooks/use-now';
import { RunReport } from '@/components/flows-panel/run-flow/run-report/run-report';
import { ago } from '@/components/flows-panel/run-flow/utils';

export function LastRun({ flow }: { flow: Flow }) {
  const { t } = useTranslation('flows-panel');
  const now = useNow(10_000);
  const r = flow.lastRun!;
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
