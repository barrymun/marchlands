import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { GearCard } from '@/components/hero-gear/gear-card/gear-card';
import { HERO_TABS, HERO_VIEW_QUERY, HERO_VIEWS } from '@/components/heroes-panel/constants';
import { HeroList } from '@/components/heroes-panel/hero-list/hero-list';
import { HeroSheet } from '@/components/heroes-panel/hero-sheet/hero-sheet';
import { Inn } from '@/components/heroes-panel/inn/inn';
import type { HeroView } from '@/components/heroes-panel/types';
import { readHeroView, saveHeroView } from '@/components/heroes-panel/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGameNav } from '@/hooks/use-game-nav';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSearchState } from '@/hooks/use-search-state';
import { PanelId } from '@/lib/nav';
import { HEROES_SEARCH, HeroTab } from '@/lib/screen-search';

/**
 * The Heroes page (docs/features/heroes-page.md), for the city in view, in two tabs: its heroes beside its Inn, and the
 * player's gear. The tab is in the address (`?tab=gear`); `?tab=inn` (from the Inn's building or the mayor chip) shows
 * the heroes and brings the Inn into view. From md up the heroes show as a Sheet (a roster beside the selected hero's
 * character sheet, with its figure wearing its gear) or a List of cards, the choice remembered; narrower, always the List.
 */
export function HeroesPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation('heroes-panel');
  const nav = useGameNav();
  const [search, set] = useSearchState(HEROES_SEARCH);
  // the Inn sits beside the heroes
  const tab = search.tab === HeroTab.INN ? HeroTab.HEROES : search.tab;
  const setTab = (v: string) => set({ tab: HEROES_SEARCH.tab.read(v) });
  const [chosen, setChosen] = useState<HeroView>(readHeroView);
  const wide = useMediaQuery(HERO_VIEW_QUERY);
  const view: HeroView = wide ? chosen : 'list';
  const choose = (v: HeroView) => {
    setChosen(v);
    saveHeroView(v);
  };
  const inn = <Inn city={city} focus={search.tab === HeroTab.INN} />;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {HERO_TABS.map((id) => (
              <TabsTrigger key={id} value={id}>
                {t(`tabs.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tab === HeroTab.HEROES && wide && (
          <div className="flex gap-1" role="group" aria-label={t('view.label')}>
            {HERO_VIEWS.map((v) => (
              <Button key={v} size="xs" variant={view === v ? 'default' : 'outline'} aria-pressed={view === v} onClick={() => choose(v)}>
                {t(`view.${v}`)}
              </Button>
            ))}
          </div>
        )}
      </div>
      {tab === HeroTab.HEROES &&
        (view === 'sheet' ? (
          <div className="grid items-start gap-4 2xl:grid-cols-[1fr_minmax(20rem,28rem)]">
            <HeroSheet city={city} onGear={() => setTab(HeroTab.GEAR)} />
            {inn}
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <HeroList city={city} />
            {inn}
          </div>
        ))}
      {tab === HeroTab.GEAR && <GearCard onResearch={() => nav.open(PanelId.RESEARCH)} />}
    </div>
  );
}
