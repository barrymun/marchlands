// The lord's running item bonuses as fixed slots, grouped like the shop: every bonus has its place,
// so a missing one shows as a gap. A slot's timer turns amber in its last day, and its + button extends it.

import { useState } from 'react';
import {
  getCitiesByCityIdQueryKey,
  getPlayerQueryKey,
  postCitiesShopGold,
  postPlayerItemsUse,
  postPlayerItemsUseMutation,
  type CityBean,
} from '@marchlands/api-client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/confirm-dialog/confirm-dialog';
import { GROUPS, OTHER_LABELS, SLOT_BUFFS, STORE_KEY, WARN_MS } from '@/components/active-effects/constants';
import type { Buff, Extension, Slot } from '@/components/active-effects/types';
import { adds, extensionFor, itemName, readCollapsed, slotItems } from '@/components/active-effects/utils';
import { useCommand } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { fmt, fmtExact, shortDuration } from '@/lib/format';
import { WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { SlotCell } from '@/components/active-effects/slot-cell/slot-cell';

export function ActiveEffects({
  city,
  buffs,
  counts,
  onFind,
}: {
  city: CityBean;
  buffs: Buff[];
  counts: Map<string, number>;
  /** show the items that give a bonus in the list below */
  onFind: (label: string, itemIds: string[]) => void;
}) {
  const now = useNow();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [buying, setBuying] = useState<{ slot: Slot; itemId: string; price: number } | null>(null);
  const running = buffs.filter((b) => b.endTime > now);
  const bySlot = new Map(running.filter((b) => SLOT_BUFFS.has(b.id)).map((b) => [b.id, b]));
  const others = running.filter((b) => !SLOT_BUFFS.has(b.id));
  const expiring = [...bySlot.values()].filter((b) => b.endTime - now < WARN_MS).length;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORE_KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable: the choice lasts until reload */
    }
  };

  const refresh = () => [getPlayerQueryKey(), getCitiesByCityIdQueryKey({ path: { cityId: city.id } })];
  const use = useCommand(postPlayerItemsUseMutation(), refresh);
  const buyAndUse = useCommand(async (itemId: string) => {
    await postCitiesShopGold({ path: { cityId: city.id }, body: { itemId, amount: 1 }, throwOnError: true });
    const { data } = await postPlayerItemsUse({ path: { itemId }, body: { cityId: city.id }, throwOnError: true });
    return data;
  }, refresh);

  function extend(slot: Slot, ext: NonNullable<Extension>) {
    if (ext.kind === 'buy') return setBuying({ slot, itemId: ext.itemId, price: ext.price });
    use.mutate(
      { path: { itemId: ext.itemId }, body: { cityId: city.id } },
      { onSuccess: () => toast.success(`${slot.label} extended by ${adds(ext.itemId)}`) },
    );
  }

  return (
    <Card className="gap-0 py-3">
      <CardHeader className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-6">
        <span className="text-sm font-medium">Active effects</span>
        <span className="text-xs text-muted-foreground">{bySlot.size} active</span>
        {expiring > 0 && <span className={cn('text-xs', WARN_TEXT)}>{expiring} expiring within 24h</span>}
        <Button variant="ghost" size="xs" className="ml-auto text-muted-foreground" onClick={toggle} aria-expanded={!collapsed}>
          {collapsed ? 'Show' : 'Hide'}
          {collapsed ? <ChevronDown /> : <ChevronUp />}
        </Button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="grid gap-1.5 px-4 pt-2 sm:px-6">
          {GROUPS.map((g) => (
            <div key={g.label} className="grid grid-cols-2 items-center gap-1.5 sm:grid-cols-3 lg:grid-cols-[4.5rem_repeat(5,minmax(0,1fr))]">
              <span className="col-span-full text-xs text-muted-foreground lg:col-span-1">{g.label}</span>
              {g.slots.map((slot) => (
                <SlotCell
                  key={slot.buff}
                  slot={slot}
                  active={bySlot.get(slot.buff)}
                  now={now}
                  extension={extensionFor(slot, bySlot.get(slot.buff), counts)}
                  busy={use.isPending || buyAndUse.isPending}
                  onExtend={extend}
                  onFind={() => onFind(slot.label, slotItems(slot))}
                />
              ))}
            </div>
          ))}
          {others.length > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {others.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && ' · '}
                  {OTHER_LABELS[b.id] ?? b.desc} {shortDuration(b.endTime - now)}
                </span>
              ))}
            </p>
          )}
        </CardContent>
      )}
      <ConfirmDialog
        open={buying != null}
        onOpenChange={(o) => !o && setBuying(null)}
        destructive={false}
        title={buying ? `Extend ${buying.slot.label}?` : ''}
        description={
          buying &&
          `You have no ${itemName(buying.itemId)}. Buy one for ${fmtExact(buying.price)} gold from ${city.name} and use it now, adding ${adds(buying.itemId)}.`
        }
        confirmLabel={buying ? `Buy and use · ${fmt(buying.price)} gold` : ''}
        onConfirm={() => buying && buyAndUse.mutateAsync(buying.itemId).then(() => toast.success(`${buying.slot.label} extended by ${adds(buying.itemId)}`))}
      />
    </Card>
  );
}
