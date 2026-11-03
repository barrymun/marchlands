import type { Flow } from '@marchlands/api-client';
import { flowActionMessage } from '@marchlands/core';

import { ACTION_ICON } from '@/components/flows-panel/flow-detail/step-timeline/constants';
import { currentAction } from '@/components/flows-panel/utils';
import { translateMessage } from '@/lib/messages';
import { cn } from '@/lib/utils';

/** The flow's actions down a line, each with its kind's icon; the one it is on now lit. */
export function StepTimeline({ flow }: { flow: Flow }) {
  const at = currentAction(flow);
  return (
    <ol className="relative grid gap-3 before:absolute before:inset-y-3 before:start-3 before:w-px before:bg-border">
      {flow.actions.map((a, i) => {
        const Icon = ACTION_ICON[a.type];
        const current = i === at;
        return (
          <li key={i} className="relative flex items-start gap-3 text-sm">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground',
                current && 'border-primary bg-primary text-primary-foreground',
              )}
              aria-hidden
            >
              <Icon className="size-3.5" />
            </span>
            <span className={cn('min-w-0 pt-0.5', current && 'font-medium')}>
              <span className="sr-only">{i + 1}. </span>
              {translateMessage(flowActionMessage(a))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
