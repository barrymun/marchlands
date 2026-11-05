import { Suspense, useState } from 'react';
import { Navigate } from 'react-router';

import { AbandonNotice } from '@/components/abandon-notice/abandon-notice';
import { ActivityDock } from '@/components/activity-dock/activity-dock';
import { BuildingsPanel } from '@/components/buildings-panel/buildings-panel';
import { CityDialog } from '@/components/city-dialog/city-dialog';
import { LordDialog } from '@/components/lord-dialog/lord-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCity, usePlayer, usePushSync } from '@/hooks/use-game';
import { useGameNav } from '@/hooks/use-game-nav';
import { useSticky } from '@/hooks/use-sticky';
import { errorMessage } from '@/lib/api';
import { legacyTarget, PageId, screenHref, VIEW_IDS, ViewId } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { BottomBar } from '@/routes/game/bottom-bar/bottom-bar';
import {
  FlowsPanel,
  FULL_WIDTH_PAGES,
  HeroesPanel,
  MapPanel,
  MarketPanel,
  PAGE_WIDTH,
  ReportsPanel,
  SendArmyDialog,
  StatsPanel,
} from '@/routes/game/constants';
import { usePreloadPanels } from '@/routes/game/hooks';
import { PanelSheet } from '@/routes/game/panel-sheet/panel-sheet';
import { SideBar } from '@/routes/game/side-bar/side-bar';
import { TabBar } from '@/routes/game/tab-bar/tab-bar';
import { TopBar } from '@/routes/game/top-bar/top-bar';
import { ownCityTarget } from '@/routes/game/utils';

/**
 * The game, laid out like the original but for any screen: a top bar (the city, the Town · Fields · Map switch, the
 * account), the viewport showing a view (the town, the fields, the map) or a page (heroes, reports, market, flows, stats),
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
  // the city the city list's button is sending an army to, from any screen; the dialog stays mounted once opened, for its
  // close animation
  const [sendTo, setSendTo] = useState<number | null>(null);
  const sendCity = player.data?.castles.find((c) => c.id === sendTo);
  const sendOpened = useSticky(sendCity) != null;
  usePreloadPanels();

  // an address naming no view or page (the city's own, or one from before the views) goes where it now lives
  if (!nav.screen) {
    const to = legacyTarget(nav.part);
    return <Navigate to={screenHref(nav.cityId, to.screen, undefined, to.panel)} replace />;
  }
  // a screen that was a panel before it became a page (heroes) goes to the page
  if (nav.pageAsPanel) return <Navigate to={screenHref(nav.cityId, nav.pageAsPanel)} replace />;
  // a city that's gone (abandoned, or a historic city taken from the player): the same screen in their first city
  const first = player.data?.castles[0];
  if (first && !player.data?.castles.some((c) => c.id === nav.cityId)) return <Navigate to={screenHref(first.id, nav.screen)} replace />;
  // a view fills the viewport edge to edge (the town and fields scroll themselves when shown as cards); a page scrolls inside it;
  // the market is a trading terminal: on a wide screen it fills the viewport like a view, its panes scrolling themselves;
  // most pages keep a readable width, a few (FULL_WIDTH_PAGES) use the whole viewport
  const isView = (VIEW_IDS as readonly string[]).includes(nav.screen);
  const isTerminal = nav.screen === PageId.MARKET;
  const isFullWidth = (FULL_WIDTH_PAGES as readonly string[]).includes(nav.screen);

  return (
    <div className="flex h-svh flex-col bg-muted/30">
      <TopBar city={city.data} status={status} onDialog={setDialog} />
      {city.data && <AbandonNotice city={city.data} className="justify-center border-b bg-destructive/10 px-3 py-1.5" />}
      <div className="flex min-h-0 flex-1">
        <main className={cn('min-w-0 flex-1', isView ? 'overflow-hidden' : isTerminal ? 'overflow-y-auto xl:overflow-hidden' : 'overflow-y-auto')}>
          <div
            className={
              isView
                ? 'h-full'
                : isTerminal
                  ? 'p-2 pb-24 sm:pb-24 lg:pb-2 xl:h-full'
                  : cn('mx-auto p-3 pb-24 sm:p-4 sm:pb-24 lg:px-6 lg:pb-6', !isFullWidth && PAGE_WIDTH)
            }
          >
            {city.error && <p className="text-sm text-destructive">{errorMessage(city.error)}</p>}
            {city.isPending && <Skeleton className="h-96" />}
            {city.data && (
              // a screen whose code hasn't arrived yet shows the same placeholder as a city still loading
              <Suspense fallback={<Skeleton className="h-96" />}>
                {nav.screen === ViewId.TOWN && <BuildingsPanel city={city.data} area="inside" />}
                {nav.screen === ViewId.FIELDS && <BuildingsPanel city={city.data} area="fields" />}
                {nav.screen === ViewId.MAP && <MapPanel city={city.data} mapSize={player.data?.mapSizeX ?? 800} />}
                {nav.screen === PageId.HEROES && <HeroesPanel city={city.data} />}
                {nav.screen === PageId.REPORTS && <ReportsPanel />}
                {nav.screen === PageId.MARKET && <MarketPanel city={city.data} />}
                {nav.screen === PageId.FLOWS && <FlowsPanel city={city.data} />}
                {nav.screen === PageId.STATS && <StatsPanel />}
              </Suspense>
            )}
          </div>
        </main>
        {city.data && <SideBar city={city.data} onSend={setSendTo} />}
      </div>
      <BottomBar />
      <TabBar city={city.data} onSend={setSendTo} />
      {city.data && (
        <>
          <PanelSheet city={city.data} />
          <div className="lg:hidden">
            <ActivityDock city={city.data} variant="floating" />
          </div>
          {/* keyed by city: what's typed never carries over to another city, as when this one is gone */}
          <CityDialog key={city.data.id} city={city.data} open={dialog === 'city'} onClose={() => setDialog(null)} />
          {sendOpened && (
            <Suspense fallback={null}>
              <SendArmyDialog key={city.data.id} city={city.data} target={sendCity ? ownCityTarget(sendCity) : null} onClose={() => setSendTo(null)} />
            </Suspense>
          )}
        </>
      )}
      <LordDialog open={dialog === 'lord'} onClose={() => setDialog(null)} city={city.data} />
    </div>
  );
}
