import { useTranslation } from 'react-i18next';

import { FACTIONS } from '@marchlands/core';

import { RELATION_STYLE } from '@/components/map-panel/constants';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FACTION_STYLE } from '@/lib/factions';
import { factionName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * What the outlines on the map mean (your valleys, your city, and other players' valleys by your relation), and the
 * factions' colours, with a switch that tints the land by the faction holding it.
 */
export function MapLegend({ factions, onFactions, className }: { factions: boolean; onFactions: (on: boolean) => void; className?: string }) {
  const { t } = useTranslation('map-panel');
  return (
    <section aria-label={t('legend.title')} className={cn('grid gap-2 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur', className)}>
      <h2 className="font-medium">{t('legend.title')}</h2>
      <div className="flex flex-wrap gap-1">
        <span className="rounded px-1.5 py-0.5 text-[11px] ring-[3px] ring-fuchsia-500 ring-inset">{t('legend.thisCityValleys')}</span>
        <span className="rounded px-1.5 py-0.5 text-[11px] ring-2 ring-violet-300 ring-inset">{t('legend.otherCitiesValleys')}</span>
        <span className="rounded px-1.5 py-0.5 text-[11px] ring-2 ring-amber-400 ring-inset">{t('legend.thisCity')}</span>
        {Object.values(RELATION_STYLE).map((r) => (
          <span key={r.label} className={cn('rounded px-1.5 py-0.5 text-[11px]', r.ring)}>
            {t('legend.relationValleys', { relation: r.label })}
          </span>
        ))}
      </div>
      <h3 className="font-medium">{t('legend.factions')}</h3>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {FACTIONS.map((f) => (
          <span key={f.id} className="flex items-center gap-1.5 text-[11px]">
            <span aria-hidden className={cn('size-2.5 rounded-sm', FACTION_STYLE[f.id].swatch)} />
            {factionName(f.id)}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Switch id="map-factions" checked={factions} onCheckedChange={onFactions} />
        <Label htmlFor="map-factions" className="text-xs font-normal">
          {t('legend.showFactions')}
        </Label>
      </div>
    </section>
  );
}
