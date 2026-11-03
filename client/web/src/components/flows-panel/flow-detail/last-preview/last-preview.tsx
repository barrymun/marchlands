import { useTranslation } from 'react-i18next';

import type { Flow } from '@marchlands/api-client';

import { RunReport } from '@/components/flows-panel/flow-detail/run-report/run-report';
import { ago } from '@/components/flows-panel/utils';
import { useNow } from '@/hooks/use-now';

/** The flow's latest preview, kept on the server until the flow runs, is edited or repeat is switched. */
export function LastPreview({ preview: p }: { preview: NonNullable<Flow['lastPreview']> }) {
  const { t } = useTranslation('flows-panel');
  const now = useNow(10_000);
  return <RunReport title={t('runFlow.lastPreview', { ago: ago(now, p.at) })} preview cities={p.cities} skipped={p.skippedCities} />;
}
