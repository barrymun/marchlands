import { useTranslation } from 'react-i18next';

import { BuffId } from '@marchlands/core';

import { usePlayer } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { duration, percent } from '@/lib/format';
import { ITEM_BONUS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** A Marshal's Seal or Charter's discount on troop training, while it runs. */
export function TrainDiscountHint({ share }: { share: number }) {
  const { t } = useTranslation('military-panel');
  const player = usePlayer();
  const now = useNow(30_000);
  const end = (player.data?.buffs ?? []).find((b) => b.id === BuffId.TRAIN_COST_REDUCE)?.endTime ?? 0;
  const cut = percent(1 - share);
  return (
    <p className={cn('text-xs', ITEM_BONUS_TEXT)}>
      {end > now ? t('trainDiscount.timed', { percent: cut, time: duration(end - now) }) : t('trainDiscount.active', { percent: cut })}
    </p>
  );
}
