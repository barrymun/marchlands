import { Trans, useTranslation } from 'react-i18next';

import { type BuffId, itemEffect, ItemEffectKind } from '@marchlands/core';

import { Countdown } from '@/components/countdown/countdown';
import { Badge } from '@/components/ui/badge';
import { useNow } from '@/hooks/use-now';
import { itemName } from '@/lib/game-data';
import { ITEM_BONUS_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * For an item that applies a timed bonus (a buff on the lord): whether that bonus is running now and
 * for how long. Items sharing a bonus (e.g. the 1-day and 7-day production items) extend the same one:
 * the item last used shows it as active, the others which item is running and what using them adds.
 */
export function ActiveBonus({ ids, buffs }: { ids: string[]; buffs: { id: BuffId; endTime: number; itemId?: string }[] }) {
  const { t } = useTranslation(['items-panel', 'common']);
  const now = useNow(30_000);
  const effect = ids.map(itemEffect).find((e) => e?.kind === ItemEffectKind.BUFF);
  if (effect?.kind !== ItemEffectKind.BUFF) return null;
  const active = buffs.find((b) => b.id === effect.buff && b.endTime > now);
  if (!active) return null;
  if (active.itemId && ids.includes(active.itemId)) {
    return (
      <Badge className={cn('gap-1 tabular-nums', ITEM_BONUS_TONE)} title={t('activeBonus.runningHint')}>
        <Trans t={t} i18nKey="activeBonus.active" components={{ countdown: <Countdown endTime={active.endTime} /> }} />
      </Badge>
    );
  }
  // the same bonus, set by another item (or before the item was recorded): plain text, so this card does not read as active
  const source = active.itemId ? itemName(active.itemId) : null;
  const days = effect.durationMs / 86_400_000;
  const adds = days >= 1 ? t('common:durations.days', { count: days }) : t('common:durations.hours', { count: Math.round(effect.durationMs / 3_600_000) });
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      <Trans
        t={t}
        i18nKey={source ? 'activeBonus.sameBonusFrom' : 'activeBonus.sameBonus'}
        values={{ source, adds }}
        components={{ countdown: <Countdown endTime={active.endTime} /> }}
      />
    </p>
  );
}
