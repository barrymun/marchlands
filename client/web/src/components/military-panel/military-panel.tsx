import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { DefencesTab, GearCard, HeroesPanel, MILITARY_TABS, TroopsTab } from '@/components/military-panel/constants';
import { HeroViewSwitch } from '@/components/military-panel/hero-view-switch/hero-view-switch';
import { useHeroView } from '@/components/military-panel/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGameNav } from '@/hooks/use-game-nav';
import { useSearchState } from '@/hooks/use-search-state';
import { PanelId } from '@/lib/nav';
import { MILITARY_SEARCH, MilitaryTab } from '@/lib/screen-search';

/**
 * The Military page (docs/features/military-page.md), for the city in view: its troops, its defences, its heroes beside
 * its Inn, and the player's gear. The tab is in the address (`?tab=gear`); `?tab=inn` (from the Inn's building or the
 * mayor chip) shows the heroes and brings the Inn into view.
 */
export function MilitaryPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation('military-panel');
  const nav = useGameNav();
  const [search, set] = useSearchState(MILITARY_SEARCH);
  // the Inn sits beside the heroes
  const tab = search.tab === MilitaryTab.INN ? MilitaryTab.HEROES : search.tab;
  const setTab = (v: string) => set({ tab: MILITARY_SEARCH.tab.read(v) });
  const heroView = useHeroView();
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {MILITARY_TABS.map((id) => (
              <TabsTrigger key={id} value={id}>
                {t(`tabs.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tab === MilitaryTab.HEROES && heroView.canChoose && <HeroViewSwitch view={heroView.view} onChoose={heroView.choose} />}
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        {tab === MilitaryTab.TROOPS && <TroopsTab city={city} />}
        {tab === MilitaryTab.DEFENCES && <DefencesTab city={city} />}
        {tab === MilitaryTab.HEROES && (
          <HeroesPanel city={city} view={heroView.view} focusInn={search.tab === MilitaryTab.INN} onGear={() => set({ tab: MilitaryTab.GEAR })} />
        )}
        {tab === MilitaryTab.GEAR && <GearCard onResearch={() => nav.open(PanelId.RESEARCH)} />}
      </Suspense>
    </div>
  );
}
