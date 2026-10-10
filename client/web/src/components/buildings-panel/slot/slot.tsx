import { Plus } from 'lucide-react';
import type { BuildingBean } from '@marchlands/api-client';
import { Countdown } from '@/components/countdown/countdown';
import { cn } from '@/lib/utils';

export function Slot({
  pos,
  building,
  locked,
  fixedName,
  onClick,
}: {
  pos: number;
  building?: BuildingBean;
  locked?: boolean;
  fixedName?: string;
  onClick: () => void;
}) {
  if (locked) return <div className="h-16 rounded-md border border-dashed opacity-40" />;
  if (!building || building.typeId === 0) {
    return (
      <button
        onClick={onClick}
        className="flex h-16 items-center justify-center rounded-md border border-dashed text-muted-foreground transition hover:bg-muted"
        aria-label={`Build at slot ${pos}`}
      >
        {fixedName ?? <Plus className="size-4" />}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-16 flex-col items-start justify-between rounded-md border p-2 text-left transition hover:bg-muted',
        building.status !== 0 && 'border-amber-500',
      )}
    >
      <span className="line-clamp-1 text-xs font-medium">{building.name}</span>
      <span className="flex w-full items-center justify-between text-xs text-muted-foreground">
        Lv {building.level}
        {building.status !== 0 && (
          <span className="text-amber-600">
            <Countdown endTime={building.endTime} />
          </span>
        )}
      </span>
    </button>
  );
}
