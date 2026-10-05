import { Coins, Hammer, Heart, Mountain, Trees, Users, Wheat } from 'lucide-react';
import type { ResourceBean } from '@evony/api-client';
import { scaled } from '@evony/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNow } from '@/hooks/use-now';
import { fmt, fmtExact, signed } from '@/lib/format';

const icons = { gold: Coins, food: Wheat, wood: Trees, stone: Mountain, iron: Hammer };

/** Amount now, integrating the hourly rate since the server's snapshot (capped at storage). */
function live(amount: number, ratePerHour: number, max: number, since: number, now: number) {
  const grown = amount + (ratePerHour * Math.max(0, now - since)) / Math.max(1, scaled(3_600_000));
  if (ratePerHour > 0) return amount >= max ? amount : Math.min(max, grown);
  return Math.max(0, grown);
}

export function ResourceBar({ resource }: { resource: ResourceBean }) {
  const now = useNow();
  const r = resource;
  const items = [
    { key: 'gold' as const, label: 'Gold', amount: live(r.gold, r.goldRate, Infinity, r.updatedAt, now), rate: r.goldRate, max: null },
    ...(['food', 'wood', 'stone', 'iron'] as const).map((k) => ({
      key: k,
      label: k === 'wood' ? 'Lumber' : k[0].toUpperCase() + k.slice(1),
      amount: live(r[k].amount, r[k].increaseRate, r[k].max, r.updatedAt, now),
      rate: r[k].increaseRate,
      max: r[k].max,
    })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {items.map(({ key, label, amount, rate, max }) => {
        const Icon = icons[key];
        const full = max != null && amount >= max;
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 tabular-nums">
                <Icon className="size-4 text-muted-foreground" />
                <span className={full ? 'font-medium text-amber-600' : 'font-medium'}>{fmt(amount)}</span>
                <span className={rate < 0 ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{signed(rate)}/h</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {label}: {fmtExact(amount)}
              {max != null && ` / ${fmtExact(max)}`}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 tabular-nums">
            <Users className="size-4 text-muted-foreground" />
            <span className="font-medium">{fmt(r.curPopulation)}</span>
            <span className="text-xs text-muted-foreground">/ {fmt(r.maxPopulation)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Population · {fmt(r.idlePopulation)} idle · {r.efficiency}% labour efficiency
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 tabular-nums">
            <Heart className="size-4 text-muted-foreground" />
            <span className="font-medium">{r.support}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Loyalty {r.support} · grievance {r.complaint} · tax {r.taxRate}%
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
