import type { Job } from '@/components/activity-dock/types';
import { Progress } from '@/components/ui/progress';
import { duration } from '@/lib/format';

export function JobRow({ job, now }: { job: Job; now: number }) {
  const total = job.endTime - job.startTime;
  const pct = total > 0 ? Math.min(100, Math.max(0, ((now - job.startTime) / total) * 100)) : 100;
  const left = job.endTime - now;
  return (
    <button
      type="button"
      onClick={job.open}
      className="grid animate-in gap-1 rounded-md px-1.5 py-1 text-left duration-300 fade-in slide-in-from-left-2 hover:bg-foreground/5"
    >
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">
          {job.label}
          {job.note && <span className="text-muted-foreground"> · {job.note}</span>}
        </span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{left > 0 ? duration(left) : 'finishing…'}</span>
      </span>
      <Progress value={pct} className="h-1" />
    </button>
  );
}
