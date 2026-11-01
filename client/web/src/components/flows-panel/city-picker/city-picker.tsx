import { useTranslation } from 'react-i18next';

import type { Targets } from '@/components/flows-panel/types';
import { hasHero } from '@/components/flows-panel/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePlayer } from '@/hooks/use-game';

/**
 * All cities (including ones gained later; a city with no hero is skipped unless the flow `hires` heroes), or a
 * selection of one or more cities.
 */
export function CityPicker({
  value,
  onChange,
  currentCityId,
  hires = false,
}: {
  value: Targets;
  onChange: (t: Targets) => void;
  currentCityId?: number;
  hires?: boolean;
}) {
  const { t } = useTranslation('flows-panel');
  const cities = usePlayer().data?.castles ?? [];
  const all = value === 'all';
  const chosen = new Set(all ? [] : value);
  const set = (id: number, on: boolean) => onChange(on ? [...chosen, id] : [...chosen].filter((x) => x !== id));
  const noHero = hires ? 0 : cities.filter((c) => !hasHero(c)).length;
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{t('cityPicker.label')}</Label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={all}
          onCheckedChange={(on) => onChange(on === true ? 'all' : currentCityId != null ? [currentCityId] : cities.slice(0, 1).map((c) => c.id))}
        />
        {t('cityPicker.all')}{' '}
        <span className="text-xs text-muted-foreground">
          {noHero ? t('cityPicker.allHintSkipped', { cities: cities.length, skipped: noHero }) : t('cityPicker.allHint', { cities: cities.length })}
        </span>
      </label>
      {!all && (
        <div className="grid gap-1 pl-6 sm:grid-cols-2">
          {cities.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={chosen.has(c.id)} onCheckedChange={(on) => set(c.id, on === true)} />
              <span className="truncate">
                {c.name}{' '}
                <span className="text-xs text-muted-foreground tabular-nums">
                  ({c.x},{c.y}){c.id === currentCityId ? ` · ${t('cityPicker.here')}` : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      {!all && chosen.size === 0 && <p className="text-xs text-destructive">{t('cityPicker.chooseOne')}</p>}
    </div>
  );
}
