# Market overhaul: NPC trade, factions and new charts

**Status:** design. Nothing built yet. TODO.md item: *Overhaul the marketplace mechanics.*

**The aim:** a market that feels alive. NPC cities trade with each other all the time, so prices move for reasons players can see and influence: plunder, war, shortages. The charts and a live ticker show it. NPC cities belong to factions, which remember how each player has treated them.

## Where things stand

**The market today** (`backend/packages/game/src/services/market.ts`, `src/engine/market.ts`, `shared/core/src/merchant.ts`, `BALANCE.merchant`; deviations.md, Market):

- Players post buy and sell orders (`market_orders`), limit or market, up to 2 resting orders per Marketplace level. Trades settle at once (`BALANCE.marketShipmentBaseMs = 0`) with a 0.5% fee on the gold paid.
- A computer merchant always buys and sells every resource. Its curve mode is written and tested: a reference price that moves with its trades along an exponential curve, a ±5% spread, a drift back to its base price (half-life 6 game hours), and a worker job every 10 s that fills resting orders its price has crossed.
- **The merchant is in fixed-price mode** (`fixedPrice: 1`): it buys and sells everything at exactly 1.00 gold, in any amount. No player can beat it, so every trade goes through the merchant and the order book is unused.
- Every fill is a row in `market_trades`: 822 rows, 224 kB on the dev stack (about 270 bytes a row with its indexes). The price candles (one game hour each) are built from those rows every time the market is opened.
- The Market page draws its price history with recharts (`components/market-panel/price-history/`, through shadcn's `components/ui/chart.tsx`), the only place recharts is used.
- The tax rate also sells a share of each city's field output to the merchant at its price (`merchantBase`); see deviations.md, Tax.

**The NPC cities** (counted on the dev stack, 2026-10-19). There are 51,217 on the 800 × 800 map (640,000 tiles), spread over the 16 zones (Friesland … Romagna):

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cities | 9,284 | 8,499 | 7,424 | 6,374 | 5,472 | 4,756 | 3,713 | 2,847 | 1,858 | 990 |

- An NPC city keeps nothing in the database until it is touched: `tiles.troops`, `forts` and `state` stay null while it is at full strength, and are worked out when read (regeneration is lazy). 54 of the 51,217 have any state at all.
- Their resources regenerate +1/80 of the maximum every 6 game minutes, and gold matches their largest resource (deviations.md).
- None trade today, and none belong to anything bigger than their zone.

## Decided

- **The economy is a (relatively) deep game in its own right,** not only colour around combat (2026-10-19). So the plan goes past phase 3: events that move prices, factions with relations, and tools for players who want to trade seriously (scripts, below).
- **Charts: TradingView Lightweight Charts** (v5, Apache 2.0, canvas, about 35–45 kB gzipped), for candles, volume, depth and the live ticker on the Market page.
  - It is loaded with the Market page only (a lazy screen), and replaces recharts there.
  - recharts has no other users, so it, `components/ui/chart.tsx` and recharts' share of the market's size budget can go. Check the budget (`client/web/.size-limit.js`, *market tab*) with a build.
  - The new dependency is pinned to an exact version at least two weeks old (AGENTS.md).
  - **Credit:** in README.md, with TradingView's logo. *To check before shipping:* as I understand the library's NOTICE, turning off the logo it draws on the chart (`attributionLogo`) needs a link to tradingview.com that every user of the app can reach (a footer, or an About or credits screen). The README only reaches developers. Either keep the chart's logo, or add an in-game credit as well.
- **recharts' `^3.8.0`:** pin or remove it with this work. Removing it is likelier, since Lightweight Charts takes over its only use. About 30 other dependencies also use `^` versions; they predate the exact-pin rule (which applies to new dependencies), and pinning them is a separate tidy-up.
- **Factions trade, and player actions move their prices:** plunder a faction's cities and its stock falls, so its prices rise. Two factions at war stop trading with each other and demand iron, so shortages appear. A live ticker shows the NPC trades ("The Saxon League bought 2M iron at 0.62").

## How every NPC city can trade without flooding the database

The goal is the activity of 51,217 traders. A trade per city per row would be far too much:

| NPC trading, a row per trade | Rows a second | Rows a day | Size a day |
|---|---|---|---|
| Each city trades once a game hour, game speed 1 | 14 | 1.2 million | about 330 MB |
| The same at the dev stack's game speed 60 | 850 | 74 million | about 20 GB |

Nobody can read 14 trades a second anyway. So **simulate the crowd, store the summary, and make up the individual trades only to show them.**

1. **Cohorts, not 51,217 agents.** NPC cities of the same faction, zone and level behave alike, so each such group is one agent: a cohort with a member count. That's at most 160 cohorts (16 zones × 10 levels). A cohort's stock is its members' full-strength stock times the count, less what plunder has taken from the few members with stored state (54 today: one query over `tiles` where `state` is set). A tick works out every cohort's supply and demand in memory, a few hundred numbers, with no row per city.
2. **One clearing per tick.** Each tick (every real minute, say, or every game hour), the cohorts' supply and demand curves for each resource meet at one price, a batch auction. That gives the tick's price, the volume traded, and how many cities took part.
3. **Store the summary only.** A tick writes one candle per resource per scope (`market_candles`: resource, scope (the world, a faction or a zone), bucket start, open, high, low, close, volume, trade count). That's 4 rows for the world, plus 4 per faction if factions get their own charts. NPC-to-NPC trades are never stored one by one.
4. **Roll up and expire.** Minute candles roll up into hours and hours into days. Fine candles older than a week or so are deleted. Charts read candles, never trades, so opening the market stays cheap however busy it is. This also replaces building candles from `market_trades` on every read.
5. **A made-up ticker.** For the ticker, each tick's result is split into a handful of plausible single trades: real cohort members, picked with seeded randomness like the map's art ("Wittenberg (level 6, Saxony) sold 40,000 lumber at 0.31"). They add up to the tick's volume. They're pushed to whoever has the market open over the WebSocket, and the last 50 or so are kept (in `world_state`, like the merchant) for whoever opens it next. They're never stored as trades.
6. **Players' trades stay real rows.** A trade with a player in it is still a row in `market_trades`: their history, statistics and escrow need it. Players meet the NPCs through the order book: each cohort shows a few resting orders, a short ladder of prices around its quote, and a player's order fills against them. That's one row per fill, as today.
7. **Determinism.** Seed each tick's randomness with its time and the cohort, as the map seeds its art, so a tick can be re-run and tested (`g.advance`, `g.runDue` in the game tests).

So **every city appears to trade, and the charts show the whole crowd's activity, at a factions-sized cost.** Factions then decide who trades with whom and at what price.

## Ideas being weighed

### NPC economy

- **Stock against a target:** each cohort aims for a target stock of each resource, set by its zone's terrain and the faction's specialism. A cohort below target bids more; above target, it asks less.
- **Resources have to leave the world as well as arrive:**
  - **Sinks:** NPCs use resources up through troop upkeep, building and the wars between factions. Without that, they only ever sell and prices only ever fall.
  - **Gold:** gold leaves through the fee and the merchant's spread.
- **The merchant becomes a last resort:** curve mode with a wide spread (buying at about half the market price, selling at about twice), so the market never seizes up but factions and players always offer better prices. This is mostly `BALANCE.merchant` (`fixedPrice: null`, a bigger `spread`). The tax rate's sale to the merchant (`merchantBase`) needs a rethink alongside it.
- **Events:**
  - Plunder lowers a cohort's stock.
  - Wars between factions raise their demand for iron and food.
  - Optionally: seasons and harvests, or shocks such as a plague in a zone.
- **Regional prices (later, optional):** a price for each zone or faction rather than one for the world, with the original game's travel time brought back (`marketShipmentBaseMs`). That allows buying cheap here and selling dear there. Later still, NPC caravans could travel the map, and players could raid them.

### Factions

- **Membership:** a faction is a few zones, or one each; its cities are the NPC cities there. Possibly only from some level up (see open questions).
- **Each faction has:** a name, a flag, a home region, a resource it specialises in, and a temperament (trading, warlike, keeping to itself).
- **Reputation:** each player has a standing with each faction, from -100 to 100, that drifts back towards neutral.
  - **Trade:** good standing gives better prices on that faction's orders, and perhaps goods only it sells. Bad standing means it won't trade with you.
  - **Combat:** attacking a member lowers your standing with its faction, and may raise it with that faction's rivals.
    - A faction you have angered could send reinforcements to a member under attack (this fits the planned historical cities, which let their owner draft troops from neighbouring NPC cities).
    - At worst, it could raid your cities. That needs armies led by NPCs, which the game doesn't have yet.
  - New players are exempt from retaliation (beginner protection).
- **Relations between factions:** alliances, wars and embargoes, which change who trades with whom and so cause the shortages. They could also give quests ("deliver 1M iron to the Saxon League" for standing).
- **The main risk:** attacking barbarians is the core of single-player play. If factions hit back too hard, that becomes a chore. Keep the low levels unaligned "bandits", and keep every effect tunable in `BALANCE`.

#### Membership (proposal, not decided)

**What the map gives us** (counted on the dev stack, 2026-10-19):
- The 16 zones are a 4 × 4 grid of 200 × 200 tiles (`stateOf` in `shared/core/src/world.ts`, `BALANCE.stateGrid`), laid out roughly like the real places, Friesland in the north-west and Romagna in the south-east.
- They're nearly identical. Each has 3,113–3,291 NPC cities, 837–948 of them at level 6 or higher. Each has the same mix of valley types, give or take a factor of two (forest 945–2,056 tiles per zone, lakes 854–2,112).
- So a faction's character can't come from its land. It's designed, and written down as data.

**Membership is worked out, not stored.** An NPC city belongs to the faction that holds its zone, if its level is at least `BALANCE.factionMinLevel`. Nothing is stored per city:
- 51,217 cities cost no rows, and no migration is needed when the rules change.
- It matches the trading groups (zone × level), so a faction's members are just some of those groups.

What is stored is small:
- the factions themselves (a handful of rows);
- which faction holds each of the 16 zones (16 entries, in `world_state` or a `faction_zones` table);
- the relations between factions (one entry per pair);
- each player's standing with each faction (a row per player per faction they've dealt with).

