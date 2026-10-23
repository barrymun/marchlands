import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, postHeroesMayorMutation } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';

import { MayorNote } from '@/components/mayor-note/mayor-note';
import { Button } from '@/components/ui/button';
import { useCommand } from '@/hooks/use-game';
import { useGameNav } from '@/hooks/use-game-nav';

/**
 * The quick mayor swap under the mayor chip: the city's heroes at home (the mayor and the idle ones), each with what it
 * adds or would add as mayor and a button to appoint it, and the way to the Heroes page (or its Inn, with none to pick).
 */
export function MayorPicker({ city, onDone }: { city: CityBean; onDone: () => void }) {
  const { t } = useTranslation(['game', 'common']);
  const nav = useGameNav();
  const appoint = useCommand(postHeroesMayorMutation(), () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })], t('mayor.appointed'));
  const heroes = city.heros.filter((h) => !h.seized && (h.status === HeroStatus.MAYOR || h.status === HeroStatus.IDLE));
  const idle = heroes.some((h) => h.status === HeroStatus.IDLE);
  const go = (tab?: string) => {
    nav.go('heroes', tab ? { tab } : undefined);
    onDone();
  };
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="font-medium">{t('mayor.pick')}</div>
      {heroes.length === 0 && <p className="text-xs text-muted-foreground">{t('mayor.none')}</p>}
      <ul className="grid min-h-0 gap-1.5 overflow-y-auto [scrollbar-width:thin]">
        {heroes.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 rounded-md border p-1.5 text-xs">
            <div className="min-w-0">
              <div className="truncate font-medium">
                {h.name} <span className="font-normal text-muted-foreground tabular-nums">{t('common:level.short', { level: h.level })}</span>
              </div>
              <MayorNote city={city} hero={h} />
            </div>
            {h.status === HeroStatus.IDLE && (
              <Button size="xs" variant="outline" disabled={appoint.isPending} onClick={() => appoint.mutate({ path: { heroId: h.id } })}>
                {t('mayor.appoint')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-1.5">
        {!idle && (
          <Button size="xs" variant="outline" onClick={() => go('inn')}>
            {t('mayor.toInn')}
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={() => go()}>
          {t('mayor.allHeroes')}
        </Button>
      </div>
    </div>
  );
}
