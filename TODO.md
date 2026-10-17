# TODO

Planned work for future updates. Ideas still being weighed and known quirks are in [docs/backlog.md](docs/backlog.md); once an item here changes a game rule, document it in [docs/deviations.md](docs/deviations.md) and keep its numbers in `BALANCE` (`shared/core/src/balance.ts`).

## Gameplay

- [ ] **Historical cities.**
  - NPC cities at levels 12, 14, 16 and 18, with a single level 18 city at (0, 0).
  - Capturing one lets its owner draft troops from the neighbouring NPC cities: a share of each city's troops (50%?), once per day (to decide).
  - To decide: how they are captured and held, what "neighbouring" means (radius or zone), and what happens to drafted troops when the city is lost.
- [ ] **Overhaul the marketplace mechanics.**
  - Now: players post buy and sell orders, and a computer merchant always buys and sells every resource around a reference price that moves with trade (`BALANCE` merchant settings, `merchantJob`, `backend/packages/game/src/engine/market.ts`). The Market tab shows the order book and a price history line chart (`client/web/src/components/market-panel/`).
  - Plan: a complete rework of how the market works (details to decide).
  - Better graphs, with a live stock ticker where NPC cities trade in game.
- [ ] **Better hero name generator for heroes in the Inn.**
  - Now: a random first name and epithet, e.g. "Aldric the Bold" (`randomHeroName` in `shared/core/src/heroes.ts`, 40 first names and 18 epithets), so names repeat often and read alike.
- [ ] **Check the game logic against the original game's documentation.**
  - Make sure Marchlands' rules match the original Evony Age 1, e.g. the prerequisites for each building level (upgrading a Cottage from level 2 to 3 needs Town Hall level 2).
  - Now: building, research and troop requirements come from the original server's data dump (`requires` in `shared/core/src/data/legacy/*.json`, checked by `checkRequirements`); the cottage example already matches (Cottage 3 needs Town Hall 2, Cottage 4 needs Town Hall 3). Rules that differ on purpose are listed in [docs/deviations.md](docs/deviations.md).
  - Plan: go through the original game's documentation (guides, wikis) area by area and note anything that differs; fix it, or record it in deviations.md if it's kept.
- [ ] **Test the strategies from old game guides.**
  - Feed the armies, builds and tactics from old Evony Age 1 guides into Marchlands and see whether they still work.
  - Some results will differ because of the rules we changed on purpose ([docs/deviations.md](docs/deviations.md)); that's acceptable, but note where and why.
  - Battle strategies can be run with the battle sims (`npm run sim`, `tools/battle-sim`); record findings in [docs/battle-sims](docs/battle-sims/README.md).
- [ ] **Camp times: arrive at an exact time.**
  - Let a marching army reach its target (an enemy city or a valley) at a chosen time, accurate to the second, e.g. by camping before it sets off or on the way.
  - Show and enter these times in UTC, so players in different time zones can coordinate.
  - Now: an army can only camp at the target after it arrives (`restTime`, up to `BALANCE.maxRestTimeMs` = 24 hours; `sendArmy` in `backend/packages/game/src/services/armies.ts`), and the send-army dialog doesn't offer it. Times are shown in the player's local time (`dateTime` and `clockTime` in `client/web/src/lib/format.ts`).

## Client

- [ ] **Images for buildings, troops, gear, items, etc.**
  - Serve them from an image server or CDN that caches, resizes and picks the format per browser (AVIF / WebP), and lowers quality on slow connections.
  - Keep them out of the first page's download and the size budget (`client/web/.size-limit.js`): load them lazily, with sizes set so the layout doesn't jump.
- [ ] **Rework the map's UI** (`client/web/src/components/map-panel/`).
  - Images for cities and for each valley type.
  - Move around the map by dragging (and by touch on phones) instead of only the arrow buttons.

## Done

Newest first, with the date it was finished.

- 2026-10-15: **Rework gear power.** 1 point per piece level (140 for a level 10 set), star N adds N (770 for 10 stars on every piece), a new set bonus of 14 per star level every piece has reached (140), and star costs doubled (2 medals for stars 1-9, 6 Nation Medals for star 10). A maxed hero reaches 1,229. The worker re-applies gear to every hero at start-up. Stars stay capped at 10. See [docs/deviations.md](docs/deviations.md).
- 2026-10-15: **Refund resources when troops are destroyed.** 90% of the training cost, up to a per-player refund credit that training adds to, for troops and fortifications (injured troops still refund nothing). See [docs/deviations.md](docs/deviations.md).
- 2026-10-15: **Sort imports alphabetically, enforced by the linter.** `import-x/order`, `sort-imports` and `tools/eslint/import-spacing.mjs` in `eslint.config.js` (AGENTS.md, Formatting and linting).
