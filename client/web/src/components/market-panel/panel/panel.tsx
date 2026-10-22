import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A pane of the trading terminal: a slim header (a title or tabs on the left, anything else on the right) over a body.
 * On a wide screen (xl) the body scrolls by itself, so the terminal keeps its shape however much a pane holds; narrower,
 * it grows to its content and only the page scrolls, so a finger on a pane never gets caught in it.
 */
export function Panel({ header, children, className, bodyClassName }: { header: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground', className)}>
      <header className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b px-2 py-1 text-xs">{header}</header>
      <div className={cn('min-h-0 flex-1 xl:overflow-auto', bodyClassName)}>{children}</div>
    </section>
  );
}
