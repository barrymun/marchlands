import { cn } from '@/lib/utils';
import type { StepItem } from '@/components/flows-panel/run-flow/run-report/step-items/types';

/** Per-target outcomes; when every target was skipped for the same reason, the reason is shown once. */
export function StepItems({ items }: { items: StepItem[] }) {
  const reasons = new Set(items.map((i) => i.detail));
  if (items.length > 1 && reasons.size === 1 && !items[0].ok) {
    return (
      <div className="grid gap-1">
        <span className="text-amber-700 dark:text-amber-400">
          All {items.length} {items[0].detail}
        </span>
        <span className="flex flex-wrap gap-1">
          {items.map((i) => (
            <span key={i.label} className="rounded bg-muted px-1.5 py-px tabular-nums">
              {i.label}
            </span>
          ))}
        </span>
      </div>
    );
  }
  return (
    <ul className="grid gap-0.5">
      {items.map((i) => (
        <li key={i.label} className="flex gap-1.5">
          <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', i.ok ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden />
          <span>
            <span className="text-foreground tabular-nums">{i.label}</span> <span className={i.ok ? '' : 'text-amber-700 dark:text-amber-400'}>{i.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
