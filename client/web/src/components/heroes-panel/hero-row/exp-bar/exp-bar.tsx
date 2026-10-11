import { useTranslation } from 'react-i18next';
import { CircleCheck } from 'lucide-react';
import type { HeroBean } from '@marchlands/api-client';
import { BALANCE, heroAtMaxLevel, levelsReady } from '@marchlands/core';
import { fmtExact } from '@/lib/format';
import { STATUS_DONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** Experience towards the next level; animates when a push updates the hero. */
export function ExpBar({ hero }: { hero: HeroBean }) {
  const { t } = useTranslation('heroes-panel');
  if (heroAtMaxLevel(hero)) {
    return (
      <div className={cn('mt-1.5 flex items-center gap-1 text-[11px] font-medium tabular-nums', STATUS_DONE)}>
        <CircleCheck className="size-3" aria-hidden /> {t('expBar.maxLevel', { level: BALANCE.heroMaxLevel })}
      </div>
    );
  }
  const pct = Math.min(100, (hero.experience / Math.max(1, hero.upgradeExp)) * 100);
  const ready = hero.experience >= hero.upgradeExp;
  return (
    <div className="mt-1.5 grid w-56 max-w-full gap-1">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={hero.upgradeExp}
        aria-valuenow={hero.experience}
        aria-label={t('expBar.label')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', ready ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        {ready ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {levelsReady(hero) > 1 ? t('expBar.readyMulti', { times: levelsReady(hero) }) : t('expBar.ready')}
          </span>
        ) : (
          t('expBar.progress', {
            exp: fmtExact(hero.experience),
            needed: fmtExact(hero.upgradeExp),
            left: fmtExact(hero.upgradeExp - hero.experience),
            next: hero.level + 1,
          })
        )}
      </div>
    </div>
  );
}
