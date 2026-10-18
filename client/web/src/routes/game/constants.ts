import { i18n } from '@/lib/i18n';
import { lazyComponent } from '@/lib/lazy';

const tab = <const Id extends 'buildings' | 'military' | 'heroes' | 'research' | 'items' | 'market' | 'armies' | 'reports' | 'map' | 'flows' | 'stats'>(
  id: Id,
  wide = false,
) => ({
  id,
  /** whether the tab uses the window's whole width (the town, the map) rather than a readable one (TAB_WIDTH) */
  wide,
  /** in the current locale */
  get label() {
    return i18n.t(`game:tabs.${id}`);
  },
});

export const TABS = [
  tab('buildings', true),
  tab('military'),
  tab('heroes'),
  tab('research'),
  tab('items'),
  tab('market'),
  tab('armies'),
  tab('reports'),
  tab('map', true),
  tab('flows'),
  tab('stats'),
] as const;

/** The width a tab's content keeps unless it is wide: lines and tables stay readable on a big screen. */
export const TAB_WIDTH = 'max-w-7xl';

// Every tab but the city's buildings (the one a visit starts on) loads its code on first use; usePreloadPanels
// fetches them all once the page is up, so switching tabs normally finds them loaded.
export const MilitaryPanel = lazyComponent(() => import('@/components/military-panel/military-panel').then((m) => m.MilitaryPanel));
export const HeroesPanel = lazyComponent(() => import('@/components/heroes-panel/heroes-panel').then((m) => m.HeroesPanel));
export const ResearchPanel = lazyComponent(() => import('@/components/research-panel/research-panel').then((m) => m.ResearchPanel));
export const ItemsPanel = lazyComponent(() => import('@/components/items-panel/items-panel').then((m) => m.ItemsPanel));
export const MarketPanel = lazyComponent(() => import('@/components/market-panel/market-panel').then((m) => m.MarketPanel));
export const ArmiesPanel = lazyComponent(() => import('@/components/armies-panel/armies-panel').then((m) => m.ArmiesPanel));
export const ReportsPanel = lazyComponent(() => import('@/components/reports-panel/reports-panel').then((m) => m.ReportsPanel));
export const FlowsPanel = lazyComponent(() => import('@/components/flows-panel/flows-panel').then((m) => m.FlowsPanel));
export const StatsPanel = lazyComponent(() => import('@/components/stats-panel/stats-panel').then((m) => m.StatsPanel));
export const MapPanel = lazyComponent(() => import('@/components/map-panel/map-panel').then((m) => m.MapPanel));

export const LAZY_PANELS = [MilitaryPanel, HeroesPanel, ResearchPanel, ItemsPanel, MarketPanel, ArmiesPanel, ReportsPanel, FlowsPanel, StatsPanel, MapPanel];
