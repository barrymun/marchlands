import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Small tabs for a panel's header, switching what its body shows. */
export function PanelTabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
}: {
  /** what the tabs choose between, for screen readers */
  label: string;
  value: T;
  onChange: (value: T) => void;
  tabs: readonly { id: T; label: ReactNode }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap items-center gap-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-2 py-1 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
            tab.id === value && 'bg-muted text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
