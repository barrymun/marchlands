import type { Flow } from '@marchlands/api-client';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';
import { RunReport } from '@/components/flows-panel/run-flow/run-report/run-report';

export function LastRun({ flow }: { flow: Flow }) {
  const now = useNow(10_000);
  const r = flow.lastRun!;
  const when = (t: number) => (now - t < 60_000 ? 'just now' : `${duration(now - t).split(' ')[0]} ago`);
  return (
    <RunReport
      title={`Run ${r.run} · started ${when(r.startedAt)}${r.finishedAt == null ? ' · in progress' : ` · ended ${when(r.finishedAt)}`}`}
      preview={false}
      cities={r.cities}
      skipped={r.skippedCities}
    />
  );
}
