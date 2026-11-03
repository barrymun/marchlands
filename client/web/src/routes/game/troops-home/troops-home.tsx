import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { TROOP_KEYS } from '@marchlands/core';

import { TroopBadge } from '@/components/troop-badge/troop-badge';
import { useGameNav } from '@/hooks/use-game-nav';
import { fmt } from '@/lib/format';
import { troopName } from '@/lib/game-data';
import { PanelId } from '@/lib/nav';
import { cn } from '@/lib/utils';

/** The troops at home in the city: every type with its badge and count, none dimmed; a click opens the Military panel. */
export function TroopsHome({ city, onPick }: { city: CityBean; onPick?: () => void }) {
  const { t } = useTranslation('game');
  const nav = useGameNav();
  const troops = Object.entries(TROOP_KEYS).map(([id, key]) => ({ id: Number(id), count: city.troop[key] ?? 0 }));
  return (
    <section aria-label={t('troopsHome.title')} className="grid gap-1.5">
      <h2 className="text-xs font-medium text-muted-foreground">{t('troopsHome.title')}</h2>
      <div className="grid grid-cols-2 gap-1">
        {troops.map((x) => (
          <button
            key={x.id}
            type="button"
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-start text-xs transition hover:bg-muted',
              x.count === 0 && 'text-muted-foreground opacity-60',
            )}
            title={troopName(x.id)}
            onClick={() => {
              nav.open(PanelId.MILITARY);
              onPick?.();
            }}
          >
            <TroopBadge id={x.id} />
            <span className="font-medium tabular-nums">{fmt(x.count)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
