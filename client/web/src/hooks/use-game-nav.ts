import { useLocation, useNavigate, useParams } from 'react-router';
import { useSearchState } from '@/hooks/use-search-state';
import { GAME_SEARCH, isPanel, isScreen, leavingPrefix, type PanelId, screenHref, type ScreenId, type ScreenSearch, searchForCity, ViewId } from '@/lib/nav';

/**
 * The game's place (lib/nav.ts) and the moves between places: the city, the screen in the viewport (null when the
 * address names none, which the game page redirects), and the panel open over it. A page's own `tab` is in its
 * search parameters (`/cities/12/military?tab=gear`): go there with `go(PageId.MILITARY, { tab: MilitaryTab.GEAR })`, typed by
 * the page's own parameters (lib/screen-search.ts).
 */
export function useGameNav() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useSearchState(GAME_SEARCH);
  const cityId = Number(params.cityId);
  const part = params['*'] ?? '';
  const screen = isScreen(part) ? part : null;
  const wanted = search.panel;
  const panel = wanted && isPanel(wanted) ? wanted : null;
  return {
    cityId,
    part,
    screen,
    panel,
    /** a page asked for as a panel (an old address: Military was a panel), which the game page redirects */
    pageAsPanel: wanted && !isPanel(wanted) ? wanted : null,
    /** Show a view or a page (closing any panel), with its own search parameters (a building to open, a tab). */
    go: <S extends ScreenId>(to: S, params?: ScreenSearch<S>) => void navigate(screenHref(cityId, to, params)),
    /** Open a panel over the current screen (in place of one open, whose own parameters go); the back button closes it. */
    open: (p: PanelId) => setSearch({ panel: p }, { push: true, drop: leavingPrefix(panel, p) }),
    /** Close the panel, and its own parameters with it. */
    close: () => setSearch({ panel: null }, { push: true, drop: leavingPrefix(panel, null) }),
    /**
     * Switch to a city, keeping the screen, the panel and where each was, but the map's place (searchForCity); picking
     * the city already shown replaces the address rather than adding a step.
     */
    toCity: (id: number) =>
      void navigate({ pathname: screenHref(id, screen ?? ViewId.TOWN), search: searchForCity(location.search) }, { replace: id === cityId }),
  };
}
