import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { HeroBean } from '@marchlands/api-client';

import { runningBoosts } from '@/components/hero-summary/utils';
import { Badge } from '@/components/ui/badge';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';
import { attributeOfBuff } from '@/lib/hero-attributes';
import { translateMessage } from '@/lib/messages';
import { ITEM_BONUS_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * Active attribute boosts with a live countdown (real time: boosts are not sped up by GAME_SPEED); what each
 * does on hover.
 */
export function HeroBuffs({ hero }: { hero: HeroBean }) {
  const { t } = useTranslation('heroes-panel');
  const now = useNow();
  const active = runningBoosts(hero, now);
  if (!active.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {active.map((b) => (
        <Badge key={b.id} className={cn('gap-1 font-normal tabular-nums', ITEM_BONUS_TONE)} title={translateMessage(b.desc)}>
          <Sparkles className="size-3" />
          {t('buffs.active', { label: attributeOfBuff(b.id)?.label ?? b.id, amount: b.param ?? '25%', time: duration(b.endTime - now) })}
        </Badge>
      ))}
    </div>
  );
}
