import { Plus, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WARN_MS } from '@/components/active-effects/constants';
import type { Buff, Extension, Slot } from '@/components/active-effects/types';
import { adds, itemName } from '@/components/active-effects/utils';
import { duration, fmt, fmtExact, shortDuration } from '@/lib/format';
import { ITEM_BONUS_TEXT, WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/active-effects/slot-cell/icon-button/icon-button';

export function SlotCell({
  slot,
  active,
  now,
  extension,
  busy,
  onExtend,
  onFind,
}: {
  slot: Slot;
  active?: Buff;
  now: number;
  extension: Extension;
  busy: boolean;
  onExtend: (slot: Slot, ext: NonNullable<Extension>) => void;
  onFind: () => void;
}) {
  if (!active) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-dashed py-0.5 pr-0.5 pl-2 text-xs text-muted-foreground">
        <span className="truncate">{slot.label}</span>
        <span className="ml-auto">off</span>
        <IconButton label="Find items" detail={`Show the items that give ${slot.label.toLowerCase()} ${slot.boost}`} onClick={onFind}>
          <Search />
        </IconButton>
      </div>
    );
  }
  const left = active.endTime - now;
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md border py-0.5 pr-0.5 pl-2 text-xs">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-muted-foreground">{slot.label}</span>
            <span className={cn('font-medium', ITEM_BONUS_TEXT)}>{slot.boost}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {active.itemId ? `${itemName(active.itemId)}: ` : ''}
          {active.desc} · {duration(left)} left
        </TooltipContent>
      </Tooltip>
      <span className={cn('ml-auto whitespace-nowrap tabular-nums', left < WARN_MS ? cn('font-medium', WARN_TEXT) : 'text-muted-foreground')}>
        {shortDuration(left)}
      </span>
      {extension ? (
        <IconButton
          label="Extend"
          detail={
            extension.kind === 'use'
              ? `Use a ${itemName(extension.itemId)} (×${fmtExact(extension.owned)} owned): +${adds(extension.itemId)}`
              : `Buy a ${itemName(extension.itemId)} for ${fmt(extension.price)} gold and use it: +${adds(extension.itemId)}`
          }
          disabled={busy}
          onClick={() => onExtend(slot, extension)}
        >
          <Plus />
        </IconButton>
      ) : (
        <span className="size-6 shrink-0" />
      )}
    </div>
  );
}
