# Animated town, fields and map

**Status:** built (2026-10-20), every phase below. TODO.md item: *Animate the town and fields* (Done).

**The aim:** the isometric Town and Fields views, and the world map, feel lived in. Smoke rises, sails and wheels turn, people walk the streets and work the fields, and buildings show what they're doing: a blazing beacon when an enemy army is on its way, troops drilling while a barracks trains, scaffolding while something is built. Most of it is ambient. The rest shows the city's real state at a glance, without reading queues.

**No database migrations.** Everything here is drawn by the client from data it already has.

## Where things stand

- **The views:** the Town, Fields and Map views are drawn on one canvas each by the isometric viewport (`client/web/src/components/iso-viewport/`). It redraws when the camera moves or an image loads, never on a timer. The town's sprites come from `components/buildings-panel/iso-grid/`, the map's from `components/map-panel/world-map/`.
- **The art** is drawn in code by `npm run art:draw` (`tools/art/`): one 64×64 sprite per building and level band (`tools/art/buildings/`), with a small isometric canvas (`tools/art/iso.ts`). Its primitives already draw the things that should move: `smoke`, `fire`, `sails`, `wheel`, `banner`, `anvil`, `horse`, `sheep`, `well`, `windows`, `cart`, `mineEntrance`, `outcrop`. They are all still.
- **What the client knows** about a city, for state-driven animations:
  - buildings with their status and end time (construction);
  - troops, injured troops, fortifications, heroes, population, resources and alliance (`CityBean`);
  - the research, troop and fortification queues, as the sidebar's In progress list already loads them (`components/activity-dock/hooks.ts`);
  - armies: enemy, own and allied (`getArmiesOptions`).

## Decided

- **Spots from the art scripts** (2026-10-20). The iso canvas records where each animated primitive lands (a chimney's smoke, a windmill's hub, a wheel, a banner, an anvil, each lit window), and `art:draw` writes them to `client/web/src/assets/spots.json`, keyed by sprite file (`buildings/forge-2.png`). The client places every animation from them, so nothing is positioned by hand and a redrawn sprite carries its spots along.
- **Moving parts get a bare sprite.** A turning windmill or water wheel can't be drawn over the still one, so a building with sails or a wheel also gets `<name>-<band>-bare.png`, drawn without them. The scene draws the bare sprite and the turning part over it; the Grid's cards keep the still sprite.
- **Small frames are made in the client, in code.** Smoke puffs, sparks, flames, dust, walkers, sails, wheels, rain and the like are generated as pixel art at the art's own size by pure functions (tested, with seeded variety), cached as small canvases, and scaled up crisp like the sprites. No extra PNGs, so the size budget barely moves.
- **One canvas, redrawn at a pixel-art pace.** While anything moves, the viewport redraws its whole scene about 12 times a second, with the animated pieces sorted into the scene by depth, so a walker passes behind a building and in front of the next. The town has a few hundred pieces and the map a few thousand, cheap at that rate. The redraw is driven by the clock, never by React rendering, and stops when nothing moves.
- **Seeded and out of step.** Every loop starts at a phase seeded by its building and position, so the town never moves in lockstep, and the same city looks the same on every visit.
- **Polite.** Animation pauses while the tab is hidden, and the player's reduced-motion setting turns it off (the scene then shows the still sprites).

## What moves

### Inside the walls

| Building | Always | While it's working |
|---|---|---|
| Town Hall | Banners wave | Construction |
| Cottage | Smoke from the chimney (when it has one) | Construction |
| Barracks | Banners wave | Recruits drilling in step while its training queue runs |
| Warehouse | — | Construction |
| Stable | Horses shift and swish | A rider trotting while cavalry trains |
| Inn | Banner, a horse at the rail | Construction |
| Forge | Smoke from its chimneys, glowing windows | Sparks over the anvils while fortifications are made |
| Marketplace | Banners | Construction |
| Relief Station | — | Wounded carried in while there are injured troops |
| Academy | — | The dome window glowing while research runs |
| Workshop | — | Sawdust at the logs while siege engines train |
| Feasting Hall | Smoke, banners | Construction |
| Embassy | Banners | Construction |
| Rally Spot | Banners | Troops forming up while one of the city's armies is out |
| Beacon Tower | A small flame | **The beacon blazing while an enemy army is on its way** |

