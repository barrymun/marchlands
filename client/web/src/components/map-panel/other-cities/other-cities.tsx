import { useTranslation } from 'react-i18next';

import { tileDistance } from '@marchlands/core';

import { fmtDecimal } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The player's other cities, each with how far it is from this one; a click finds it on the map and opens its card. */
export function OtherCities({
  cities,
  fromTileId,
  mapSize,
  onGoTo,
  className,
}: {
  cities: readonly { id: number; name: string; x: number; y: number; fieldId: number }[];
  fromTileId: number;
  mapSize: number;
  onGoTo: (x: number, y: number) => void;
  className?: string;
}) {
  const { t } = useTranslation('map-panel');
  return (
    <section
      aria-label={t('cities.title')}
      className={cn('grid content-start gap-1 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur', className)}
    >
      <h2 className="font-medium">{t('cities.title')}</h2>
      {cities.map((c) => {
        const distance = tileDistance(fromTileId, c.fieldId, mapSize);
        return (
          <button
            key={c.id}
            onClick={() => onGoTo(c.x, c.y)}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-start hover:bg-muted"
          >
            <span className="min-w-0 truncate">
              {c.name}{' '}
              <span className="text-xs text-muted-foreground tabular-nums">
                ({c.x},{c.y})
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t('distance.away', { count: distance, n: fmtDecimal(distance, 1) })}</span>
          </button>
        );
      })}
    </section>
  );
}
