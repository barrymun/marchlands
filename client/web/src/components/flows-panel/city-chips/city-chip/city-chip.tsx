import { Castle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { HISTORIC_LEVELS } from '@marchlands/core';

import type { CityChipData } from '@/components/flows-panel/city-chips/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HISTORIC_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * One city, or several of one name (`×5`), as a chip; on hover, where each is. The city in view is outlined, and a held
 * historic city carries a castle in its flags' colour.
 */
export function CityChip({ chip, currentCityId }: { chip: CityChipData; currentCityId?: number }) {
  const { t } = useTranslation(['flows-panel', 'common']);
  const seat = HISTORIC_LEVELS.find((l) => l === chip.historicLevel);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex max-w-40 items-center gap-1 rounded-md border px-1.5 text-xs leading-5 text-foreground',
            chip.here && 'border-primary font-medium',
          )}
        >
          {seat && (
            <span className={cn('shrink-0 rounded-xs p-px', HISTORIC_TONE[seat])} title={t('common:historicCity', { level: seat })}>
              <Castle className="size-3" aria-hidden />
            </span>
          )}
          <span className="truncate">{chip.name}</span>
          {chip.cities.length > 1 && <span className="shrink-0 tabular-nums">×{chip.cities.length}</span>}
          {chip.here && <span className="sr-only"> · {t('cityPicker.here')}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <ul className="grid gap-0.5">
          {chip.cities.map((c) => (
            <li key={c.id}>
              {c.name}{' '}
              <span className="tabular-nums">
                ({c.x},{c.y})
              </span>
              {c.id === currentCityId && ` · ${t('cityPicker.here')}`}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
