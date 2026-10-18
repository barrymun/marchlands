import {
  Backpack,
  Castle,
  ChartColumn,
  Flag,
  FlaskConical,
  type LucideIcon,
  Map as MapIcon,
  Scale,
  ScrollText,
  Swords,
  UsersRound,
  Wheat,
  Workflow,
} from 'lucide-react';

import { i18n } from '@/lib/i18n';
import { lazyComponent } from '@/lib/lazy';
import type { PageId, PanelId, ViewId } from '@/lib/nav';

/** A place in the game's menus: its id (lib/nav.ts), its icon, and its name in the current locale. */
const place = <const Id extends ViewId | PageId | PanelId>(id: Id, icon: LucideIcon) => ({
  id,
  icon,
  get label() {
    return i18n.t(`game:nav.${id}`);
  },
});

/** The viewport's views, in the order of the switch. */
export const VIEWS = [place('town', Castle), place('fields', Wheat), place('map', MapIcon)] as const;

/** The panels that open over the view, in the order of the menu. */
export const PANELS = [
  place('military', Swords),
  place('heroes', UsersRound),
  place('research', FlaskConical),
  place('items', Backpack),
  place('armies', Flag),
] as const;

/** The pages that take the viewport's place, in the order of the menu. */
export const PAGES = [place('reports', ScrollText), place('market', Scale), place('flows', Workflow), place('stats', ChartColumn)] as const;

/** The width a page keeps: lines and tables stay readable on a big screen. Views use the whole viewport. */
export const PAGE_WIDTH = 'max-w-7xl';

// Every screen but the town and the fields (the one a visit starts on) loads its code on first use; usePreloadPanels
// fetches them all once the page is up, so opening one normally finds it loaded.
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
