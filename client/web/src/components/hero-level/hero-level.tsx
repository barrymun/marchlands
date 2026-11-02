import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { heroAtMaxLevel } from '@marchlands/core';

import { MAX_LEVEL_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** A hero's level ("Lv 42"), muted; at the maximum (BALANCE.heroMaxLevel) it stands out in gold with a trophy. */
export function HeroLevel({ level, className }: { level: number; className?: string }) {
  const { t } = useTranslation('common');
  const max = heroAtMaxLevel({ level });
  return (
    <span
      className={cn('whitespace-nowrap tabular-nums', max ? cn('font-semibold', MAX_LEVEL_TEXT) : 'font-normal text-muted-foreground', className)}
      title={max ? t('level.max') : undefined}
    >
      {/* inline, not flex: a flex box takes its baseline from the icon and rides up in a line of text (a dialog title) */}
      {max && <Trophy className="mr-0.5 inline-block size-[1em] align-[-0.125em]" aria-hidden />}
      {t('level.short', { level })}
    </span>
  );
}
