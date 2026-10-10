import { BuffId } from '@marchlands/core';
import { usePlayer } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';
import { ITEM_BONUS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** A Quartermaster item's discount on troop training, while it runs. */
export function TrainDiscountHint({ share }: { share: number }) {
  const player = usePlayer();
  const now = useNow(30_000);
  const end = (player.data?.buffs ?? []).find((b) => b.id === BuffId.TRAIN_COST_REDUCE)?.endTime ?? 0;
  return (
    <p className={cn('text-xs', ITEM_BONUS_TEXT)}>
      Training cost −{Math.round((1 - share) * 100)}% (Quartermaster){end > now ? ` for ${duration(end - now)}` : ''}: the costs below include it.
    </p>
  );
}