### The fields

| Building | Always | While it's working |
|---|---|---|
| Farm | Windmill sails turning (its top band has the windmill), sheep wandering and grazing | Construction |
| Sawmill | Water wheel turning (bands 3 and 4) | Construction |
| Quarry | Dust drifting off the rock | Now and then a blast: a flash, rubble and a dust cloud |
| Iron mine | Smoke, the wheel turning (bands 2 to 4) | Construction |

### Anywhere

- **Construction:** scaffolding round the slot, builders with hammers, dust, while a building is built or upgraded.
- **Level up:** a short sparkle when a building finishes a level.
- **People:** walkers on the grass between the slots, more as the population grows; workers in the fields.
- **Day and night:** the scene darkens at night by the player's own clock, windows light up and torches burn.
- **Weather:** now and then rain, snow in winter, or a storm with lightning, chosen with seeded randomness from the date and the city's state, so everyone in a state sees the same sky. Later the market design's acts of god (floods, storms) can drive it ([market-and-factions.md](market-and-factions.md), Acts of god).
- **After an attack:** smoke and small fires over the town for a while after it was attacked, from the city's recent reports.

### The world map

- **Armies marching:** each army the player can see moves along its route, from its start to its target, by its timings.
- **Barbarian camps:** campfire smoke.
- **Lakes:** glints on the water.
- **The player's valleys:** workers.

## Rules and numbers

Everything here is cosmetic: it changes nothing in the game. So its numbers live in `client/web/src/components/iso-anim/constants.ts` and the frame functions in `utils.ts`, not in `BALANCE` (which is for game rules). Times are the page's own clock unless they say real time.

### Pace

- **The redraw:** about 12 times a second (`ANIMATION_FPS`), on the browser's animation frames, which stop while the tab is hidden. Only while something moves: no `animate`, or reduced motion, and the scene is drawn once, still.
- **Out of step:** every loop starts at a phase seeded by its sprite and spot (`hash`), so no two chimneys or banners move together, and a city looks the same on every visit.
- **Frame rates** (frames a second, frames in the loop):

  | Animation | Rate | Loop |
  |---|---|---|
  | Chimney smoke | 6 | 10 (three puffs rising at once, `SMOKE_PUFFS`) |
  | Flames (beacon, campfires) | 8 | 6 flickers |
  | Windmill sails | 5 | 6 frames to a quarter turn (their pattern repeats every quarter) |
  | Water wheel | 6 | 6 frames to an eighth of a turn (eight spokes) |
  | Banners | 3 | 4 (one still) |
  | Furnace windows, academy windows | 3 | 6, brighter and dimmer |
  | Horses' tails | 4 | 6 (a flick on two of them) |
  | Sheep | 2 | 8: grazing head down, looking up on the last two, stepping on the odd ones |
  | Quarry dust | 6 | 12 |
  | Glints on lakes | 3 | 6 |
  | Construction | 6 | 8: hammers up and down, dust on the last three |
  | Walkers, workers, riders, marching armies | 6 (5 for the stretcher) | 2 steps |
  | Drill and muster | 4 | 4 |
  | Forge sparks | 8 | 8 (sparks on the first three: the hammer falling) |
  | Workshop sawdust | 8 | 6 |
  | Academy dome twinkle | 4 | 4 |
  | Lit windows at night | 2 | 4, flickering a little |

### Things that happen now and then

- **Quarry blasts:** one every 18 seconds (`BLAST_EVERY_S`), each quarry at its own moment (seeded): a white flash, rubble thrown out and falling, and a dust cloud that swells and fades, 10 frames at 8 a second, a little over a second.
- **The sparkle:** for 1.25 seconds (`SPARKLE_MS`) after a building finishes a level. It comes from the build-complete push, noted with the page's clock (`lib/build-events.ts`), so it only shows for a level finished while the page is open; a reload forgets it.

### People

