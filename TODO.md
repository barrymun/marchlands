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
  - Pixel art, committed as small PNGs and served by nginx as hashed static files (AGENTS.md, Client, Game art): no image server needed while the art stays this small.
  - Buildings: all 19 buildings are drawn for every level band (isometric pixel art, `tools/art/buildings/`), shown in the Town and Fields views as an isometric scene (filling the view, to drag and zoom: the buildings spaced out on a diamond of grass round a grand 2×2 Town Hall, with the walls, towers and gate round it; the fields as a second diamond) or as square slot cards that scroll (Grid, and always on screens narrower than `md`). The walls are a pixel-art frame round the buildings inside the walls, from a wooden palisade to a fortress, with the Town Hall centre-top and the gate opening the Walls.
  - Map tiles: the seven valley types, players' castles and barbarian camps are drawn for every level band (`client/web/src/assets/tiles/`, `tools/art/tiles.ts`) as features standing on the world map's continuous grass.
  - Troops and fortifications: all 12 troops and 5 fortifications are drawn (32×32, side on, `tools/art/troops.ts` and `tools/art/fortifications.ts`) and shown in the Military panel's garrison and defences tables and training cards.
  - Troop badges: a 24×24 badge per troop (`tools/art/badges.ts`) in the garrison table and the send-army dialog.
  - Resource icons: gold, food, lumber, stone and iron are drawn (16×16, `tools/art/resources.ts`) and shown in the resource bar in place of the Lucide icons.
  - Still to draw: hero gear. The 14 pieces (weapon, shield, mount, necklace, charm, ring, head, shoulder, chest, back, gauntlets, belt, legs, feet; `GEAR_PIECES` in `shared/core/src/gear.ts`) have no art: one sprite per piece, richer with the level band like the buildings, the stars shown over it rather than drawn in. Shown in the Heroes panel's gear (`components/hero-gear/`) and the hero items dialog.
  - Still to draw: items. The 53 items (`ItemId`, `shared/core/src/item-ids.ts`) have no art: one icon each, drawn side on like the troops (`tools/art/`, a `PixelCanvas`); medals by level can share a drawing with the level marked. Shown in the Items panel and wherever an item is offered or used (hero items, speed-ups, boosts).
  - Revisit an image service (imgproxy behind nginx's cache, or a CDN) if art changes need to ship without a redeploy, sizes must vary freely (a zoomable map), or images are combined per player (a city with its alliance flag).
- [ ] **Chat in the client.**
  - Now: the server has the world, alliance and beginner channels and whispers (`/api/v1/chat/…`, see [docs/api-endpoints.md](docs/api-endpoints.md), chat) and pushes new messages (`PushCmd.CHANNEL_CHAT_MESSAGE`, `ALLIANCE_CHAT_MESSAGE`, `PRIVATE_CHAT_MESSAGE`), but the client shows no chat and handles none of those pushes.
  - Plan: a chat in the desktop bottom bar (the space between the player and the menu was left for it, as in the original), and a Chat screen or sheet on phones: channels as tabs, whispers, live through the WebSocket push, muted players respected.
- [ ] **Mail in the client.**
  - Now: the server has an inbox, system mail and sent mail, reading, sending, deleting and unread counts (`/api/v1/mail/…`, alliance circulars at `/api/v1/alliance/mail`) and pushes new mail (`PushCmd.NEW_MAIL`), but the client shows no mail.
  - Plan: a Mail page (folders, reading, writing and replying to a player, deleting) in the menu beside Reports, with the unread count on its menu button.

## Done

Newest first, with the date it was finished.

- 2026-10-18: **Rework the map's UI.** The world map is isometric like the original: valleys, castles and barbarian camps drawn as pixel art on continuous grass, on a canvas that fills the view. Drag it (or swipe on a phone) to look round, with the arrows, the home button, zoom and the keyboard as well; it loads the squares coming into view and wraps round the world's edge (AGENTS.md, Client, Game art).

- 2026-10-15: **Rework gear power.** 1 point per piece level (140 for a level 10 set), star N adds N (770 for 10 stars on every piece), a new set bonus of 14 per star level every piece has reached (140), and star costs doubled (2 medals for stars 1-9, 6 Nation Medals for star 10). A maxed hero reaches 1,229. The worker re-applies gear to every hero at start-up. Stars stay capped at 10. See [docs/deviations.md](docs/deviations.md).
- 2026-10-15: **Refund resources when troops are destroyed.** 90% of the training cost, up to a per-player refund credit that training adds to, for troops and fortifications (injured troops still refund nothing). See [docs/deviations.md](docs/deviations.md).
- 2026-10-15: **Sort imports alphabetically, enforced by the linter.** `import-x/order`, `sort-imports` and `tools/eslint/import-spacing.mjs` in `eslint.config.js` (AGENTS.md, Formatting and linting).
