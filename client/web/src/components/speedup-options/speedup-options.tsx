import { useTranslation } from 'react-i18next';
import { BALANCE, scaled, speedupItemGold, ItemId, SpeedupId } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { duration, fmt, fmtExact } from '@/lib/format';
import { itemName } from '@/lib/game-data';

const ITEMS = [
  ItemId.BEGINNER_GUIDELINES,
  ItemId.PRIMARY_GUIDELINES,
  ItemId.INTERMEDIATE_GUIDELINES,
  ItemId.SENIOR_GUIDELINES,
  ItemId.MASTER_GUIDELINES,
  ItemId.ULTIMATE_GUIDELINES,
] as const;

/** Each item's reduction, as its key under `effects` in the speedup-options locale files. */
const EFFECT = {
  [ItemId.BEGINNER_GUIDELINES]: 'minutes15',
  [ItemId.PRIMARY_GUIDELINES]: 'hour1',
  [ItemId.INTERMEDIATE_GUIDELINES]: 'hours2Half',
  [ItemId.SENIOR_GUIDELINES]: 'hours8',
  [ItemId.MASTER_GUIDELINES]: 'hours10To30',
  [ItemId.ULTIMATE_GUIDELINES]: 'percent30',
} as const satisfies Record<(typeof ITEMS)[number], string>;

/**
 * Speed-up choices for a running construction, demolition or research: free (last 5 minutes),
 * each Guidelines item (owned, else bought with the city's gold on use), and finishing at once for gold.
 * Item reductions are in game time, so at GAME_SPEED > 1 they shrink with the timers.
 */
export function SpeedupOptions({
  endTime,
  goldNeed,
  gold,
  pending,
  onUse,
}: {
  endTime: number;
  /** gold to finish now */
  goldNeed?: number;
  /** the city's gold, which pays */
  gold: number;
  pending: boolean;
  onUse: (itemId: string) => void;
}) {
  const { t } = useTranslation(['speedup-options', 'common']);
  const now = useNow();
  const inv = useInventory();
  const left = endTime - now;
  const free = left <= scaled(BALANCE.freeSpeedupMs);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="xs" disabled={!free || pending} onClick={() => onUse(SpeedupId.FREE)}>
          {t('finishFree')}
        </Button>
        {goldNeed != null && (
          <Button
            size="xs"
            variant="outline"
            disabled={pending || gold < goldNeed}
            title={t('common:gold', { gold: fmtExact(goldNeed) })}
            onClick={() => onUse(SpeedupId.GOLD)}
          >
            {t('finishNow', { gold: fmt(goldNeed) })}
          </Button>
        )}
      </div>
      {!free && <p className="text-xs text-muted-foreground">{t('freeIn', { time: duration(scaled(BALANCE.freeSpeedupMs)) })}</p>}
      <div className="flex flex-wrap gap-1.5">
        {ITEMS.map((id) => {
          const owned = inv.count(id);
          const price = speedupItemGold(id);
          return (
            <Button
              key={id}
              size="xs"
              variant={owned > 0 ? 'secondary' : 'outline'}
              disabled={pending || (owned === 0 && gold < price)}
              title={owned > 0 ? itemName(id) : t('boughtFor', { name: itemName(id), gold: fmtExact(price) })}
              onClick={() => onUse(id)}
            >
              {itemName(id)} ({t(`effects.${EFFECT[id]}`)}) · {owned > 0 ? `×${owned}` : t('common:gold', { gold: fmt(price) })}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
