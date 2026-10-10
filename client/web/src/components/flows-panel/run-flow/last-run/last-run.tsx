import type { Flow } from '@marchlands/api-client';
import { useNow } from '@/hooks/use-now';
import { RunReport } from '@/components/flows-panel/run-flow/run-report/run-report';
import { ago } from '@/components/flows-panel/run-flow/utils';

export function LastRun({ flow }: { flow: Flow }) {
  const now = useNow(10_000);
  const r = flow.lastRun!;
  return (
    <RunReport
      title={`Run ${r.run} · started ${ago(now, r.startedAt)}${r.finishedAt == null ? ' · in progress' : ` · ended ${ago(now, r.finishedAt)}`}`}
      preview={false}
      cities={r.cities}
      skipped={r.skippedCities}
    />
  );
}