**Five factions, each a block of neighbouring zones** (working names; display names would live in a `data-factions` locale namespace like other game data):

| | West | | | East |
|---|---|---|---|---|
| **North** | Friesland *(Saxon)* | Saxony *(Saxon)* | North March *(Saxon)* | Bohemia *(Bohemian)* |
| | Lower Lorraine *(Lotharingian)* | Franconia *(Franconian)* | Thuringia *(Franconian)* | Moravia *(Bohemian)* |
| | Upper Lorraine *(Lotharingian)* | Swabia *(Franconian)* | Bavaria *(Franconian)* | Carinthia *(Bohemian)* |
| **South** | Burgundy *(Lotharingian)* | Lombardy *(Italian)* | Tuscany *(Italian)* | Romagna *(Italian)* |

- **Saxon League:** Friesland, Saxony and North March (3 zones, north).
- **Lotharingian Crown:** Lower Lorraine, Upper Lorraine and Burgundy (3, west).
- **Franconian heartland:** Franconia, Thuringia, Swabia and Bavaria (4, centre). It borders every other faction, so it's the crossroads where trade and wars meet.
- **Bohemian Crown:** Bohemia, Moravia and Carinthia (3, east).
- **Italian League:** Lombardy, Tuscany and Romagna (3, south).

Counting member cities at level 5 and above, the four three-zone factions would have 3,612–3,737 each, and the Franconian heartland, with four zones, 4,958.

