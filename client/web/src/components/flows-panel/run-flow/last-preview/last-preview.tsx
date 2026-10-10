import type { Flow } from '@marchlands/api-client';
import { useNow } from '@/hooks/use-now';
import { RunReport } from '@/components/flows-panel/run-flow/run-report/run-report';
import { ago } from '@/components/flows-panel/run-flow/utils';

/** The flow's latest preview, kept on the server until the flow runs, is edited or repeat is switched. */
export function LastPreview({ flow }: { flow: Flow }) {
  const now = useNow(10_000);
  const p = flow.lastPreview!;
  return <RunReport title={`Preview · ${ago(now, p.at)} (nothing was changed)`} preview cities={p.cities} skipped={p.skippedCities} />;
}
