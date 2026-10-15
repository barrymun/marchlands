import { Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { HeroBean } from '@marchlands/api-client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { heroAttributeValues } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';
import { DominantBadge } from '@/routes/game/dominant-badge/dominant-badge';

/** The current city's mayor at a glance; opens the Heroes tab. */
export function MayorChip({ mayor, onClick }: { mayor?: HeroBean; onClick: () => void }) {
  const { t } = useTranslation(['game', 'common']);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn('h-7 gap-1.5 px-2 text-xs', !mayor && 'border-amber-500/60 text-amber-700 dark:text-amber-400')}
          onClick={onClick}
        >
          <Landmark className="size-3.5" />
          {mayor ? (
            <>
              <span className="text-muted-foreground">{t('mayor.label')}</span>
              <span className="font-medium">{mayor.name}</span>
              <span className="text-muted-foreground tabular-nums">{t('common:level.short', { level: mayor.level })}</span>
              <DominantBadge hero={mayor} />
            </>
          ) : (
            t('common:noMayor')
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {mayor ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {heroAttributeValues(mayor).map((a) => (
              <span key={a.key} className={cn('rounded px-1 py-px font-semibold tabular-nums', a.tone)}>
                {a.label} {a.v}
              </span>
            ))}
            <span>{t('mayor.attributesHint')}</span>
          </span>
        ) : (
          t('mayor.appointHint')
        )}
      </TooltipContent>
    </Tooltip>
  );
}
