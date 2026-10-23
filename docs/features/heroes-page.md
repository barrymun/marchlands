# Heroes page

**Status:** phase 1 built 2026-10-23 (the page with its tabs, the mayor popover, the Inn's button); phase 2 (the roster and character sheet) next. TODO.md item: *A Heroes page*.

**The aim:** give heroes a screen of their own, like Reports, Market and Flows, instead of the panel that slides over the town. Heroes are growing: 14 gear pieces with art, stars, generated names, and later famous historical heroes and perhaps portraits. A page has room for a roster and a full character sheet per hero.

## Where things stand

- **The Heroes panel** (`components/heroes-panel/`) is one of the lighter screens that slide over the view (`PANEL_IDS` in `lib/nav.ts`; `panel-sheet.tsx`, up to `max-w-5xl`). It opens from the menu and from the mayor chip in the top bar (`MayorChip`, `nav.open('heroes')`). It shows three cards, for the city in view:
  - **Your heroes:** one row per hero (`HeroRow`) with its attributes, experience, buffs and the gear line, in the player's order (drag or arrows), a status badge, and its actions: attribute points (dialog), items (dialog), lock, level up, make mayor, rename, dismiss (dialog). A mayor note shows what each would add to production as mayor.
  - **Inn:** the city's offers with their hire price and mayor note, hire and refresh.
  - **Hero gear:** the player's 14 pieces, each with its icon at the researched level, its stars and the star button (`GearCard`). Gear belongs to the player, not the city.
- **Pages** (`PAGE_IDS`: reports, market, flows, stats) take the viewport's place at a readable width (`PAGE_WIDTH`, `max-w-7xl`) and are their own address (`/cities/12/reports`). Panels are a `panel` parameter (`?panel=heroes`) and keep the view behind them.
- **Data:** the city query carries its heroes (`CityBean.heros`); the player query carries every city's (`castles[].heros`), so a roster across cities needs no new endpoint. The Inn is per city (`getCitiesTavern`).

## Is it worth it?

**For:**
- The panel is already full: three dense cards, two dialogs per hero, and the gear card now 14 icons with stars. A page gives each part room instead of stacking them.
- A hero is a character with attributes, gear, items and buffs: that reads best as a character sheet beside a roster (below), which a slide-over panel is too narrow for.
- What's planned needs the room: famous historical heroes (a hunt, unique heroes, TODO.md), gender and perhaps portraits.

**Against:**
- Moving it is real work: the navigation (a panel id becomes a page id, old addresses redirect), the mobile layout, and the tests that go with them.
- A panel keeps the town in view; a page replaces it. Swapping the mayor from the top bar is a quick action that shouldn't become a trip to another screen.

**Recommendation:** make it a page, built in phases (below), and keep the quick mayor swap as a small popover on the mayor chip.

## Decided

- **A page** (2026-10-23), not a wider panel.
- **The city in view only** (2026-10-23), as every other screen works: a roster across cities would make the page too large.
- **A pixel-art figure** (2026-10-23) behind the gear slots, as in the character sheets of Diablo, World of Warcraft and Path of Exile, drawn in code like the rest of the art: a man or a woman, matching the hero shown.
- **Our own art only** (2026-10-23): the original game's hero faces (`logoUrl`) are never shown. Any portraits we add are drawn in pixel art, which also keeps the page light on slow connections.
- **Attribute points and items stay dialogs** (2026-10-23).
- **No new sorting** (2026-10-23): the player's own order (drag or arrows) is the roster's order, as now.
- **The Inn opens from its building too** (2026-10-23): a button in the Inn's building dialog leads to the page's Inn.
- **The Inn beside the heroes, not a tab of its own** (2026-10-23, after phase 1): with three tabs, each held a single card and left too much empty space. The Heroes tab now has the city's heroes on the left and its Inn on the right (stacked on a narrow screen), and the tabs are **Heroes · Gear**.
- **The figure matches the hero shown** (2026-10-23): the sheet shows the selected hero, the mayor when the page opens, and the figure is a man or a woman as that hero is.
- **Hero sex goes to the client** (2026-10-23): the hero bean gains `sex` for the figure (the hero names design had kept it server-side while nothing showed it).
- **The figure doesn't wear the gear, for now** (2026-10-23): the 14 icons stand round a plain figure. Drawing the figure wearing each piece at its level, as Diablo does, is far more art (layered sprites per piece and level, for a man and a woman), so it's a spike of its own (TODO.md, *Heroes page: the figure wearing its gear*).
- **Each piece at the hero's own level** (2026-10-23): the sheet shows the gear this hero can use (its gear tier: a level 25 hero uses level 2), not the level researched.
- **A quick mayor swap on the mayor chip** (2026-10-23): a popover under the chip lists the city's heroes, each with what it would add to production as mayor and a Make mayor button, and a link to the page; the player stays in the town. It's a Radix popover (shadcn's `Popover`, from the `radix-ui` package already installed), which works by touch on a tablet. Below `sm` the top bar hides the chip, so on a phone the swap is on the page, where the mayor is shown first.

## Inspiration

- **Character sheets with gear round a figure** (a "paper doll"): Diablo II and IV, World of Warcraft's character pane, Path of Exile. The 14 pieces fit round a hero the same way: weapon and shield at the hands, head, shoulders, chest, back, gauntlets, belt, legs and feet down the body, the necklace, charm and ring as jewellery, the mount below.
- **A roster beside a detail:** XCOM 2's barracks and armoury, Football Manager's squad screen (sortable columns, a profile per player), Crusader Kings III's character window, Total War: Warhammer's lords.
- **Recruiting as its own place:** Darkest Dungeon's stagecoach (new recruits arrive, you hire or pass) is the Inn.
- **Strategy games of the same kind:** Rise of Kingdoms' commanders screen, Lords Mobile's heroes, and Evony: The King's Return's generals (a list, then a general with gear slots round them); and Age 2's own hero window and Workshop.

## Proposed layout

The page at the viewport's whole width, its tabs along the top: **Heroes · Gear** (and **Famous heroes** once that exists). Phase 1 shows the city's heroes and its Inn side by side on the Heroes tab; phase 2 turns the heroes into the roster and character sheet below, and the Inn moves with it.

```
┌ Heroes ─────────────────────────────────────────────────────────────────────┐
│  [Heroes]  Inn  Gear                                                         │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ ⋮ Konrad von Ulm  34  Mayor  │  Konrad von Ulm             Lv 34 · Mayor    │
│ ⋮ Ida de Verdun   21  Idle   │  ████████████░░░░  exp                       │
│ ⋮ Ugo di Guido    12  Away   │                                              │
│ ⋮ Gisela Arnulfs   8  Idle   │    [head]   [necklace]      Attack   58 +12  │
│                              │  [shoulder]   ( hero )  [weapon]  Politics 71│
│                              │    [chest]      [back]      Intel.   44      │
│                              │  [gauntlets] [belt] [shield]  Points: 2 [+]  │
│                              │    [legs]   [feet]  [ring]                   │
│                              │       [charm]   [mount]     Gear +34 → Pol.  │
│                              │                                              │
│                              │  Buffs · Items [Use]                         │
│                              │  [Make mayor] [Level up] [Lock] [Dismiss]    │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

- **Heroes tab:** the roster on the left, the city's heroes in the player's order (drag or arrows), each a compact row: name, level, status and attributes; the mayor is chosen when the page opens. The selected hero's sheet on the right: name (rename in place), level and experience, status and city; the figure, a man or a woman as the hero is, with each piece's icon round it at the level this hero can use (its gear tier) and its stars; attributes with points to spend and what boosts them; buffs and items; the mayor note; and the actions. The selected hero is in the address (`?hero=123`), so it can be linked to and the back button works.
- **The Inn,** beside the roster or below it: the city's offers, with hire, refresh and the mayor note against the city's mayor. The Inn's building dialog has a button that opens the page there.
- **Gear tab:** today's gear card with room: each piece large, its stars and next star's cost, the set bonus and how far each piece is from the next star level.
- **On a phone:** the tabs on top; the roster fills the screen, and choosing a hero opens its sheet over it (back returns to the roster); the figure and its slots shrink to fit, or become a grid of the 14 pieces.

## Open questions

None for now.

## Answered

Both rounds (2026-10-23) are recorded under Decided: a page, the city in view only, a pixel-art figure matching the hero shown, our own art only, dialogs kept, the player's own order, the Inn from its building too, hero sex sent to the client, the figure not wearing the gear yet, gear at the hero's own level, and the quick mayor swap as a popover.

## Built (phase 1)

- `heroes` is a page (`PAGE_IDS` in `lib/nav.ts`, first in `PAGES`); an old `?panel=heroes` address redirects to it (`pageOfPanel`, `game.tsx`).
- `HeroesPanel` (`components/heroes-panel/`) shows two tabs, the tab in a `tab` search parameter (`heroesTab`): **Heroes**, the city's heroes (`hero-list/`, as before) on the left and its Inn (`inn/`) on the right, stacked on a narrow screen; and **Gear** (`GearCard`). `?tab=inn` (from the Inn's building or the mayor chip) shows the Heroes tab and scrolls the Inn into view. (First built as three tabs, Heroes · Inn · Gear; merged the same day.)
- What a hero adds or would add as mayor is `MayorNote` (`components/mayor-note/`, its own namespace), on top of `lib/mayor.ts` (`fieldOutput`, `mayorShare`, `mayorGain`), shared by both tabs and the popover.
- The mayor chip opens `MayorPicker` (`routes/game/mayor-chip/mayor-picker/`) in a popover (shadcn `Popover`, added with the project's shadcn CLI): the mayor and the idle heroes with their mayor notes and a Make mayor button, a way to the Inn when none is idle, and to the page. Its content loads on first use (`mayor-chip/constants.ts`, preloaded with the screens), since the top bar is in the first page's code: Radix's popover still adds about 0.5 kB there (the `app` budget: 114.35 of 115 kB).
- The Inn's building dialog has a Hire heroes button to the page's Inn.
- The page uses the viewport's whole width (`FULL_WIDTH_PAGES`, 2026-10-23), not `PAGE_WIDTH`. The popover is as tall as the room below the chip allows (following the window's size), only its list scrolling, with a thin scrollbar, when the screen is too short for every hero.

## Phases

1. **A page with today's content** (built 2026-10-23): move `heroes` from the panels to the pages (`lib/nav.ts`, `PAGES`, `game.tsx`; `?panel=heroes` redirects), with the current cards in two tabs (the heroes beside the Inn, and the gear); the mayor chip's quick swap; the button in the Inn's building dialog.
2. **Roster and character sheet:** the two-column Heroes tab with the figure (a man and a woman, drawn in code) and the gear round it at the hero's own level; hero sex in the API.
3. **Famous heroes:** a tab of their own when that feature is built (TODO.md, Famous historical heroes).
4. **Maybe later:** the figure wearing its gear (TODO.md).
