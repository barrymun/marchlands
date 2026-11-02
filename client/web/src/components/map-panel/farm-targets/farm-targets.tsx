import { useTranslation } from 'react-i18next';

import { tileXY } from '@marchlands/core';

import type { FarmList } from '@/components/map-panel/types';
import { TileLabel } from '@/components/tile-label/tile-label';
import { cn } from '@/lib/utils';

/**
 * The player's farming lists on the map, a city at a time (this city first): each target with the flows listing it;
 * a click finds it on the map.
 */
export function FarmTargets({
  lists,
  mapSize,
  onGoTo,
  className,
}: {
  lists: readonly FarmList[];
  mapSize: number;
  onGoTo: (x: number, y: number) => void;
  className?: string;
}) {
  const { t } = useTranslation(['map-panel', 'common']);
  return (
    <section
      aria-label={t('farms.title')}
      className={cn('grid content-start gap-2 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur', className)}
    >
      <h2 className="font-medium">{t('farms.title')}</h2>
      {lists.length === 0 && <p className="text-muted-foreground">{t('farms.none')}</p>}
      {lists.map((l) => (
        <div key={l.cityId} className="grid gap-0.5">
          <h3 className="text-xs font-medium text-muted-foreground">
            {l.here ? t('farms.cityHere', { city: l.cityName }) : l.cityName} <span className="tabular-nums">({l.targets.length})</span>
          </h3>
          {l.targets.map(({ tileId, flows }) => {
            const { x, y } = tileXY(tileId, mapSize);
            return (
              <button
                key={tileId}
                onClick={() => onGoTo(x, y)}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-muted"
              >
                <TileLabel tileId={tileId} />
                <span className="truncate text-xs text-muted-foreground">{flows.join(t('common:list.separator'))}</span>
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}
