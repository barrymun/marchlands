import { BALANCE, itemConfig, scaled, speedupItemGold } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { duration, fmt, fmtExact } from '@/lib/format';

const ITEMS = ['consume.2.a', 'consume.2.b', 'consume.2.b.1', 'consume.2.c', 'consume.2.c.1', 'consume.2.d'];

const EFFECT: Record<string, string> = {
  'consume.2.a': '−15 min',
  'consume.2.b': '−1 h',
  'consume.2.b.1': '−2½ h',
  'consume.2.c': '−8 h',
  'consume.2.c.1': '−10–30 h',
  'consume.2.d': '−30%',
};

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
  const now = useNow();
  const inv = useInventory();
  const left = endTime - now;
  const free = left <= scaled(BALANCE.freeSpeedupMs);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="xs" disabled={!free || pending} onClick={() => onUse('free.speed')}>
          Finish free
        </Button>
        {goldNeed != null && (
          <Button size="xs" variant="outline" disabled={pending || gold < goldNeed} title={`${fmtExact(goldNeed)} gold`} onClick={() => onUse('gold.speed')}>
            Finish now · {fmt(goldNeed)} gold
          </Button>
        )}
      </div>
      {!free && <p className="text-xs text-muted-foreground">Free in the last {duration(scaled(BALANCE.freeSpeedupMs))}.</p>}
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
              title={owned > 0 ? itemConfig(id)?.name : `${itemConfig(id)?.name}: bought for ${fmtExact(price)} gold`}
              onClick={() => onUse(id)}
            >
              {itemConfig(id)?.name} ({EFFECT[id]}) · {owned > 0 ? `×${owned}` : `${fmt(price)} gold`}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
