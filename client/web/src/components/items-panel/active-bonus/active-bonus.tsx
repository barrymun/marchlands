import { itemConfig, itemEffect, type BuffId } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { Countdown } from '@/components/countdown/countdown';
import { useNow } from '@/hooks/use-now';
import { ITEM_BONUS_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * For an item that applies a timed bonus (a buff on the lord): whether that bonus is running now and
 * for how long. Items sharing a bonus (e.g. the 1-day and 7-day production items) extend the same one:
 * the item last used shows it as active, the others which item is running and what using them adds.
 */
export function ActiveBonus({ ids, buffs }: { ids: string[]; buffs: { id: BuffId; endTime: number; itemId?: string }[] }) {
  const now = useNow(30_000);
  const effect = ids.map(itemEffect).find((e) => e?.kind === 'buff');
  if (effect?.kind !== 'buff') return null;
  const active = buffs.find((b) => b.id === effect.buff && b.endTime > now);
  if (!active) return null;
  if (active.itemId && ids.includes(active.itemId)) {
    return (
      <Badge className={cn('gap-1 tabular-nums', ITEM_BONUS_TONE)} title="This bonus is running now; using another extends it">
        Active · <Countdown endTime={active.endTime} />
      </Badge>
    );
  }
  // the same bonus, set by another item (or before the item was recorded): plain text, so this card does not read as active
  const source = active.itemId ? itemConfig(active.itemId)?.name.trim() : null;
  const days = effect.durationMs / 86_400_000;
  const adds = days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.round(effect.durationMs / 3_600_000)} hours`;
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      Same bonus already running{source ? ` from ${source}` : ''} (<Countdown endTime={active.endTime} /> left); using this adds {adds}.
    </p>
  );
}
