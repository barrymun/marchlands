import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { HeroBean } from '@marchlands/api-client';

import { runningBoosts } from '@/components/hero-summary/utils';
import { duration, shortDuration } from '@/lib/format';
import { attributeOfBuff } from '@/lib/hero-attributes';
import { ITEM_BONUS_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** The hero's running boosts as one purple chip with the time until the soonest runs out; each in full on hover. Nothing with none. */
export function BoostChip({ hero, now, className }: { hero: HeroBean; now: number; className?: string }) {
  const { t } = useTranslation('hero-summary');
  const boosts = runningBoosts(hero, now);
  const [soonest] = boosts;
  if (!soonest) return null;
  return (
    <span
      className={cn('flex items-center gap-0.5 rounded px-1', ITEM_BONUS_TONE, className)}
      title={boosts
        .map((b) => t('boost', { label: attributeOfBuff(b.id)?.label ?? b.id, amount: b.param ?? '25%', time: duration(b.endTime - now) }))
        .join('\n')}
    >
      <Sparkles className="size-3" aria-hidden />
      {shortDuration(soonest.endTime - now)}
    </span>
  );
}
