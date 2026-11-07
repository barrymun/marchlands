# Military page

**Status:** built 2026-11-07. The Military panel and the Heroes page are now one page, Military, with four tabs: **Troops · Defences · Heroes · Gear**. The design of the Heroes tab itself stays in [heroes-page.md](heroes-page.md). TODO.md, Done.

**The aim:** one place for a city's forces and the people who lead them. Training depends on heroes (the mayor's Attack shortens it, Politics shortens fortifications), yet they lived in two screens of two different kinds, and the long training list buried the fortifications.

## Where it started

- **The Military panel** slid over the view (`?panel=military`), up to `max-w-5xl`: Garrison, City defences and Injured troops in one column, Training and Fortifications in the other.
- **The Heroes page** took the viewport's place (`/cities/12/heroes`), with the tabs Heroes and Gear.
- **Measured** with a Barracks and no Walls (2026-11-07), the panel's Fortifications card started this far down its scrolling column, and 12 troop cards came before it:

  | Screen | Fortifications start | Each troop card |
  |---|---|---|
  | 1440×900 | 2,884 px | 190 px |
  | 1024×768 | 3,868 px | 274 px |
  | 375×812 (phone) | 4,940 px | 274 px |

- **After the change,** on the same city, the Fortifications card starts at 413 px on a phone (under City defences on its own tab) and sits at the top beside City defences from `xl` up. The Troops tab is 2,700 px tall at 1440×900 and 1,536 px at 1920×1080, its cards in two columns from `2xl`.

## The options weighed

| Option | For | Against |
|---|---|---|
| **A. Four tabs** (Troops, Defences, Heroes, Gear). *Chosen* | Fortifications one click away; each tab loads alone; the most used first | Troops and heroes aren't side by side, so the mayor needs a way across (below) |
| B. Three tabs (Forces, Heroes, Gear) | Least work: the panel moves whole | Keeps the buried fortifications; "Forces" says less than "Troops" |
| C. An Overview tab plus the four | Could help on a phone | Repeats the sidebar's troops at home and queues on a desktop; five tabs, more to build |
| D. One long page with jump links | Everything can be read and compared on one page | Very long, and every section (the 3D figure included) loads at once |
| E. A rail of sections down the side | Room for many sections | A second vertical menu next to the game's sidebar, taking the width the character sheet needs; becomes tabs on a phone anyway |
| F. Keep them apart, and only split the fortifications out | No move at all | Keeps two screens of two kinds for one subject |

Why tabs fit, from [Nielsen Norman Group, Tabs, Used Right](https://www.nngroup.com/articles/tabs-used-right/): they suit long content in clear groups with short labels, in one row, the most used first and selected by default; they don't suit content people must compare across tabs. Games point the same way, loosely: [Supercell's 2026 Clash of Clans revamp](https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/) gathers buildings and heroes, army upgrades, hero equipment and pets in one menu of four tabs. There's no study of this exact merge: this is judgement from those, and from the measurements here.

## Decided

- **A page, whole width** (2026-11-07): the Heroes page already needed the room (heroes-page.md). A page replaces the view, where the panel kept it behind; the top bar's Town · Fields · Map switch and the back button are the way back, and on a desktop the sidebar keeps resources, troops at home and queues in view.
- **Four tabs, Troops first** (2026-11-07): the first page a menu click lands on, for the page's name and the common trip; the links to heroes (the mayor chip, the Inn's building) go straight to their tab. The tab isn't remembered: the address says where you are, and a link says where it goes. Width measured on a phone: four English tabs take 246 px of 351 px (Japanese 205, Arabic 219), so one row is safe; six wouldn't fit (381).
- **"Defences" names the tab** (2026-11-07): one short word for what the cards call City defences and Fortifications ("Defenses" in en-US).
- **Each tab loads on its own** (2026-11-07): `TroopsTab`, `DefencesTab`, `HeroesPanel` and `GearCard` are lazy components declared in the page's own code (`military-panel/constants.ts`), not the first page's: their loaders pushed the first page over its size budget, which was already at 309.72 of 310 kB. They start fetching as the page's code loads, and no tab asks for another's queues.
- **No tabs inside a tab** (2026-11-07): a production card's Train · In progress tabs are gone, so a second row of tabs never sits under the first. Batches in progress show above the order form, collapsed once there are more than `QUEUE_OPEN_MAX` (a city with many barracks can have dozens) with the count on the button.
- **The mayor swaps in place** (2026-11-07): the training hint ("Mayor X, Attack 76, 18% faster") has a Change mayor button opening the same quick swap as the top bar's chip (`components/mayor-picker/`). The chip is hidden on a phone, and this is the one thing Troops and Defences need from Heroes.
- **Garrison beside the order form, not merged into it** (2026-11-07): a smaller change than one row per troop with its count, order box and dismiss button; that stays an idea for later (backlog).
- **Armies and Plans stay panels** (2026-11-07): they're looked at over the map, and two more tabs would no longer fit one row on a phone. The name may make players look for them here; if so, add a link rather than tabs.
- **The first page's size budget went up** (2026-11-07, 310 to 312 kB): it was at 309.72 of 310 kB before this page, and the redirects and new layout classes took it over, even with the tabs' loaders kept out of it. Rather than trade away a safe grid for a few bytes, the limit was raised on purpose, with the reason beside it (`client/web/.size-limit.js`).
- **The List from `xl`: heroes in two columns over two thirds of the width** (2026-11-07): a hero's card is long, so two a row show far more of the roster at once, and the Inn takes the last third. They read across then down, and a hero is dragged onto the place it should take, in any column, since the order is by position (`useHeroOrder`). The arrows still move one place earlier or later in that order. Below `xl` the List stays as it was, side by side from `lg` and stacked on a phone: a third of the page would be about 220 px at 1024 wide, too narrow for an offer. The Sheet is unchanged.
- **Old addresses still work** (2026-11-07): `/cities/12/heroes?tab=gear&hero=3` goes to the same place under `/military`, with no tab there meaning the Heroes tab; `?panel=military` and `?panel=heroes` go to the page (`legacyHref`, `pageAsPanelHref`, `lib/nav.ts`). An old `military.forts` or `military.troops` parameter is dropped, as it named a tab that no longer exists.
- **Folders stay** (2026-11-07): `components/military-panel/` is the page and its Troops and Defences tabs, and `components/heroes-panel/` stays top level as the Heroes tab (other features import from it), rather than moving a hundred paths for nothing.

## Open

- Should the page remember the last tab? Left out until someone misses it.
- Whether players look for Armies and Plans here (above).
