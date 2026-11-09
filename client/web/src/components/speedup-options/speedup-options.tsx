import { useTranslation } from 'react-i18next';

import { BALANCE, ItemId, scaled, SpeedupId, speedupItemGold } from '@marchlands/core';

import { SpendGoldButton } from '@/components/spend-gold-button/spend-gold-button';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { duration, fmt, fmtExact } from '@/lib/format';
import { itemName } from '@/lib/game-data';

const ITEMS = [
  ItemId.NOVICES_NOTES,
  ItemId.APPRENTICES_NOTES,
  ItemId.JOURNEYMANS_NOTES,
  ItemId.MASTERS_NOTES,
  ItemId.GRANDMASTERS_NOTES,
  ItemId.VILLARDS_SKETCHBOOK,
] as const;

/** Each item's reduction, as its key under `effects` in the speedup-options locale files. */
const EFFECT = {
  [ItemId.NOVICES_NOTES]: 'minutes15',
  [ItemId.APPRENTICES_NOTES]: 'hour1',
  [ItemId.JOURNEYMANS_NOTES]: 'hours2Half',
  [ItemId.MASTERS_NOTES]: 'hours8',
  [ItemId.GRANDMASTERS_NOTES]: 'hours10To30',
  [ItemId.VILLARDS_SKETCHBOOK]: 'percent30',
} as const satisfies Record<(typeof ITEMS)[number], string>;

/**
 * Speed-up choices for a running construction, demolition or research: free (last 5 minutes),
 * each speed-up book (owned, else bought with the city's gold on use), and finishing at once for gold; a spend of a
 * tenth of the city's gold or more asks first (SpendGoldButton).
 * Item reductions are in game time, so at GAME_SPEED > 1 they shrink with the timers.
 */
export function SpeedupOptions({
  endTime,
  goldNeed,
  city,
  pending,
  onUse,
}: {
  endTime: number;
  /** gold to finish now */
  goldNeed?: number;
  /** the city, whose gold pays */
  city: { name: string; resource: { gold: number } };
  pending: boolean;
  onUse: (itemId: string) => void;
}) {
  const { t } = useTranslation(['speedup-options', 'common']);
  const now = useNow();
  const inv = useInventory();
  const left = endTime - now;
  const { gold } = city.resource;
  const free = left <= scaled(BALANCE.freeSpeedupMs);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="xs" disabled={!free || pending} onClick={() => onUse(SpeedupId.FREE)}>
          {t('finishFree')}
        </Button>
        {goldNeed != null && (
          <SpendGoldButton
            size="xs"
            variant="outline"
            cost={goldNeed}
            city={city}
            disabled={pending || gold < goldNeed}
            buttonTitle={t('common:gold', { gold: fmtExact(goldNeed) })}
            onSpend={() => onUse(SpeedupId.GOLD)}
          >
            {t('finishNow', { gold: fmt(goldNeed) })}
          </SpendGoldButton>
        )}
      </div>
      {!free && <p className="text-xs text-muted-foreground">{t('freeIn', { time: duration(scaled(BALANCE.freeSpeedupMs)) })}</p>}
      <div className="flex flex-wrap gap-1.5">
        {ITEMS.map((id) => {
          const owned = inv.count(id);
          const price = speedupItemGold(id);
          return (
            // one owned is used; none owned, one is bought with the city's gold
            <SpendGoldButton
              key={id}
              size="xs"
              variant={owned > 0 ? 'secondary' : 'outline'}
              cost={owned > 0 ? 0 : price}
              city={city}
              disabled={pending || (owned === 0 && gold < price)}
              buttonTitle={owned > 0 ? itemName(id) : t('boughtFor', { name: itemName(id), gold: fmtExact(price) })}
              onSpend={() => onUse(id)}
            >
              {itemName(id)} ({t(`effects.${EFFECT[id]}`)}) · {owned > 0 ? `×${owned}` : t('common:gold', { gold: fmt(price) })}
            </SpendGoldButton>
          );
        })}
      </div>
    </div>
  );
}
