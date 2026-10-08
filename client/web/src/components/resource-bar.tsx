import { Coins, Hammer, Heart, Mountain, Trees, Users, Wheat } from 'lucide-react';
import type { HeroBean, ResourceBean, ResourceLine } from '@evony/api-client';
import { getGameSpeed, scaled } from '@evony/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNow } from '@/hooks/use-now';
import { fmt, fmtExact, signedRate } from '@/lib/format';
import { cn } from '@/lib/utils';

const icons = { gold: Coins, food: Wheat, wood: Trees, stone: Mountain, iron: Hammer };

/** Amount now, integrating the hourly rate since the server's snapshot (capped at storage). */
function live(amount: number, ratePerHour: number, max: number, since: number, now: number) {
  const grown = amount + (ratePerHour * Math.max(0, now - since)) / Math.max(1, scaled(3_600_000));
  if (ratePerHour > 0) return amount >= max ? amount : Math.min(max, grown);
  return Math.max(0, grown);
}

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
                  rows={[['Tax income', r.taxIncome], ...(r.herosSalary ? [['Hero salaries', -r.herosSalary] as [string, number]] : [])]}
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

function Breakdown({ line, mayor }: { line: ResourceLine; mayor?: HeroBean }) {
  const b = line.breakdown;
  const rows: [string, number][] = [
    ['Base', b.base],
    [`Fields${line.workRate !== 100 ? ` (${line.workRate}% work rate)` : ''}`, b.fields],
  ];
  if (b.tech) rows.push([`Technology +${b.techPercent}%`, b.tech]);
  rows.push([mayor ? `Mayor ${mayor.name} +${b.mayorPercent}%` : 'No mayor', b.mayor]);
  if (b.valley) rows.push([`Valleys +${b.valleyPercent}%`, b.valley]);
  if (b.buff) rows.push([`Items +${b.buffPercent}%`, b.buff]);
  if (b.upkeep) rows.push(['Troop upkeep', b.upkeep]);
  return <Rows rows={rows} total={line.increaseRate} />;
}

function Rows({ rows, total }: { rows: [string, number][]; total: number }) {
  return (
    <table className="text-xs tabular-nums">
      <tbody>
        {rows.map(([label, v]) => (
          <tr key={label}>
            <td className="pr-4">{label}</td>
            <td className="text-right">{signedRate(v)}</td>
          </tr>
        ))}
        <tr className="border-t font-medium">
          <td className="pr-4 pt-1">Total</td>
          <td className="pt-1 text-right">{signedRate(total)}</td>
        </tr>
        {getGameSpeed() !== 1 && (
          <tr>
            <td colSpan={2} className="pt-1 text-muted-foreground">
              Per real hour (game speed {getGameSpeed()}×)
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