- **Walkers in town:** `townWalkers` (`components/buildings-panel/utils.ts`): the square root of the current population, divided by 6 and rounded, between 2 and 16 (900 people make 5, 3,600 make 10).
- **Workers in the fields:** `fieldWorkers`: one for every two fields built, rounded up, up to 10; none with no fields.
- **Where they walk:** the streets are the lines of grass midway between neighbouring slots, plus one beyond each end (`streetsOf`); a big slot (the 2×2 Town Hall) blocks those through it. Each walker follows a seeded route of 12 crossings (`ROUTE_STEPS`) there and back again, never turning straight back if it can help it, at 0.4 tiles a second (`WALK_SPEED`), in seeded clothes.
- **Pacing figures** (a rider at the stable, a stretcher at the relief station, a worker on a valley) walk back and forth along the ground, 9, 8 and 6 pixels each way.
- **Sheep** wander a pixel or two either side of where the farm draws them, slowly, turning as they go.

### What the buildings show, and when

- **The city's state** (`townState`) comes from the training, research and fortification queues (the sidebar's queries, from its cache, each only when the city has the building), the armies, and the first page of army reports (10). It is loaded only while the Scene is showing and motion is allowed.
- **A barracks drills** while its own queue has a batch running (started and not finished). The **stable's rider** shows while cavalry or cataphracts are training anywhere in the city; the **workshop's sawdust** while ballistae, rams or catapults are.
- **The forge's sparks** while fortifications are being built; **the academy** while this city researches.
- **The relief station's stretcher** while the city has any injured troops.
- **The rally spot's muster** while any of the city's armies is away (by its city, or by setting out from its tile).
- **The beacon blazes** while an enemy army is heading for this city's tile: its flame 2.4 times as high, with smoke, in place of the small one.
- **Construction** shows on a building whose status isn't 0 (building or upgrading).
- **A dimmed building** (filtered out by the tags) stays still.

### Day, night and weather

- **Night** follows the player's clock (`darknessAt`): full from 21:00 to 05:00, fading in from 18:00 and out by 08:00. The scene is darkened by a deep blue at half strength at most, over what is drawn only, so the empty background stays as it is.
- **Lit windows** come on when the clock's darkness is past 0.4 (`isNight`); weather doesn't light them. Flames, furnace and academy windows, sparks and the dome twinkle shine over the dark too.
- **Weather** (`weatherAt`) is drawn for each state and four-hour block of the day (UTC), seeded, so it holds for a few hours and everyone in a state sees the same sky:

  | Weather | Chance | Notes |
  |---|---|---|
  | Clear | about 78% | |
  | Rain | about 17% | snow in its place from December to February (by UTC month) |
  | Storm | about 5% | |

- **Rain and storms darken** the sky further, by 0.15 and 0.35 of night, on top of the clock's darkness (which counts for 0.85 of it), at most full night.
- **Drops and flakes** (`particlesAt`), in CSS pixels of the view: one raindrop for every 5,000 square pixels, one in a storm for every 2,500, one flake for every 6,000, at most 600. Rain falls at about 520 pixels a second (700 in a storm), a pixel across for every two down, as a 6-pixel streak (8 in a storm); snow drifts down at about 40 a second, swaying 6 pixels either way.
- **Lightning** (`flashAt`): every 11 seconds in a storm, each state at its own moment: a full flash for 0.08 seconds, a glow until 0.25, and a flicker at 0.4.
- **On the map** the sky is the state under the camera's middle (`zoneOf`); in the town and fields, the city's own state.
- **Acts of god aren't built yet** ([market-and-factions.md](market-and-factions.md), Acts of god): today's weather is cosmetic only and changes nothing in the game.

### After an attack

- **Found from reports:** the city counts as attacked at the newest "city attacked" or "attack repelled" report among the first page of army reports whose target is its coordinates. An attack older than those ten reports isn't seen.
- **Fires and smoke** over up to 4 buildings (`AFTERMATH_FIRES`), picked with a seed from the attack's time (the same ones each visit), for 30 minutes of real time (`AFTERMATH_MS`): as many as 4 × the share of the time left, rounded up, at least one, so they die down as it goes.

### The map

