// (marchlands) Hero gear (shared/core gear.ts): the lord's 14 pieces with their level and stars, and
// on each hero card the gear bonus and the attribute it boosts.

import { Trans, useTranslation } from 'react-i18next';
import { getCitiesByCityIdQueryKey, putHeroesGearStatMutation, type HeroBean, type LordGear } from '@marchlands/api-client';
import { GEAR_STATS, heroGearBreakdown } from '@marchlands/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { attributeOfStat } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';
import { maxLevel } from '@/components/hero-gear/constants';

/** On a hero card: the gear bonus this hero gets, its gear tier, and the attribute the gear boosts (free to change). */
export function HeroGearLine({ hero, cityId }: { hero: HeroBean; cityId: number }) {
  const { t } = useTranslation('hero-gear');
  const gear: LordGear | undefined = usePlayer().data?.gear;
  const setStat = useCommand(putHeroesGearStatMutation(), () => [getCitiesByCityIdQueryKey({ path: { cityId } })]);
  if (!gear || hero.seized) return null;
  const { tier, total } = heroGearBreakdown(hero.level, gear);
  const current = attributeOfStat(hero.gearStat);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground">
            <Trans
              t={t}
              i18nKey="line.summary"
              values={{ total, tier, max: maxLevel }}
              components={{ bonus: <span className={cn('rounded px-1 py-px font-semibold', current.tone)} /> }}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t('line.uses', { level: Math.min(gear.level, tier), count: tier })}
          {tier < maxLevel && ` ${t('line.nextTier', { tier: tier + 1, level: (tier + 1) * 10 })}`}
        </TooltipContent>
      </Tooltip>
      <span className="flex gap-0.5" role="group" aria-label={t('line.attributeGroup')}>
        {GEAR_STATS.map((stat) => {
          const a = attributeOfStat(stat);
          const on = stat === hero.gearStat;
          return (
            <button
              key={stat}
              type="button"
              disabled={setStat.isPending}
              aria-pressed={on}
              title={on ? t('line.boosts', { label: a.label }) : t('line.putOn', { label: a.label })}
              className={cn('rounded px-1.5 py-px font-medium uppercase', on ? a.tone : 'text-muted-foreground hover:bg-muted')}
              onClick={() => !on && setStat.mutate({ path: { heroId: hero.id }, body: { stat } })}
            >
              {a.short}
            </button>
          );
        })}
      </span>
    </div>
  );
}
