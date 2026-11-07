import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { heroManagement, heroPower, HeroStatus, heroTimeMultiplier } from '@marchlands/core';

import { MayorPickerPopover } from '@/components/mayor-picker/mayor-picker-popover/mayor-picker-popover';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { percent } from '@/lib/format';

/**
 * The mayor's Attack (troops) or Politics (fortifications) shortens training: ×BALANCE.heroTimeFactor per point. Its button
 * swaps the mayor from here, as the one thing this tab needs from the Heroes tab (the top bar's chip is hidden on a phone).
 */
export function MayorTrainingHint({ city, fort }: { city: CityBean; fort: boolean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const [open, setOpen] = useState(false);
  const stat = fort ? t('common:heroAttributes.politics') : t('common:heroAttributes.attack');
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  const value = mayor ? (fort ? heroManagement(mayor) : heroPower(mayor)) : 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <p className="text-xs text-muted-foreground">
        {mayor
          ? t(fort ? 'mayorTraining.build' : 'mayorTraining.train', { name: mayor.name, stat, value, cut: percent(1 - heroTimeMultiplier(value), 1) })
          : t(fort ? 'mayorTraining.noMayorBuild' : 'mayorTraining.noMayorTrain', { stat })}
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="xs" variant="outline">
            {t('mayorTraining.change')}
          </Button>
        </PopoverTrigger>
        <MayorPickerPopover city={city} onDone={() => setOpen(false)} />
      </Popover>
    </div>
  );
}
