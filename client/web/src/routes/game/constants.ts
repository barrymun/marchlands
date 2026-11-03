import {
  Backpack,
  CalendarClock,
  Castle,
  ChartColumn,
  Flag,
  FlaskConical,
  Landmark,
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
import { PageId, PanelId, ViewId } from '@/lib/nav';
import { MayorPicker } from '@/routes/game/mayor-chip/constants';

/** A place in the game's menus: its id (lib/nav.ts), its icon, and its name in the current locale. */
const place = <const Id extends ViewId | PageId | PanelId>(id: Id, icon: LucideIcon) => ({
  id,
  icon,
  get label() {
    return i18n.t(`game:nav.${id}`);
  },
});

/** The viewport's views, in the order of the switch. */
export const VIEWS = [place(ViewId.TOWN, Castle), place(ViewId.FIELDS, Wheat), place(ViewId.MAP, MapIcon)] as const;

/** The panels that open over the view, in the order of the menu. */
export const PANELS = [
  place(PanelId.MILITARY, Swords),
  place(PanelId.RESEARCH, FlaskConical),
  place(PanelId.ITEMS, Backpack),
  place(PanelId.ARMIES, Flag),
  place(PanelId.PLANS, CalendarClock),
  place(PanelId.FACTIONS, Landmark),
] as const;

/** The pages that take the viewport's place, in the order of the menu. */
export const PAGES = [
  place(PageId.HEROES, UsersRound),
  place(PageId.REPORTS, ScrollText),
  place(PageId.MARKET, Scale),
  place(PageId.FLOWS, Workflow),
  place(PageId.STATS, ChartColumn),
] as const;

/** The width a page keeps: lines and tables stay readable on a big screen. Views use the whole viewport. */
export const PAGE_WIDTH = 'max-w-7xl';

/** Pages that use the viewport's whole width instead: the Heroes page, its heroes' rows and gear in columns; the Reports page, its places in columns; the Statistics page, its charts side by side. */
export const FULL_WIDTH_PAGES: readonly PageId[] = [PageId.HEROES, PageId.REPORTS, PageId.STATS];

// Every screen but the town and the fields (the one a visit starts on) loads its code on first use, as does the mayor
// chip's quick swap; usePreloadPanels fetches them all once the page is up, so opening one normally finds it loaded.
export const MilitaryPanel = lazyComponent(() => import('@/components/military-panel/military-panel').then((m) => m.MilitaryPanel));
export const HeroesPanel = lazyComponent(() => import('@/components/heroes-panel/heroes-panel').then((m) => m.HeroesPanel));
export const ResearchPanel = lazyComponent(() => import('@/components/research-panel/research-panel').then((m) => m.ResearchPanel));
export const ItemsPanel = lazyComponent(() => import('@/components/items-panel/items-panel').then((m) => m.ItemsPanel));
export const MarketPanel = lazyComponent(() => import('@/components/market-panel/market-panel').then((m) => m.MarketPanel));
export const ArmiesPanel = lazyComponent(() => import('@/components/armies-panel/armies-panel').then((m) => m.ArmiesPanel));
export const PlansPanel = lazyComponent(() => import('@/components/plans-panel/plans-panel').then((m) => m.PlansPanel));
export const FactionsPanel = lazyComponent(() => import('@/components/factions-panel/factions-panel').then((m) => m.FactionsPanel));
export const ReportsPanel = lazyComponent(() => import('@/components/reports-panel/reports-panel').then((m) => m.ReportsPanel));
export const FlowsPanel = lazyComponent(() => import('@/components/flows-panel/flows-panel').then((m) => m.FlowsPanel));
export const StatsPanel = lazyComponent(() => import('@/components/stats-panel/stats-panel').then((m) => m.StatsPanel));
export const MapPanel = lazyComponent(() => import('@/components/map-panel/map-panel').then((m) => m.MapPanel));

export const LAZY_PANELS = [
  MilitaryPanel,
  HeroesPanel,
  ResearchPanel,
  ItemsPanel,
  MarketPanel,
  ArmiesPanel,
  PlansPanel,
  FactionsPanel,
  ReportsPanel,
  FlowsPanel,
  StatsPanel,
  MapPanel,
  MayorPicker,
];
