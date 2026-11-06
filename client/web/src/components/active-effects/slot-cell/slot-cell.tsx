import { Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ExtensionKind, WARN_MS } from '@/components/active-effects/constants';
import { IconButton } from '@/components/active-effects/slot-cell/icon-button/icon-button';
import type { Buff, Extension, Slot } from '@/components/active-effects/types';
import { adds } from '@/components/active-effects/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { duration, fmt, fmtExact, shortDuration } from '@/lib/format';
import { itemName } from '@/lib/game-data';
import { translateMessage } from '@/lib/messages';
import { ITEM_BONUS_TEXT, WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

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
  const { t } = useTranslation('active-effects');
  if (!active) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-dashed py-0.5 pe-0.5 ps-2 text-xs text-muted-foreground">
        <span className="truncate">{slot.label}</span>
        <span className="ms-auto">{t('slotCell.off')}</span>
        <IconButton label={t('slotCell.find')} detail={t('slotCell.findDetail', { label: slot.label.toLowerCase(), boost: slot.boost })} onClick={onFind}>
          <Search />
        </IconButton>
      </div>
    );
  }
  const left = active.endTime - now;
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md border py-0.5 pe-0.5 ps-2 text-xs">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-muted-foreground">{slot.label}</span>
            <span className={cn('font-medium', ITEM_BONUS_TEXT)}>{slot.boost}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {active.itemId
            ? t('slotCell.runningItem', { item: itemName(active.itemId), desc: translateMessage(active.desc), time: duration(left) })
            : t('slotCell.running', { desc: translateMessage(active.desc), time: duration(left) })}
        </TooltipContent>
      </Tooltip>
      <span className={cn('ms-auto whitespace-nowrap tabular-nums', left < WARN_MS ? cn('font-medium', WARN_TEXT) : 'text-muted-foreground')}>
        {shortDuration(left)}
      </span>
      {extension ? (
        <IconButton
          label={t('slotCell.extend')}
          detail={
            extension.kind === ExtensionKind.USE
              ? t('slotCell.useDetail', { item: itemName(extension.itemId), owned: fmtExact(extension.owned), adds: adds(extension.itemId) })
              : t('slotCell.buyDetail', { item: itemName(extension.itemId), price: fmt(extension.price), adds: adds(extension.itemId) })
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
