# TODO

Planned work for future updates. Ideas still being weighed and known quirks are in [docs/backlog.md](docs/backlog.md); once an item here changes a game rule, document it in [docs/deviations.md](docs/deviations.md) and keep its numbers in `BALANCE` (`shared/core/src/balance.ts`).

## Gameplay

- [ ] **Historical cities.**
  - NPC cities at levels 12, 14, 16 and 18, with a single level 18 city at (0, 0).
  - Capturing one lets its owner draft troops from the neighbouring NPC cities: a share of each city's troops (50%?), once per day (to decide).
  - To decide: how they are captured and held, what "neighbouring" means (radius or zone), and what happens to drafted troops when the city is lost.

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
