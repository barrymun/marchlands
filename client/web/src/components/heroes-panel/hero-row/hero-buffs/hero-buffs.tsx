import { Sparkles } from 'lucide-react';
import type { HeroBean } from '@marchlands/api-client';
import { Badge } from '@/components/ui/badge';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';
import { ITEM_BONUS_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { BUFF_LABEL } from '@/components/heroes-panel/hero-row/hero-buffs/constants';

/** Active attribute boosts with a live countdown (real time: boosts are not sped up by GAME_SPEED). */
export function HeroBuffs({ hero }: { hero: HeroBean }) {
  const now = useNow();
  const active = (hero.buffs ?? []).filter((b) => b.endTime > now);
  if (!active.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {active.map((b) => (
        <Badge key={b.id} className={cn('gap-1 font-normal tabular-nums', ITEM_BONUS_TONE)}>
          <Sparkles className="size-3" />
          {BUFF_LABEL[b.id] ?? b.id} +{b.param ?? '25%'} · {duration(b.endTime - now)} left
        </Badge>
      ))}
    </div>
  );
}
