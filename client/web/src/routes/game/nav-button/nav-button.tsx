import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** A menu entry: an icon with its name under it, marked while its screen or panel is showing, with an optional count. */
export function NavButton({
  icon: Icon,
  label,
  active,
  count,
  onClick,
  className,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[11px] transition hover:bg-muted',
        active ? 'text-foreground' : 'text-muted-foreground',
        active && 'bg-muted',
        className,
      )}
      onClick={onClick}
    >
      <Icon className="size-5" />
      <span className="whitespace-nowrap">{label}</span>
      {!!count && <Badge className="absolute -top-0.5 end-1 h-4 min-w-4 px-1 text-[10px] tabular-nums">{count}</Badge>}
    </button>
  );
}
