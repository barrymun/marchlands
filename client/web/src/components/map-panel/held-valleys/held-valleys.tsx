import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { VALLEY_RESOURCE, valleyBonus } from '@marchlands/core';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { percent } from '@/lib/format';
import { tileName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/** The valleys this city holds, strongest first, each with its bonus; a click finds it on the map, Release gives it up. */
export function HeldValleys({
  city,
  onGoTo,
  onRelease,
  releasing,
  className,
}: {
  city: CityBean;
  onGoTo: (x: number, y: number) => void;
  onRelease: (tileId: number) => Promise<unknown>;
  releasing: boolean;
  className?: string;
}) {
  const { t } = useTranslation(['map-panel', 'common']);
  return (
    <section
      aria-label={t('held.title', { city: city.name })}
      className={cn('grid content-start gap-1 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur', className)}
    >
      <h2 className="font-medium">
        {t('held.title', { city: city.name })} <span className="font-normal text-muted-foreground">({city.fields.length})</span>
      </h2>
      {city.fields.length === 0 && <p className="text-muted-foreground">{t('held.none')}</p>}
      {[...city.fields]
        .sort((a, b) => b.level - a.level || a.type - b.type)
        .map((v) => {
          const res = VALLEY_RESOURCE[v.type]?.[0];
          return (
            <div key={v.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted">
              <button onClick={() => onGoTo(v.x, v.y)} className="flex flex-1 items-center justify-between gap-2 text-left">
                <span>
                  {t('held.row', { type: tileName(v.type), level: v.level })}{' '}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ({v.x},{v.y})
                  </span>
                </span>
                {res && (
                  <span className="text-xs text-emerald-600 tabular-nums dark:text-emerald-400">
                    {t('held.bonus', { bonus: percent(valleyBonus(v.type, v.level)), resource: t(`common:resourcesInline.${res}`) })}
                  </span>
                )}
              </button>
              <ConfirmButton
                size="xs"
                variant="outline"
                disabled={releasing}
                title={t('release.title')}
                description={t('release.description')}
                confirmLabel={t('release.confirm')}
                onConfirm={() => onRelease(v.id)}
              >
                {t('release.short')}
              </ConfirmButton>
            </div>
          );
        })}
    </section>
  );
}
