import { useTranslation } from 'react-i18next';
import type { HeroBean } from '@marchlands/api-client';
import { dominantAttribute, heroAttributeValues } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';

/** The hero's attributes, with the highest one (what the hero is best at) as a coloured badge. */
export function HeroAttributes({ hero }: { hero: HeroBean }) {
  const { t } = useTranslation('heroes-panel');
  const values = heroAttributeValues(hero);
  const top = dominantAttribute(hero);
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
      <span className={cn('rounded-md px-1.5 py-0.5 text-sm font-semibold', top.tone)} title={t('attributes.strongest', { label: top.label })}>
        {top.label} {top.v}
      </span>
      <span className="text-muted-foreground">
        {values
          .filter((a) => a.key !== top.key)
          .map((a) => `${a.short} ${a.v}`)
          .join(' · ')}{' '}
        · {t('attributes.loyalty', { loyalty: hero.loyalty })}
        {hero.remainPoint > 0 && ` · ${t('attributes.points', { count: hero.remainPoint })}`}
      </span>
    </div>
  );
}
