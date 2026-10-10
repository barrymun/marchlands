import { Check, SkipForward, X } from 'lucide-react';
import type { FlowRunReport } from '@marchlands/api-client';
import { Badge } from '@/components/ui/badge';
import { WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { StepItems } from '@/components/flows-panel/run-flow/run-report/step-items/step-items';

export function RunReport({
  title,
  preview,
  cities,
  skipped = [],
}: {
  title: string;
  preview: boolean;
  cities: FlowRunReport['cities'];
  skipped?: FlowRunReport['skippedCities'];
}) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium text-muted-foreground uppercase">{title}</div>
      {cities.map((c) => (
        <div key={c.cityId} className={cn('grid gap-1 rounded-md border p-2 text-sm', !c.ok && 'border-destructive/50 bg-destructive/5')}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{c.cityName}</span>
            <Badge variant={c.ok ? 'secondary' : 'destructive'}>{c.ok ? (preview ? 'Would run' : 'OK') : 'Rolled back'}</Badge>
          </div>
          <ol className="grid gap-0.5 text-xs">
            {c.steps.map((s, i) => (
              <li key={i} className={cn('flex gap-1.5', !s.ok ? 'text-destructive' : s.skipped ? WARN_TEXT : 'text-muted-foreground')}>
                {!s.ok ? (
                  <X className="mt-0.5 size-3 shrink-0" />
                ) : s.skipped ? (
                  <SkipForward className="mt-0.5 size-3 shrink-0" />
                ) : (
                  <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                )}
                <div className="grid min-w-0 gap-1">
                  <span>
                    <span className="text-foreground">{s.action}:</span> {s.detail}
                  </span>
                  {s.items && s.items.length > 0 && <StepItems items={s.items} />}
                </div>
              </li>
            ))}
            {c.steps.length === 0 && <li className="text-muted-foreground">Nothing yet.</li>}
          </ol>
          {!c.ok && <p className="text-xs text-destructive">What the flow did in this city since the last wait was undone.</p>}
        </div>
      ))}
      {skipped.map((c) => (
        <div key={c.cityId} className="grid gap-1 rounded-md border border-dashed p-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-muted-foreground">{c.cityName}</span>
            <Badge variant="outline">{preview ? 'Would skip' : 'Skipped'}</Badge>
          </div>
          <p className={cn('flex gap-1.5 text-xs', WARN_TEXT)}>
            <SkipForward className="mt-0.5 size-3 shrink-0" />
            {c.reason}
          </p>
        </div>
      ))}
    </div>
  );
}
