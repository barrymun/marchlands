import { Suspense, useState } from 'react';
import { Navigate } from 'react-router';

import { ActivityDock } from '@/components/activity-dock/activity-dock';
import { BuildingsPanel } from '@/components/buildings-panel/buildings-panel';
import { CityDialog } from '@/components/city-dialog/city-dialog';
import { LordDialog } from '@/components/lord-dialog/lord-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCity, usePlayer, usePushSync } from '@/hooks/use-game';
import { useGameNav } from '@/hooks/use-game-nav';
import { errorMessage } from '@/lib/api';
import { isPanel, legacyTarget, screenHref, VIEW_IDS } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { BottomBar } from '@/routes/game/bottom-bar/bottom-bar';
import { FlowsPanel, MapPanel, MarketPanel, PAGE_WIDTH, ReportsPanel, StatsPanel } from '@/routes/game/constants';
import { usePreloadPanels } from '@/routes/game/hooks';
import { PanelSheet } from '@/routes/game/panel-sheet/panel-sheet';
import { SideBar } from '@/routes/game/side-bar/side-bar';
import { TabBar } from '@/routes/game/tab-bar/tab-bar';
import { TopBar } from '@/routes/game/top-bar/top-bar';

/**
 * The game, laid out like the original but for any screen: a top bar (the city, the Town · Fields · Map switch, the
 * account), the viewport showing a view (the town, the fields, the map) or a page (reports, market, flows, stats),
 * and on a desktop a sidebar (cities, resources, troops at home, queues) and a bottom bar (the player, the menu) that
 * stay the same everywhere; on a phone a tab bar and a menu instead. The lighter screens open as panels over the view
 * (lib/nav.ts).
 */
export function GamePage() {
  const nav = useGameNav();
  const player = usePlayer();
  const city = useCity(nav.cityId);
  const status = usePushSync(true);
  const [dialog, setDialog] = useState<'lord' | 'city' | null>(null);
  usePreloadPanels();

  // an address naming no view or page (the city's own, or one from before the views) goes where it now lives
  if (!nav.screen) {
    const to = legacyTarget(nav.part);
    return <Navigate to={screenHref(nav.cityId, to.screen, to.panel && isPanel(to.panel) ? { panel: to.panel } : undefined)} replace />;
  }
  // a view fills the viewport edge to edge (the town and fields scroll themselves when shown as cards); a page scrolls inside it
  const isView = (VIEW_IDS as readonly string[]).includes(nav.screen);

  return (
    <div className="flex h-svh flex-col bg-muted/30">
      <TopBar city={city.data} status={status} onDialog={setDialog} />
      <div className="flex min-h-0 flex-1">
        <main className={cn('min-w-0 flex-1', isView ? 'overflow-hidden' : 'overflow-y-auto')}>
          <div className={isView ? 'h-full' : cn('mx-auto p-3 pb-24 sm:p-4 sm:pb-24 lg:px-6 lg:pb-6', PAGE_WIDTH)}>
            {city.error && <p className="text-sm text-destructive">{errorMessage(city.error)}</p>}
            {city.isPending && <Skeleton className="h-96" />}
            {city.data && (
              // a screen whose code hasn't arrived yet shows the same placeholder as a city still loading
              <Suspense fallback={<Skeleton className="h-96" />}>
                {nav.screen === 'town' && <BuildingsPanel city={city.data} area="inside" />}
                {nav.screen === 'fields' && <BuildingsPanel city={city.data} area="fields" />}
                {nav.screen === 'map' && <MapPanel city={city.data} mapSize={player.data?.mapSizeX ?? 800} />}
                {nav.screen === 'reports' && <ReportsPanel />}
                {nav.screen === 'market' && <MarketPanel city={city.data} />}
                {nav.screen === 'flows' && <FlowsPanel city={city.data} />}
                {nav.screen === 'stats' && <StatsPanel />}
              </Suspense>
            )}
          </div>
        </main>
        {city.data && <SideBar city={city.data} />}
      </div>
      <BottomBar />
      <TabBar city={city.data} />
      {city.data && (
        <>
          <PanelSheet city={city.data} />
          <div className="lg:hidden">
            <ActivityDock city={city.data} variant="floating" />
          </div>
          <CityDialog city={city.data} open={dialog === 'city'} onClose={() => setDialog(null)} />
        </>
      )}
      <LordDialog open={dialog === 'lord'} onClose={() => setDialog(null)} city={city.data} />
    </div>
  );
}
