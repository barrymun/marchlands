import { BASIC_RESOURCES } from '@marchlands/core';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import type { HeroBean, ResourceBean } from '@marchlands/api-client';
import { live } from '@/components/resource-bar/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNow } from '@/hooks/use-now';
import { fmt, fmtExact, percent, resourceLabel, signedRate } from '@/lib/format';
import { ITEM_BONUS_TEXT_INVERTED } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { Breakdown } from '@/components/resource-bar/breakdown/breakdown';
import { icons } from '@/components/resource-bar/constants';
import { Rows } from '@/components/resource-bar/rows/rows';
import type { Row } from '@/components/resource-bar/types';

export function ResourceBar({ resource, mayor }: { resource: ResourceBean; mayor?: HeroBean }) {
  const { t } = useTranslation('resource-bar');
  const now = useNow();
  const r = resource;
  const items = [
    {
      key: 'gold' as const,
      label: resourceLabel('gold'),
      amount: live(r.gold, r.goldRate, Infinity, r.updatedAt, now),
      rate: r.goldRate,
      max: null,
      line: null,
    },
    ...BASIC_RESOURCES.map((k) => ({
      key: k,
      label: resourceLabel(k),
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
                {max != null
                  ? t('amountMax', { resource: label, amount: fmtExact(amount), max: fmtExact(max) })
                  : t('amount', { resource: label, amount: fmtExact(amount) })}
                {full && ` ${t('storageFull')}`}
              </div>
              {line ? (
                <Breakdown line={line} mayor={mayor} />
              ) : (
                <Rows
                  rows={[
                    [t('gold.baseTax'), r.taxIncome - r.taxConverted - r.taxItemBonus],
                    ...(r.taxItemBonus ? [[t('itemBonus', { percent: percent(r.taxItemShare) }), r.taxItemBonus, ITEM_BONUS_TEXT_INVERTED] as Row] : []),
                    ...(r.taxConverted ? [[t('gold.taxSold', { rate: r.taxRate }), r.taxConverted] as Row] : []),
                    ...(r.herosSalary ? [[t('gold.heroSalaries'), -r.herosSalary] as Row] : []),
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
        <TooltipContent>{t('population', { idle: fmt(r.idlePopulation), efficiency: percent(r.efficiency) })}</TooltipContent>
      </Tooltip>
    </div>
  );
}
