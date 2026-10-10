import type { HeroBean } from '@marchlands/api-client';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { heroAttributeValues } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';
import { DominantBadge } from '@/routes/game/dominant-badge/dominant-badge';

/** The current city's mayor at a glance; opens the Heroes tab. */
export function MayorChip({ mayor, onClick }: { mayor?: HeroBean; onClick: () => void }) {
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
              <span className="text-muted-foreground">Mayor</span>
              <span className="font-medium">{mayor.name}</span>
              <span className="text-muted-foreground tabular-nums">Lv {mayor.level}</span>
              <DominantBadge hero={mayor} />
            </>
          ) : (
            'No mayor'
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
            <span>Politics: production and build speed · Attack: training · Intelligence: research</span>
          </span>
        ) : (
          'Appoint a mayor in the Heroes tab to speed up production, building, training and research.'
        )}
      </TooltipContent>
    </Tooltip>
  );
}
