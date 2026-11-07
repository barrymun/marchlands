import { Landmark } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean, HeroBean } from '@marchlands/api-client';

import { HeroLevel } from '@/components/hero-level/hero-level';
import { MayorPickerPopover } from '@/components/mayor-picker/mayor-picker-popover/mayor-picker-popover';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { heroAttributeValues } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';
import { DominantBadge } from '@/routes/game/dominant-badge/dominant-badge';

/** The current city's mayor at a glance; a click opens the quick mayor swap under it (MayorPicker), the town staying in view. */
export function MayorChip({ city, mayor }: { city: CityBean; mayor?: HeroBean }) {
  const { t } = useTranslation(['game', 'common']);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className={cn('h-7 gap-1.5 px-2 text-xs', !mayor && 'border-amber-500/60 text-amber-700 dark:text-amber-400')}>
              <Landmark className="size-3.5" />
              {mayor ? (
                <>
                  <span className="text-muted-foreground">{t('mayor.label')}</span>
                  <span className="font-medium">{mayor.name}</span>
                  <HeroLevel level={mayor.level} />
                  <DominantBadge hero={mayor} />
                </>
              ) : (
                t('common:noMayor')
              )}
            </Button>
          </PopoverTrigger>
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
      <MayorPickerPopover city={city} onDone={() => setOpen(false)} />
    </Popover>
  );
}
