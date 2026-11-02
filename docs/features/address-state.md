# Screens in the address

**Status:** built 2026-11-02 for the Reports, Heroes, Stats and Flows pages, the Town and Fields views' `building`, the map's place (`at`), and the Items and Military panels. Next: links to a report (below). This is the reference for how a screen keeps its place in the address; AGENTS.md (Client, UI conventions) gives the short rules and points here.

**The aim:** where the player is on a screen (its tab, filters, sort, page and the thing open) survives a reload, the back button works as expected, and a link (from another screen, or pasted) opens the screen in that state. A link that no longer fits never shows an error.

## Where things stand

- **The screen** is the address's path (`/cities/12/reports`), the panel over it the `panel` search parameter (`lib/nav.ts`, `useGameNav`). Both are const objects: `ViewId`, `PageId`, `PanelId` (`ViewId.TOWN`, `PageId.REPORTS`, `PanelId.ITEMS`).
- **Each screen's place** is in its own search parameters:

  | Screen | Parameters | Schema |
  |---|---|---|
  | Reports page | `tab`, `q`, `kind`, `unread`, `order`, `page`, `report` | `REPORT_SEARCH` (`lib/screen-search.ts`) |
  | Heroes page | `tab` (or `inn`), `hero` | `HEROES_SEARCH` (`lib/screen-search.ts`) |
  | Town and Fields views | `building` (a position: opens its dialog once, then goes) | `BUILDING_SEARCH` (`lib/screen-search.ts`) |
  | Stats page | `city`, `period` | `STATS_SEARCH` (`components/stats-panel/constants.ts`) |
  | Flows page | `flow` | `FLOWS_SEARCH` (`components/flows-panel/constants.ts`) |
  | World map | `at` (the place last gone to, or centred on with a tile card's Centre here: opens there, selected; the crosshair clears it) | `MAP_SEARCH` (`lib/screen-search.ts`) |
  | Items panel | `items.category`, `items.q`, `items.owned`, `items.effect` | `ITEMS_SEARCH` (`components/items-panel/constants.ts`) |
  | Military panel | `military.troops`, `military.forts` (each production card's tab) | `MILITARY_SEARCH` (`components/military-panel/production/constants.ts`) |
  | Every screen | `panel` | `GAME_SEARCH` (`lib/nav.ts`) |

- **What stays out:** how the player likes a screen shown is a preference in `localStorage` (Scene or Grid, the hero view, 2D or 3D, a collapsed card), and what passes (hover, an open menu or popover, a draft, the market's sub-pane views) stays in `useState`.

## How it works

- **A schema** describes a screen's parameters once: an object of `param`s (`lib/search-state.ts`), each reading its value from the address and writing it back.

  | `param` | Value | Default (left out of the address) |
  |---|---|---|
  | `oneOf(values, fallback)` | one of a fixed list (a tab, a sort), built from a const object | the fallback |
  | `maybe(values)` | one of a fixed list, or none (a kind, a bonus) | none |
  | `text(max)` | text as typed, cut to `max` | blank |
  | `flag()` | on or off, written `1` | off |
  | `page()` | a page from 1 | 1 |
  | `id()` | a numeric id from 1 (a report, a hero, a city) | none |
  | `key()` | a short id of letters and digits (a flow) | none |
  | `point()` | a place on the map, in the game's notation (`300,500`) | none |
  | `int(accepts)` | a whole number the screen accepts (a building's position, which may be negative) | none |

- **Reading never fails:** a value missing, mistyped or out of range reads as the default, so an old or hand-edited address always opens the screen. **A default is never written**, so a screen nobody narrowed keeps a clean address.
- **`useSearchState(schema)`** (`hooks/use-search-state.ts`) gives the values and `set(patch)`. `set` changes only the schema's names, leaving every other parameter as it was. It is the only reader of react-router's `useSearchParams`: nothing else reads or writes a search parameter, and no name or value is written as a string.
- **Typed links:** `useGameNav`'s `go(screen, params)` and `screenHref` take the parameters of that screen (`SCREEN_SEARCH` in `lib/nav.ts`, `ScreenSearch<S>`), so `go(PageId.HEROES, { tab: HeroTab.INN })` passes the typecheck and a misspelt name, a value the screen doesn't know, or a parameter on a screen that has none fails it. The schemas other screens link to, and the const objects the links use (`HeroTab`, `ReportTab`), live in `lib/screen-search.ts`; a schema nothing links to stays in its screen's `constants.ts`.
- **Tabs go through the schema:** a tab's `onValueChange` gives a string, read with the schema's own `param` (`set({ tab: HEROES_SEARCH.tab.read(v) })`), never cast.
- **Panels:** a panel names itself (`useSearchState(ITEMS_SEARCH, { panel: PanelId.ITEMS })`), so its names sit under its id (`items.q`, `panelPrefix`) and never clash with the page under it. Closing it, or opening another panel in its place, drops them (`leavingPrefix`, `dropPrefix`); the back button brings them back with the panel.
- **History:** a change replaces the address, so the back button doesn't step through every filter tried. Something the back button should close is a step of its own (`set(patch, { push: true })`): an opened report, a panel. Closing a report the page opened steps back over that step rather than adding another.
- **A search box** (`useSearchText`): the box shows each key at once, and the address takes the text once typing pauses (`SEARCH_TEXT_DELAY_MS`), so a server search asks once. When the address changes some other way (Clear filters, the back button), the box follows it; when it only catches up with what the box wrote, keys typed since stay (`followAddress`, `textToWrite`).
- **Switching city** keeps the address (the screen, the panel and every parameter) but the map's `at`, so the map goes to the city picked, closing the card of the place gone to (`searchForCity`, `lib/nav.ts`). Picking the city already shown does the same, replacing the address. After going to a place, clicking one of the player's own cities on the map takes its place too: the city in view lets it go (the map back home, its card open), another of theirs becomes it, so a reload opens there. A value that belongs to one city falls back by itself (a `hero` not in the new city shows its mayor).

## Falling back quietly

An address can stop fitting: reports expire, things are deleted, a version changes what a parameter takes. The player never sees an error for it:

- **A page past the last** goes to the last there is, or the first when nothing matches (`pageToFix`, `reports-panel/utils.ts`). It is judged only from the answer for that very page: the previous page's, still on show while it loads (`keepPreviousData`), says nothing about it.
- **Something since deleted** (a report): its request is refused, and the dialog closes and leaves the address.
- **Filters the server refuses** reset to the defaults, keeping the tab and the report open (`unfiltered`).
- **Only refusals count** (`isRefusal`, `lib/errors.ts`: a 4xx other than 401 and 429). A dropped connection or a server fault keeps the player's place and is tried again; such queries take `retry: retryUnlessRefused`, so a refusal acts at once.
- **Corrections replace** the address, so the back button never lands on the address just corrected.

## Decided

- **The address, not storage** (2026-11-02): the maintainer asked for a reload to keep the Reports page's filters and open report. A place in the address also makes links and the back button work; a preference stays in `localStorage` (AGENTS.md, Remembered UI state).
- **One shared hook, not one per screen** (2026-11-02): Heroes, the buildings panel and `useGameNav` each read the address by hand before, slightly differently.
- **No string names or values** (2026-11-02, the maintainer's rule): the schema types every name and value, fixed values are const objects (`HeroTab.GEAR`), and links are typed per screen. The same rule now holds for the screen and panel ids.
- **Replace, and push only to close** (2026-11-02): filters, tabs and pages replace the address; opening a report or a panel adds a step.
- **The map keeps where the player went, not where they look** (2026-11-02, the maintainer: coordinates searched for should survive a reload, and the player can always go back to their city): `at` is written by going somewhere, never by panning or picking a tile, so the address doesn't change on every drag, and the crosshair clears it. A link can open the map on a place (`go(ViewId.MAP, { at: { x, y } })`).
- **Centring on a tile is asked for** (2026-11-02, the maintainer: a city picked on the map should stay in focus after a reload): the tile card's Centre here goes to the tile as the go-to box does and writes `at`. Picking a tile alone still doesn't, for the reason above.
- **Switching city clears the map's `at`** (2026-11-02, the maintainer, reversing the same day's decision to keep it): picking a city in the city switcher or the sidebar should show that city, over a place gone to before. To compare how far each city is from a target, go to the target again after switching.
- **Pages by position, not a cursor** (2026-11-02): page numbers stay. While reports arrive newest first, a page after a reload can start a few rows later; the open report is by id, so it is unaffected. A cursor ("older than report X") would need a server change not worth it here (backlog).
- **A panel's parameters go with it** (2026-11-02), so the view under a closed panel keeps a clean address.

## Open

- **Linking to a report from elsewhere** (`go(PageId.REPORTS, { report: id })`): from the new-report toast or an army's row.

## Phases

1. **Done 2026-11-02:** the hook and its `param`s; the Reports page (with its fallbacks) and the Heroes page on it.
2. **Done 2026-11-02:** typed links (`go`, `screenHref`), `panel` and `building` on the hook, `HeroTab` and `ReportTab`.
3. **Done 2026-11-02:** Items, Stats, Flows and Military; screen and panel ids as const objects; switching city keeps the address.
4. **Done 2026-11-02:** the map's place: going to coordinates (the go-to box, a valley, a farming target, a tile card's Centre here) writes `at`, the map opens there with the tile selected after a reload, and the crosshair (back to the city) clears it. Only going somewhere moves it: panning and picking tiles leave it, so a reload returns to where the player last asked to go.
5. **Next:** links to a report.