**Low levels stay unaligned.** Levels 1–4 (31,581 cities, 62%) are bandits:
- they belong to no faction and don't trade;
- attacking them costs no standing, so the usual farming is untouched;
- perhaps clearing bandits even raises your standing with the faction whose land they're on.

Levels 5–10 (19,636 cities) are members. Where the line falls is one number in `BALANCE`.

**A character for each, by design:**
- **Strong and short in a resource,** for example:
  - the Italian League rich in food and gold and short of iron;
  - the Bohemian Crown rich in iron and stone and short of food.

  That makes trade between them worth something.
- **A temperament:** trading, warlike or keeping to itself.
- **A flag.**

These would sit in a core data file. Its numbers (target stock, how warlike) would go in `BALANCE`.

**Borders can move.** A war between factions could, rarely, change who holds a zone. That changes one of the 16 entries, and every NPC city in the zone changes sides with it: dramatic on the map, and cheap.

**Players:**
- A player isn't a member of any faction, but has a standing with each.
- Where a player's city stands could still matter: the faction holding your zone is your nearest market, and the first to notice what you do.

### Historical cities: seats of power

The historical cities (TODO.md, *Historical cities*) and the factions fit together: **a historical city is the seat of power over an area of the map.** An NPC faction holds it until a player takes it. The bigger the city, the bigger its area and the more it brings its holder.

