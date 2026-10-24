import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { HeroBean } from '@marchlands/api-client';
import { heroGearBreakdown } from '@marchlands/core';

import { maxLevel } from '@/components/hero-gear/constants';
import { usePlayer } from '@/hooks/use-game';
import { attributeOfStat, dominantAttribute } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';

/**
 * A hero's stats in short (HeroSummary): its strongest attribute as a coloured chip and its gear bonus, each in full
 * on hover.
 */
export function HeroStats({ hero }: { hero: HeroBean }) {
  const { t } = useTranslation('hero-summary');
  const gear = usePlayer().data?.gear;
  const top = dominantAttribute(hero);
  const gearBonus = gear && !hero.seized ? heroGearBreakdown(hero.level, gear) : null;
  return (
    <span className="flex items-center gap-1.5 text-xs tabular-nums">
      <span className={cn('rounded px-1 font-semibold', top.tone)} title={t('strongest', { label: top.label })}>
        {top.short} {top.v}
      </span>
      {gearBonus && gearBonus.total > 0 && (
        <span
          className="flex items-center gap-0.5 text-muted-foreground"
          title={t('gear', { total: gearBonus.total, label: attributeOfStat(hero.gearStat).label, tier: gearBonus.tier, max: maxLevel })}
        >
          <Shield className="size-3" aria-hidden />+{gearBonus.total}
        </span>
      )}
    </span>
  );
}
