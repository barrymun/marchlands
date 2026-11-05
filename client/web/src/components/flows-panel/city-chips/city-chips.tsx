import { useTranslation } from 'react-i18next';

import { FlowCities } from '@marchlands/core';

import { CityChip } from '@/components/flows-panel/city-chips/city-chip/city-chip';
import { cityChips, limitChips } from '@/components/flows-panel/city-chips/utils';
import type { Targets } from '@/components/flows-panel/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlayer } from '@/hooks/use-game';

const CHIP = 'inline-flex w-fit items-center rounded-md border px-1.5 text-xs leading-5 text-foreground';

/** The cities a flow runs on, as chips: one for all of them, or one a name, at most `max` and then "+3 more". */
export function CityChips({ targets, currentCityId, max }: { targets: Targets; currentCityId?: number; max?: number }) {
  const { t } = useTranslation('flows-panel');
  const cities = usePlayer().data?.castles ?? [];
  if (targets === FlowCities.ALL) return <span className={CHIP}>{t('cityChips.all')}</span>;
  const chips = cityChips(targets, cities, currentCityId);
  if (!chips.length) return <span className="text-xs text-muted-foreground">{t('cityChips.none')}</span>;
  const { shown, hidden } = limitChips(chips, max);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((chip) => (
        <CityChip key={chip.key} chip={chip} currentCityId={currentCityId} />
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="px-1 text-xs leading-5 text-muted-foreground">{t('cityChips.more', { n: hidden.length })}</span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <ul className="grid gap-0.5">
              {hidden.map((c) => (
                <li key={c.id}>
                  {c.name}{' '}
                  <span className="tabular-nums">
                    ({c.x},{c.y})
                  </span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
