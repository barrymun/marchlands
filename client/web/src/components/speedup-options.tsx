import { BALANCE, itemConfig, scaled, speedupItemCents } from '@evony/core';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { duration, fmtExact } from '@/lib/format';

const ITEMS = ['consume.2.a', 'consume.2.b', 'consume.2.b.1', 'consume.2.c', 'consume.2.c.1', 'consume.2.d'];

const EFFECT: Record<string, string> = {
  'consume.2.a': '−15 min',
  'consume.2.b': '−1 h',
  'consume.2.b.1': '−2½ h',
  'consume.2.c': '−8 h',
  'consume.2.c.1': '−10–30 h',
  'consume.2.d': '−30%',
  'player.destroy.1.a': 'finish demolition',
};

/**
 * Speed-up choices for a running construction, demolition or research: free (last 5 minutes),
 * each Guidelines item (owned, else bought with cents on use), and finishing at once for cents.
 * Item reductions are in game time, so at GAME_SPEED > 1 they shrink with the timers.
 */
export function SpeedupOptions({
  endTime,
  demolishing = false,
  coinsNeed,
  pending,
  onUse,
}: {
  endTime: number;
  demolishing?: boolean;
  coinsNeed?: number;
  pending: boolean;
  onUse: (itemId: string) => void;
}) {
  const now = useNow();
  const inv = useInventory();
  const left = endTime - now;
  const free = left <= scaled(BALANCE.freeSpeedupMs);
  const ids = demolishing ? ['player.destroy.1.a', ...ITEMS] : ITEMS;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="xs" disabled={!free || pending} onClick={() => onUse('free.speed')}>
          Finish free
        </Button>
        {coinsNeed != null && (
          <Button size="xs" variant="outline" disabled={pending || inv.cents < coinsNeed} onClick={() => onUse('coins.speed')}>
            Finish now · {fmtExact(coinsNeed)} cents
          </Button>
        )}
      </div>
      {!free && <p className="text-xs text-muted-foreground">Free in the last {duration(scaled(BALANCE.freeSpeedupMs))}.</p>}
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => {
          const owned = inv.count(id);
          const cents = id === 'player.destroy.1.a' ? 20 : speedupItemCents(id);
          return (
            <Button
              key={id}
              size="xs"
              variant={owned > 0 ? 'secondary' : 'outline'}
              disabled={pending || (owned === 0 && inv.cents < cents)}
              title={itemConfig(id)?.name}
              onClick={() => onUse(id)}
            >
              {itemConfig(id)?.name} ({EFFECT[id]}) · {owned > 0 ? `×${owned}` : `${cents} cents`}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
