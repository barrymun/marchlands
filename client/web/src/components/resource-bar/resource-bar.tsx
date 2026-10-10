import { Users } from 'lucide-react';
import type { HeroBean, ResourceBean } from '@marchlands/api-client';
import { live } from '@/components/resource-bar/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNow } from '@/hooks/use-now';
import { fmt, fmtExact, signedRate } from '@/lib/format';
import { ITEM_BONUS_TEXT_INVERTED } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { Breakdown } from '@/components/resource-bar/breakdown/breakdown';
import { icons } from '@/components/resource-bar/constants';
import { Rows } from '@/components/resource-bar/rows/rows';
import type { Row } from '@/components/resource-bar/types';

export function ResourceBar({ resource, mayor }: { resource: ResourceBean; mayor?: HeroBean }) {
  const now = useNow();
  const r = resource;
  const items = [
    { key: 'gold' as const, label: 'Gold', amount: live(r.gold, r.goldRate, Infinity, r.updatedAt, now), rate: r.goldRate, max: null, line: null },
    ...(['food', 'wood', 'stone', 'iron'] as const).map((k) => ({
      key: k,
      label: k === 'wood' ? 'Lumber' : k[0].toUpperCase() + k.slice(1),
      amount: live(r[k].amount, r[k].increaseRate, r[k].max, r.updatedAt, now),
      rate: r[k].increaseRate,
      max: r[k].max,
      line: r[k],
    })),
  ];
  return (
    // phones: a 4-column grid, the rate under the amount; wider screens: one wrapping row
    <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 lg:gap-x-8">
      {items.map(({ key, label, amount, rate, max, line }) => {
        const Icon = icons[key];
        const full = max != null && amount >= max;
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <div className="flex min-w-0 items-center gap-1.5 tabular-nums">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-center sm:gap-1.5">
                  <span className={full ? 'font-medium text-amber-600' : 'font-medium'}>{fmt(amount)}</span>
                  <span className={cn('truncate text-[11px] sm:text-xs', rate < 0 ? 'text-destructive' : 'text-muted-foreground')}>{signedRate(rate)}</span>
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="grid gap-1.5">
              <div className="font-medium">
                {label}: {fmtExact(amount)}
                {max != null && ` / ${fmtExact(max)}`}
                {full && ' (storage full: production paused)'}
              </div>
              {line ? (
                <Breakdown line={line} mayor={mayor} />
              ) : (
                <Rows
                  rows={[
                    ['Base tax', r.taxIncome - r.taxConverted - r.taxItemBonus],
                    ...(r.taxItemBonus ? [[`Items +${r.taxItemPercent}%`, r.taxItemBonus, ITEM_BONUS_TEXT_INVERTED] as Row] : []),
                    ...(r.taxConverted ? [[`Tax ${r.taxRate}% (sold output)`, r.taxConverted] as Row] : []),
                    ...(r.herosSalary ? [['Hero salaries', -r.herosSalary] as Row] : []),
                  ]}
                  total={r.goldRate}
                />
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex min-w-0 items-center gap-1.5 tabular-nums">
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-center sm:gap-1.5">
              <span className="font-medium">{fmt(r.curPopulation)}</span>
              <span className="truncate text-[11px] text-muted-foreground sm:text-xs">/ {fmt(r.maxPopulation)}</span>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Population · {fmt(r.idlePopulation)} idle · {r.efficiency}% labour efficiency
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