- **Campfires** burn at every barbarian camp, and **lakes and swamp pools glint**, from their tiles' spots.
- **Workers:** one on each of the player's valleys in view, pacing about its middle.
- **Armies** the player can see (own, allied and enemy, from the armies list) march between their start and target by their timings: back the other way while returning, standing at the target while staying. They take the shorter way across the map's edge and are drawn at the copy nearest the camera. Their banners are blue (own), green (allies) or red (enemies).

## Phases

In this order, each checked in the browser. **All done 2026-10-20.**

1. **The animation layer** in the viewport: the spots file, bare sprites, generated frames, the clock-driven redraw, reduced motion and pausing.
2. **Ambient loops:** the field buildings (sails, wheels, quarry dust and blasts, mine smoke, sheep) and chimney smoke in the town, banners, horses, furnaces.
3. **Construction:** scaffolding, builders and dust while a building is built or upgraded, and the sparkle when it finishes.
4. **Walkers:** people on the town's grass and in the fields.
5. **State-driven buildings:** the beacon, barracks drill, forge sparks, academy glow, stable rider, relief station, rally spot, workshop.
6. **Day, night and weather.**
7. **After an attack, and the map:** smoke and fires after an attack, marching armies, campfires, glints on lakes and workers in the player's valleys.

## How it's built

- **Spots** (`tools/art/pixel.ts`, `Spot`; `tools/art/iso.ts`): `smoke`, `fire`, `sails`, `wheel`, `banner`, `anvil`, `horse`, `sheep`, `windows` (`window`, and `glow` for furnace windows), `dome`, `mineEntrance` (`mine`), `outcrop` (`rock`), `crops`, `logs`, `well`, `tent`, `stall`, `dummy` and `catapult` each record where they drew; tiles record their lakes and swamp pools (`water`). `npm run art:draw` writes them to `client/web/src/assets/spots.json`, keyed by `<folder>/<file>`, merged so a partial redraw keeps the rest.
- **Bare twins:** a sprite with sails, a wheel or sheep (`MOVING` in `tools/art/draw.ts`) is drawn a second time without them (`IsoCanvas.bare`) as `<name>-<band>-bare.png` (`bareArtFile`). The scene draws the bare twin with the moving parts over it; the Grid's cards keep the still sprite. `lib/game-art.test.ts` checks every sprite with moving parts has its twin.
- **The viewport** (`components/iso-viewport/`): pieces are sprites or `Overlay`s (a `PixelArt` frame placed in art pixels from a tile's middle). With `animate` it redraws at ANIMATION_FPS on the browser's animation frames (which stop in a hidden tab) while `useMotion` allows; `sky` adds night (a deep blue over what is drawn, `source-atop`), weather particles and lightning, with overlays marked `light` drawn over the dark.
- **The animations** (`components/iso-anim/`): `utils.ts` makes every frame in code (`pixelArt`, cached by id) and decides what shows: `ambientOverlays` (spots), `buildingOverlays` (ambient plus the city's state), `constructionOverlays`, `sparkleOverlays`, `walkerOverlays` on `streetsOf` a grid, `aftermathOverlays`, `skyAt`, and on the map `armyOverlays` and `workerOverlays`. It is its own file of the build, fetched after the first page by `useAnimations` (`hooks.ts`); until it arrives, and with reduced motion, scenes are still.
- **The city's state** (`components/buildings-panel/hooks.ts`, `useTownState`; the pure `townState` in `utils.ts`): the training, research and fortification queues (the sidebar's queries, from its cache), the armies and the latest army reports, loaded only while the scene animates.
- **A finished level** is noted by the build-complete push (`lib/build-events.ts`), on the page's clock, for the sparkle.
- **No migrations,** and nothing new on the server.

## Open questions

- **A player switch:** besides reduced motion, should players be able to turn animation off in the game (Player settings)?
- **Weather and events:** when acts of god arrive, should weather follow them only, or keep its own random skies too?
- **Not built yet:**
  - a hero for hire at the Inn (it needs the Inn's hero list, which the town doesn't load);
  - the marketplace's awnings moving, guards on the walls and the gate opening;
  - the market ticker, which belongs to the market overhaul.