**One area per seat, nested in a grid,** following the original game where it had them: Age 2's historic cities, in [reference/historic-cities.md](../reference/historic-cities.md). Areas are worked out from coordinates, like membership, with nothing stored per tile.

| Seat | How many | Area it rules | Where | From |
|---|---|---|---|---|
| Level 18 | 1, Atlantis | the whole world, lightly | (0, 0), in Friesland. The map wraps, so this is where the corners of Friesland, Bohemia, Burgundy and Romagna meet | Age 2 |
| Level 16 | 16, one per state | its state, 200 × 200 tiles | the middle of each state, (x0 + 100, y0 + 100): (100, 100), (300, 100) … (700, 700) | Age 2, exactly |
| Level 14 | 128, eight per state | its cell of a 3 × 3 grid over the state, about 66 × 66 tiles (the middle cell is the level 16's) | (x0 + a, y0 + b) for a and b in {33, 99, 165}, except (99, 99) | Age 2, exactly |
| Level 12 | 1,920, 120 per state | its 18 × 18 cell (Age 2's draft area, 4 drafts a day) | every 18 tiles from offset 9 across and down, (x0 + 9, y0 + 9) … (x0 + 189, y0 + 189), leaving out (99, 99) beside the capital | Age 2's rule; the list is our reading of it |

- Every position is the original's (Age 2), and they already fit our map: the same 16 states on the same 200 × 200 grid (`stateOf`).
- **1,920 level 12s is a lot,** against 51,217 ordinary NPC cities. In Age 2 they were the common first prize and a stepping stone towards the bigger cities. We could keep them all, or use fewer (every other place), which leaves a level 12's draft area 36 × 36 instead.
- One source marks two of Romagna's level 14 places "Atlantis", which doesn't fit Atlantis at (0, 0) (reference note). We'd place all 128.
- **What Age 2 gave the holder** (reference note): a level 12 drafts 4 times a day from its 18 × 18 area, and every historic city raises the largest army its holder can send from it: 125,000 from a level 12, 150,000 from a level 14, 200,000 from a level 16 (a quarter more with a War Ensign). A captured historic city became the player's own city.
- The seats are new NPC cities at levels above today's 10, placed by a migration over whatever tile is there.
- Historic cities aren't in Age 1, so adding them is a deviation (*(design change)* in deviations.md, pointing to the reference note).

**What holding a seat brings, scaled by its size.** Each benefit applies to the seat's area:

- **Troops:** draft a share of the troops of the NPC cities in the area, once a day. This answers the TODO's open question: "neighbouring" means the seat's area. In Age 2 a holder could also draft from *players'* cities in range, and players hid their troops by reinforcing allies, since reinforcements can't be drafted ([reference/historic-cities.md](../reference/historic-cities.md), Drafting). That would undo much of our decision that players' cities can't be captured, so the proposal is NPC cities only.
- **Tribute:** a share of what the area's NPC cities produce or earn by trading, paid in gold or resources. Age 2's colonies are a ready model: the suzerain took a share of production and one policy a day (draft, disarm, take population, sow discord), and the colony could rise up ([reference/colonies.md](../reference/colonies.md)).
- **Market rights:**
  - a share of the fees on trades in the area;
  - with regional prices, a say over the area's market: a toll or tax rate within limits, or an embargo on a faction or player;
  - better prices with the factions that like you.
- **Knowledge:** the area's forecasts sooner or more accurately. The NPC groups' stock and wants in the area are visible.
- **Relief:** spend to shield the area from acts of god (dykes against floods, granaries against drought). That's good for the holder and for every player there.
- **Prestige and title:**
  - A level 16 makes its holder that state's ruler, such as Duke of Saxony.
  - The level 18 makes its holder the ruler of the world, an Emperor-like title (a name to choose), with something across the whole map.

**How it ties into factions:**
- **Seats are how borders move.** A state belongs to the faction that holds its level 16 seat. When a rival faction takes that seat, the state and its member cities change sides. That's the "borders can move" mechanism, with an event on the map to show it.
- **Taking a seat from a faction** costs a lot of standing with that faction, and may gain some with its rivals. The faction tries to win the seat back, which is where retaliation (phase 4) matters most.
- **When a player holds a state's level 16,** the NPC members in the state are cut off from their faction. They could stay members but pay their tribute to the player, or become the player's own for drafting and tribute. To decide.

**Keeping it from snowballing.** Seats are prizes for strong players and alliances, so one early player must not be able to take them all.
- **Holding costs something:** upkeep in gold and food that rises with every seat a player holds, and a garrison that has to stay.
- **Limits:** at most one level 16 per player, say. Seats would also count against the city limit if a captured seat is a city.
- **Unrest:** an area may rebel if neglected (no garrison, no relief after a disaster), and the faction attacks it.
- **Alliances:** a seat's benefits can be shared with its holder's alliance, which makes them alliance goals, as the big prizes in Evony were.

**How the database holds it:** a seat is a tile like any NPC city. Its holder is the tile's existing `owner_city_id` and `owner_player_id`, and capturing it uses the barbarian cities' loyalty-to-zero rule (deviations.md). Its area is worked out from its coordinates. So a seat adds no new kind of storage beyond its benefits' timers, such as the daily draft.

### Charts and the Market page

- Candles and volume for each resource, from `market_candles`, with ranges from an hour to a month.
- Order-book depth: players' orders and the factions' ladders.
- The live ticker of NPC trades, and the player's own trades.
- A factions panel: standing with each, who is at war, what each is short of.

### Acts of god (force majeure)

Floods, thunderstorms, droughts, fires, plagues and the like, every so often, damaging what a region produces or holds. A flood ruins crops, so food runs short and its price climbs.

- **Where:** a zone, or a patch of the map, for a while. Players' cities there are hit too, not only the NPCs: less production for a time, or a share of stored stock lost. NPC groups there lose stock and change what they want, so prices react.
- **Warning:**
  - Some events are forecast before they strike, with a probability, like a weather forecast: an almanac in the game. That makes them something to play: lay in food before the drought, sell lumber into the shortage.
  - Others (fire, lightning) come without warning.
  - A forecast that is sometimes wrong keeps it a gamble.
- **Protection:**
  - Some of it is player choice: a bigger warehouse, research (an Almanac, or Irrigation), items.
  - The rest is what the market offers: buying ahead, holding a spread of resources.
  - Perhaps insurance one day, sold by a faction.
- **Shown in the game:**
  - Pixel-art weather over the map and the town (rain, lightning, a drought's cracked earth), drawn like the rest of the art.
  - Event reports in Reports, and notices in the ticker ("Floods in Bohemia: food production halved for 2 days").
  - The almanac's forecast on the Market page.
- **Fairness:**
  - Damage is capped, so one event never wipes out a city.
  - Beginner protection covers new players.
  - Events never pile up on one region.
  - Every number lives in `BALANCE`.
- **How:** a schedule of events drawn with seeded randomness (repeatable in tests, like the map's art), timed events in the worker like everything else, and effects as buffs and debuffs on cities and NPC groups. Each event type is a rule change, so it goes in deviations.md.

### Trading scripts

Players write scripts that trade for them: buy below a price, keep a stock between two levels, sell into a shortage, react to forecasts and events. Events keep it risky: a script that only buys cheap food walks into a flood.

- **Players can already do this today:** the API is public, with its docs at `/docs`, and has no rate limiting. Anyone can run a bot against it from their own machine. Scripts in the game make that fair, open to every player rather than only those who can host a bot, and inside the game's rules. Whatever we build, the API needs a limit on how often a player can place orders (rate limits, a minimum time between trades). An outside bot shouldn't be able to beat an in-game script by trading faster.
- **Three levels, cheapest first:**
  1. **Standing orders and rules** (no code): stop-loss and take-profit, "keep food between 2M and 5M", "buy iron below 0.4, up to 1M a day", "on a forecast of floods here, buy food". This covers most of what players want and is safe and easy to explain.
  2. **A small Marchlands language**, or a rule builder that writes it: conditions on prices, stock, forecasts and standing, and actions that place orders. Parsed and checked on the server; nothing runs but its own instructions.
  3. **TypeScript, in a sandbox,** for those who want it. Running players' code on the server needs a real sandbox:
     - a JavaScript engine compiled to WebAssembly (QuickJS), or V8 isolates (`isolated-vm`);
     - a fuel or time budget, a memory cap, and no network, files or timers;
     - only a game API that sees what the player could see in the client.

     It's the most powerful level and the most work and risk. Even TypeScript would need compiling (type stripping) before it runs.
- **A game mechanic, not a free lunch:**
  - Scripts run in a building or for a hero (a Trading House, or a steward), so their number, how often they run and how much they can trade grow with its level.
  - Each run may cost a little gold.
  - They act only on ticks, with the same delays and fees as a player.
  - A script sees only what the player can see.
- **What a script is told:** the same things a player sees: prices, the order book, its own cities' stock, forecasts, events, faction standing. Never the hidden state of the simulation.
- **Logs:** each run is logged (what it saw, what it did, why it stopped), so players can debug their scripts and the server can be audited.

## Phases

1. **Charts and the merchant.**
   - Lightweight Charts in place of recharts: candles, volume, depth.
   - `market_candles` written as trades happen.
   - The merchant in curve mode with a wide spread.
   - recharts removed or pinned; the README credit.

   Small, and it makes players' own orders matter at once.
2. **Factions and reputation, without trading yet.** Factions and their members, standing from combat, standing shifting the merchant's prices. Membership and its rules are settled here.
3. **NPC trade.** The cohort simulation, clearing each tick, the factions' ladders in the order book, the ticker over the WebSocket.
4. **Relations between factions and retaliation.** Wars, embargoes, reinforcements. Then, maybe, raids, caravans and regional prices.
5. **Seats of power.**
   - The historical cities placed on the map, with their areas.
   - Capturing and holding them.
   - Their benefits: the draft and title first; tribute and market rights once NPC trade exists (phase 3).
   - Seats moving borders, once factions have relations (phase 4).

   This is also the TODO's *Historical cities* item.
6. **Acts of god.** Scheduled events, their effects on cities and NPC groups, the almanac's forecasts, weather in the map and the town. They can start any time after phase 3, once there are NPC prices for them to move.
7. **Trading scripts.**
   - The API's rate limits come first, whenever outside bots become a worry.
   - Then standing orders and rules, then the language, and the TypeScript sandbox only if it's still wanted.

Each phase records its rule changes in deviations.md (*(design change)*) and its numbers in `BALANCE`.

## Open questions

- **Membership:** the proposal (Factions, Membership) is five factions of neighbouring zones, worked out from the zone rather than stored. Is that the shape? And which names, strengths and temperaments?
- **Low levels:** the proposal leaves levels 1–4 as unaligned bandits. Is that the right line, and should clearing bandits raise standing?
- **Prices:** one world price per resource, or prices by region with travel time?
- **Retaliation:** prices only, reinforcing their cities, or raiding yours?
- **Tick:** how often, and in real or game time? Real time keeps the charts' pace the same at any game speed.
- **Drafting players:** Age 2 let a historic city's holder draft other players' cities in range. Leave that out (the proposal), or allow it with protection (reinforcements, beginners)?
- **Seats:** all four levels follow Age 2 (proposed). Keep all 1,920 level 12s, or fewer? Does a captured seat become the player's city, as in Age 2, and so count against the city limit? What does each bring, and how much? What happens to a state's NPC members when a player holds its seat? What limits holding (upkeep, one level 16 per player, unrest)? Are benefits shared with the holder's alliance? What does the level 18 bring?
- **Chart credit:** keep the chart's logo, or credit TradingView in the game itself (see Decided)?
- **Events:** which ones, how often, how much damage, and whether they also hit troops or marches (a storm delaying armies)?
- **Forecasts:** how often are they right? Can research or a building improve them?
- **Scripts:** which level to aim for (rules, a language, TypeScript)? Which building or hero runs them, and what limits come with its level?
- **Outside bots:** keep the API open to them, with the same limits as in-game scripts? Or ask players not to use them?
