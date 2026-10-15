# TODO

Planned work for future updates. Ideas still being weighed and known quirks are in [docs/backlog.md](docs/backlog.md); once an item here changes a game rule, document it in [docs/deviations.md](docs/deviations.md) and keep its numbers in `BALANCE` (`shared/core/src/balance.ts`).

## Gameplay

- [ ] **Refund resources when troops are destroyed.**
  - Now: disbanding returns nothing (`BALANCE.disbandRefund: 0`, used by `disbandTroops` in `backend/packages/game/src/services/training.ts`), and destroying fortifications (`destroyForts`) refunds nothing either.
  - Plan: return most of the training cost, e.g. 90% (decide the share). Decide whether fortifications get the same refund.
- [ ] **Rework gear power.**
  - Now: a piece at level `n` gives 1 + 2 + … + n points (`gearLevelPoints` in `shared/core/src/gear.ts`), so a level 10 set with no stars gives 55 × 14 pieces = 770. Each star adds 3 points (`BALANCE.heroGear.starPoints`).
  - Plan: 1 point per level per piece, so a level 10 set with no stars gives 1 × 10 × 14 = 140.
  - Stars may go beyond 10 (`BALANCE.heroGear.maxStars`). Stars 9 and 10 (and above) could then give a very large boost: model the numbers before deciding.
  - Make a full level 10 star set much harder to reach: raise the medals each star costs (`gearStarCost`; today stars 1–9 take one medal of that level and star 10 takes `lastStarMedals` = 3 Nation Medals).
  - Existing heroes' gear points change, so check the effect on current players and battles (`npm run sim`).
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

## Code quality

- [x] **Sort imports alphabetically, enforced by the linter.** `import-x/order`, `sort-imports` and `tools/eslint/import-spacing.mjs` in `eslint.config.js` (AGENTS.md, Formatting and linting).
