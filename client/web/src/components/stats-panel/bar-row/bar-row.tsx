import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A label and its number over a horizontal bar the card's width, so it reads at any width: one or more segments, each a
 * share (0 to 1) of the whole track, a 2px gap between them; `tip` (the exact numbers) shows on hover and focus.
 */
export function BarRow({
  label,
  value,
  segments,
  tip,
  muted,
}: {
  label: ReactNode;
  value: number;
  segments: { share: number; className: string }[];
  tip?: ReactNode;
  muted?: boolean;
}) {
  const row = (
    <div className={cn('grid w-full gap-1 rounded-sm px-1 py-1.5 text-start text-sm', muted && 'text-muted-foreground', tip && 'hover:bg-muted/50')}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">{fmt(value)}</span>
      </span>
      {segments.length > 0 && (
        <span className="flex h-2 gap-0.5" aria-hidden>
          {segments
            .filter((s) => s.share > 0)
            .map((s, i, all) => (
              <span
                key={i}
                className={cn('h-full min-w-0.5', i === 0 && 'rounded-s-sm', i === all.length - 1 && 'rounded-e-sm', s.className)}
                style={{ width: `${s.share * 100}%` }}
              />
            ))}
        </span>
      )}
    </div>
  );
  if (!tip) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {row}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tip}</TooltipContent>
    </Tooltip>
  );
}
