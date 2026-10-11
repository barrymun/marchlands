import { useTranslation } from 'react-i18next';
import type { Flow } from '@marchlands/api-client';
import { useNow } from '@/hooks/use-now';
import { RunReport } from '@/components/flows-panel/run-flow/run-report/run-report';
import { ago } from '@/components/flows-panel/run-flow/utils';

/** The flow's latest preview, kept on the server until the flow runs, is edited or repeat is switched. */
export function LastPreview({ flow }: { flow: Flow }) {
  const { t } = useTranslation('flows-panel');
  const now = useNow(10_000);
  const p = flow.lastPreview!;
  return <RunReport title={t('runFlow.lastPreview', { ago: ago(now, p.at) })} preview cities={p.cities} skipped={p.skippedCities} />;
}
