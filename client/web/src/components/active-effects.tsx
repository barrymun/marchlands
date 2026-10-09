// The lord's running item bonuses as fixed slots, grouped like the shop: every bonus has its place,
// so a missing one shows as a gap. A slot's timer turns amber in its last day, and its + button extends it.

import { useState, type ReactNode } from 'react';
import type { CityBean } from '@marchlands/api-client';
import { BALANCE, ITEM_INFO, itemConfig, itemEffect, itemGoldPrice } from '@marchlands/core';
import { ChevronDown, ChevronUp, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { qk, useCommand } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { api, unwrap } from '@/lib/api';
import { duration, fmt, fmtExact, shortDuration } from '@/lib/format';
import { ITEM_BONUS_TEXT, WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

interface Buff {
  id: string;
  desc: string;
  endTime: number;
  itemId?: string;
}

interface Slot {
  buff: string;
  label: string;
  boost: string;
  /** false: the bonus cannot be extended (the Truce has a cooldown) */
  extend?: boolean;
  /** items that give the bonus (default: every item whose effect is this buff) */
  items?: string[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const production = `+${pct(BALANCE.resourceBuffBonus)}`;

const GROUPS: { label: string; slots: Slot[] }[] = [
  {
    label: 'Production',
    slots: [
      { buff: 'FoodProductionBuff', label: 'Food', boost: production },
      { buff: 'WoodProductionBuff', label: 'Lumber', boost: production },
      { buff: 'StoneProductionBuff', label: 'Stone', boost: production },
      { buff: 'IronProductionBuff', label: 'Iron', boost: production },
      { buff: 'GoldProductionBuff', label: 'Gold', boost: production },
    ],
  },
  {
    label: 'Military',
    slots: [
      { buff: 'AttackBuff', label: 'Attack', boost: '+20%' },
      { buff: 'DefenseBuff', label: 'Defense', boost: '+20%' },
      { buff: 'TrainCostReduceBuff', label: 'Training', boost: `-${pct(BALANCE.trainCostReduction)}` },
      { buff: 'UpkeepReduceBuff', label: 'Upkeep', boost: '-50%' },
      { buff: 'WarEnsignBuff', label: 'Army', boost: `+${pct(BALANCE.warEnsignTroopBonus)}` },
    ],
  },
  {
    label: 'Other',
    slots: [
      { buff: 'BuildingQueueBuff', label: 'Build queue', boost: '+1' },
      { buff: 'PlayerPeaceBuff', label: 'Truce', boost: 'On', extend: false, items: ['player.peace.1'] },
    ],
  },
];

const SLOT_BUFFS = new Set(GROUPS.flatMap((g) => g.slots.map((s) => s.buff)));

/** Timed states that are not bonuses, shown as one line under the slots. */
const OTHER_LABELS: Record<string, string> = {
  FurloughBuff: 'Holiday',
  PlayerPeaceCoolDownBuff: 'Truce cooldown',
  MoveCastleCoolDownBuff: 'Teleport cooldown',
};

/** A timer turns amber in its last day. */
const WARN_MS = 24 * 3_600_000;
const STORE_KEY = 'marchlands-effects-collapsed';

function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v != null) return v === '1';
  } catch {
    /* storage unavailable: fall through to the default */
  }
  // phones start collapsed so the item list stays above the fold
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}

/** Items giving a slot's bonus, longest first. */
function slotItems(slot: Slot): string[] {
  if (slot.items) return slot.items;
  const durationOf = (id: string) => {
    const e = itemEffect(id);
    return e?.kind === 'buff' ? e.durationMs : 0;
  };
  return ITEM_INFO.filter((i) => {
    const e = itemEffect(i.id);
    return e?.kind === 'buff' && e.buff === slot.buff;
  })
    .map((i) => i.id)
    .sort((a, b) => durationOf(b) - durationOf(a));
}

const itemName = (id: string) => itemConfig(id)?.name.trim() ?? id;

function adds(id: string) {
  const e = itemEffect(id);
  if (e?.kind !== 'buff') return '';
  const days = e.durationMs / 86_400_000;
  return days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.round(e.durationMs / 3_600_000)} hours`;
}

/** How the + button extends a bonus: use an owned item (the running one first), else buy one with the city's gold. */
type Extension = { kind: 'use'; itemId: string; owned: number } | { kind: 'buy'; itemId: string; price: number } | null;

function extensionFor(slot: Slot, active: Buff | undefined, counts: Map<string, number>): Extension {
  if (slot.extend === false) return null;
  const ids = slotItems(slot);
  const order = active?.itemId && ids.includes(active.itemId) ? [active.itemId, ...ids.filter((i) => i !== active.itemId)] : ids;
  const owned = order.find((i) => (counts.get(i) ?? 0) > 0);
  if (owned) return { kind: 'use', itemId: owned, owned: counts.get(owned)! };
  const buy = order.find((i) => itemGoldPrice(i) != null);
  return buy ? { kind: 'buy', itemId: buy, price: itemGoldPrice(buy)! } : null;
}

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

  const refresh = () => [qk.player, qk.city(city.id)];
  const use = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/player/items/{itemId}/use', { params: { path: { itemId } }, body: { cityId: city.id } })),
    refresh,
  );
  const buyAndUse = useCommand(async (itemId: string) => {
    await unwrap(api.POST('/api/v1/cities/{cityId}/shop/gold', { params: { path: { cityId: city.id } }, body: { itemId, amount: 1 } }));
    return unwrap(api.POST('/api/v1/player/items/{itemId}/use', { params: { path: { itemId } }, body: { cityId: city.id } }));
  }, refresh);

  function extend(slot: Slot, ext: NonNullable<Extension>) {
    if (ext.kind === 'buy') return setBuying({ slot, itemId: ext.itemId, price: ext.price });
    use.mutate(ext.itemId, { onSuccess: () => toast.success(`${slot.label} extended by ${adds(ext.itemId)}`) });
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

function SlotCell({
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
  if (!active) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-dashed py-0.5 pr-0.5 pl-2 text-xs text-muted-foreground">
        <span className="truncate">{slot.label}</span>
        <span className="ml-auto">off</span>
        <IconButton label="Find items" detail={`Show the items that give ${slot.label.toLowerCase()} ${slot.boost}`} onClick={onFind}>
          <Search />
        </IconButton>
      </div>
    );
  }
  const left = active.endTime - now;
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md border py-0.5 pr-0.5 pl-2 text-xs">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-muted-foreground">{slot.label}</span>
            <span className={cn('font-medium', ITEM_BONUS_TEXT)}>{slot.boost}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {active.itemId ? `${itemName(active.itemId)}: ` : ''}
          {active.desc} · {duration(left)} left
        </TooltipContent>
      </Tooltip>
      <span className={cn('ml-auto whitespace-nowrap tabular-nums', left < WARN_MS ? cn('font-medium', WARN_TEXT) : 'text-muted-foreground')}>
        {shortDuration(left)}
      </span>
      {extension ? (
        <IconButton
          label="Extend"
          detail={
            extension.kind === 'use'
              ? `Use a ${itemName(extension.itemId)} (×${fmtExact(extension.owned)} owned): +${adds(extension.itemId)}`
              : `Buy a ${itemName(extension.itemId)} for ${fmt(extension.price)} gold and use it: +${adds(extension.itemId)}`
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

function IconButton({
  label,
  detail,
  disabled,
  onClick,
  children,
}: {
  label: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 shrink-0 [&_svg]:size-3.5" aria-label={label} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="grid gap-0.5">
        <span className="font-medium">{label}</span>
        <span>{detail}</span>
      </TooltipContent>
    </Tooltip>
  );
}
