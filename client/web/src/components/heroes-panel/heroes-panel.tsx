import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import type { CityBean } from '@marchlands/api-client';

import { GearCard } from '@/components/hero-gear/gear-card/gear-card';
import { HERO_TABS } from '@/components/heroes-panel/constants';
import { HeroList } from '@/components/heroes-panel/hero-list/hero-list';
import { Inn } from '@/components/heroes-panel/inn/inn';
import { heroesTab } from '@/components/heroes-panel/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGameNav } from '@/hooks/use-game-nav';

/**
 * The Heroes page (docs/features/heroes-page.md), for the city in view, in two tabs: its heroes beside its Inn, and the
 * player's gear. The tab is in the address (`?tab=gear`); `?tab=inn` (from the Inn's building or the mayor chip) shows
 * the heroes and brings the Inn into view, below the heroes on a narrow screen.
 */
export function HeroesPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation('heroes-panel');
  const nav = useGameNav();
  const [search, setSearch] = useSearchParams();
  const tab = heroesTab(search.get('tab'));
  return (
    <div className="grid gap-4">
      <Tabs
        value={tab}
        onValueChange={(v) =>
          setSearch(
            (s) => {
              s.set('tab', v);
              return s;
            },
            { replace: true },
          )
        }
      >
        <TabsList>
          {HERO_TABS.map((id) => (
            <TabsTrigger key={id} value={id}>
              {t(`tabs.${id}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === 'heroes' && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <HeroList city={city} />
          <Inn city={city} focus={search.get('tab') === 'inn'} />
        </div>
      )}
      {tab === 'gear' && <GearCard onResearch={() => nav.open('research')} />}
    </div>
  );
}
