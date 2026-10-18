import { useNavigate, useParams, useSearchParams } from 'react-router';
import { isPanel, isScreen, type PanelId, screenHref, type ScreenId } from '@/lib/nav';

/**
 * The game's place (lib/nav.ts) and the moves between places: the city, the screen in the viewport (null when the
 * address names none, which the game page redirects), and the panel open over it.
 */
export function useGameNav() {
  const params = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const cityId = Number(params.cityId);
  const part = params['*'] ?? '';
  const screen = isScreen(part) ? part : null;
  const wanted = search.get('panel');
  const panel = wanted && isPanel(wanted) ? wanted : null;
  return {
    cityId,
    part,
    screen,
    panel,
    /** Show a view or a page (closing any panel), with search parameters (a building to open). */
    go: (to: ScreenId, params?: Record<string, string>) => navigate(screenHref(cityId, to, params)),
    /** Open a panel over the current screen; the browser's back button closes it. */
    open: (p: PanelId) =>
      setSearch((s) => {
        s.set('panel', p);
        return s;
      }),
    close: () =>
      setSearch((s) => {
        s.delete('panel');
        return s;
      }),
    /** Switch to another city, keeping the screen and the panel. */
    toCity: (id: number) => navigate(screenHref(id, screen ?? 'town', panel ? { panel } : undefined)),
  };
}
