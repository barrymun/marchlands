import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CityChips } from '@/components/flows-panel/city-chips/city-chips';
import { CityPicker } from '@/components/flows-panel/city-picker/city-picker';
import type { Targets } from '@/components/flows-panel/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

/** The cities the next run goes to (changed here for this run only) and the repeat switch. */
export function RunsOn({
  targets,
  onTargets,
  currentCityId,
  hires,
  repeat,
  onRepeat,
  busy,
}: {
  targets: Targets;
  onTargets: (t: Targets) => void;
  currentCityId: number;
  hires: boolean;
  repeat: boolean;
  onRepeat: (on: boolean) => void;
  busy: boolean;
}) {
  const { t } = useTranslation('flows-panel');
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">{t('detail.runsOn')}</span>
        <CityChips targets={targets} currentCityId={currentCityId} />
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon-xs" variant="ghost" aria-label={t('detail.changeCities')} title={t('detail.changeCities')}>
              <Pencil />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="grid max-h-(--radix-popover-content-available-height) w-80 gap-2 overflow-auto [scrollbar-width:thin]">
            <p className="text-xs text-muted-foreground">{t('detail.changeCitiesHint')}</p>
            <CityPicker value={targets} onChange={onTargets} currentCityId={currentCityId} hires={hires} />
          </PopoverContent>
        </Popover>
      </span>
      <label className="flex items-center gap-2" title={t('runFlow.repeatHint')}>
        <Switch checked={repeat} disabled={busy} onCheckedChange={onRepeat} />
        {t('runFlow.repeat')}
      </label>
    </div>
  );
}
