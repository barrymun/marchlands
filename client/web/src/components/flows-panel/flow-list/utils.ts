import type { Flow } from '@marchlands/api-client';

/** The flow's last run for its row: its number, whether every city got through, and when it ended (or started, if still going). */
export function lastRunSummary(f: Pick<Flow, 'lastRun'>): { run: number; ok: boolean; at: number } | null {
  const r = f.lastRun;
  if (!r) return null;
  return { run: r.run, ok: r.cities.every((c) => c.ok), at: r.finishedAt ?? r.startedAt };
}
