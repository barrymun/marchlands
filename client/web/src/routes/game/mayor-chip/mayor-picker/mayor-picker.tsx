import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { HeroSummary } from '@/components/hero-summary/hero-summary';
import { canAppoint, isMayor } from '@/components/hero-summary/utils';
import { Button } from '@/components/ui/button';
import { useGameNav } from '@/hooks/use-game-nav';
import { useNow } from '@/hooks/use-now';
import { PageId } from '@/lib/nav';
import { HeroTab } from '@/lib/screen-search';

/**
 * The quick mayor swap under the mayor chip: the city's heroes at home (the mayor and the idle ones), each with its attributes, gear
 * bonus and boosts (HeroStats), what it adds or would add as mayor and a button to appoint it, and the way to the Heroes page (or its Inn, with none to pick).
 */
export function MayorPicker({ city, onDone }: { city: CityBean; onDone: () => void }) {
  const { t } = useTranslation(['game', 'common']);
  const nav = useGameNav();
  const now = useNow();
  const heroes = city.heros.filter((h) => isMayor(h) || canAppoint(h));
  const idle = heroes.some(canAppoint);
  const go = (tab?: HeroTab) => {
    nav.go(PageId.HEROES, tab ? { tab } : undefined);
    onDone();
  };
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="font-medium">{t('mayor.pick')}</div>
      {heroes.length === 0 && <p className="text-xs text-muted-foreground">{t('mayor.none')}</p>}
      <ul className="grid min-h-0 gap-1.5 overflow-y-auto [scrollbar-width:thin]">
        {heroes.map((h) => (
          <li key={h.id} className="rounded-md border">
            <HeroSummary hero={h} city={city} now={now} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-1.5">
        {!idle && (
          <Button size="xs" variant="outline" onClick={() => go(HeroTab.INN)}>
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
