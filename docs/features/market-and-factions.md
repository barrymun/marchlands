# Market overhaul: NPC trade, factions and new charts

**Status:** phases 1 (charts and the merchant), 2 (the faction data) and 3 (NPC trade) built 2026-10-22; phase 4 (reputation) built 2026-10-31, its rules in Decided. The rest is design. TODO.md item: *Overhaul the marketplace mechanics.*

**The aim:** a market that feels alive. NPC cities trade with each other all the time, so prices move for reasons players can see and influence: plunder, war, shortages. The charts and a live ticker show it. NPC cities belong to factions, which remember how each player has treated them.

## Where things stand

**The market today** (`backend/packages/game/src/services/market.ts`, `src/engine/market.ts`, `shared/core/src/merchant.ts`, `BALANCE.merchant`; deviations.md, Market):

- Players post buy and sell orders (`market_orders`), limit or market, up to 2 resting orders per Marketplace level. Trades settle at once (`BALANCE.marketShipmentBaseMs = 0`) with a 0.5% fee on the gold paid.
- **The merchant is a market of last resort** (phase 1): it buys every resource at 0.85 and sells at 1.15, in any amount, around a fixed reference of 1.00 (`fixedPrice: 1`, `spread: 0.3`). A player's order between those prices beats it. Before 2026-10-22 it traded at exactly 1.00, so nobody could beat it and the order book went unused.
- Its curve mode is still written and tested: a reference price that moves with its trades along an exponential curve, a drift back to its base price (half-life 6 game hours), and a worker job every 10 s that fills resting orders its price has crossed. Its `depth` (1,000,000) is far too shallow for today's trades (100–350 million a trade on the dev stack), so it would need retuning before use.
- Every fill is a row in `market_trades` (822 rows, 224 kB on the dev stack in October 2026, about 270 bytes a row with its indexes), and adds to the world's price candles in `market_candles` (`logTrade`, `engine/market.ts`): one per resource, scope (`'world'` for now), length (a minute, an hour or a day of real time) and start. The worker deletes minute candles after 7 days and hour candles after 90 (`BALANCE.marketCandles`, in `cleanupJob`), and trades after 180 days (`BALANCE.marketTrades`, since 2026-11-01). The Market page reads candles, never trades. Migration 0027 built candles from the trades made before.
- The Market page draws candles, volume and the merchant's prices with TradingView Lightweight Charts (`components/market-panel/chart-panel/candle-chart/`, ranges of an hour to a month), and the order book's depth (`chart-panel/depth-chart/`, players' orders only). recharts is gone.
- A player places and cancels at most 10 orders a minute (`BALANCE.marketOrderLimit`, `OrderLimit` in the API, kept in memory like the login backoff); quotes are free.
- The tax rate also sells a share of each city's field output to the merchant at its middle price (`merchantBase`, 1.00), so what it earns didn't change with the spread; see deviations.md, Tax.

**The NPC cities** (counted on the dev stack, 2026-10-19). There are 51,217 on the 800 × 800 map (640,000 tiles), spread over the 16 zones (Friesland … Romagna):

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cities | 9,284 | 8,499 | 7,424 | 6,374 | 5,472 | 4,756 | 3,713 | 2,847 | 1,858 | 990 |

- An NPC city keeps nothing in the database until it is touched: `tiles.troops`, `forts` and `state` stay null while it is at full strength, and are worked out when read (regeneration is lazy). 54 of the 51,217 have any state at all.
- Their resources regenerate +1/80 of the maximum every 6 game minutes, and gold matches their largest resource (deviations.md).
- From level 5 up they belong to the faction holding their zone (phase 2, Factions below) and trade in groups of one zone and level (phase 3, NPC trade below): 96 groups on the dev stack's map.

## Decided

- **The economy is a (relatively) deep game in its own right,** not only colour around combat (2026-10-19). So the plan goes past NPC trade: events that move prices, factions with relations, and tools for players who want to trade seriously (scripts, below).
- **Charts: TradingView Lightweight Charts** (v5, Apache 2.0, canvas, about 35–45 kB gzipped), for candles, volume, depth and the live ticker on the Market page.
  - It is loaded with the Market page only (a lazy screen), and replaces recharts there.
  - recharts has no other users, so it, `components/ui/chart.tsx` and recharts' share of the market's size budget can go. Check the budget (`client/web/.size-limit.js`, *market tab*) with a build.
  - The new dependency is pinned to an exact version at least two weeks old (AGENTS.md).
  - **Credit** (decided 2026-10-20): the small logo the library draws on each chart stays on (`attributionLogo`), plus a credit in README.md with TradingView's logo. As we read the library's NOTICE, turning the chart's logo off would need a link to tradingview.com that every player can reach; keeping it is simplest and clearly meets the licence.
- **recharts' `^3.8.0`:** removed with phase 1 (2026-10-22), since Lightweight Charts took over its only use. About 30 other dependencies also use `^` versions; they predate the exact-pin rule (which applies to new dependencies), and pinning them is a separate tidy-up.
- **The merchant stays at about 1.00 gold, as a last resort with a spread** (2026-10-20). Every trade so far went through it at about 1.00 (822 trades, about 115 billion resources on the dev stack). The design's per-resource base prices (food 0.2 … iron 0.5) would cut what resources and the tax rate earn by 50–80%, a balance change for every player. So the middle price stays near 1.00 and the merchant gets a spread (buying near 0.75, selling near 1.25, numbers in `BALANCE`), so player orders inside the spread beat it at last. Differences between resources come later, from NPC trade.
- **Phase 1's numbers** (decided 2026-10-22):
  - **Spread 0.85 / 1.15** (first 0.75 / 1.25, narrowed the same day as too harsh). Selling 100M lumber to the merchant now brings 85M gold instead of 100M, and buying 100M iron costs 115M. Players' orders between the two prices beat it, and NPC factions will trade inside the same band (NPC economy, below).
  - **The middle price stays fixed at 1.00,** rather than turning the curve back on (with a much larger depth) now. Prices move once factions trade (phase 3).
  - **Orders: 10 a minute per player,** placing and cancelling together (a burst of 10, then one every 6 s), counted in the API's memory as the login backoff is; 429 with Retry-After past it. Counting in the database (surviving restarts and several API processes) was the alternative; there is one API instance.
  - **Candles in real time,** a minute, an hour and a day, so the charts keep their pace at any game speed and the minute ticks of NPC trade fit them. The table has a `scope` column from the start (`'world'`), ready for faction and zone candles.
- **Factions: five blocks of neighbouring zones, worked out from the zone, with levels 1–4 as unaligned bandits** (2026-10-20), as in Factions, Membership.
- **The faction data** (decided 2026-10-22): the working names stay (display names can change any time, they're locale text); members from level 5; the characters in Factions, A character for each. Players see them on a barbarian city's map card, in a Factions panel, and in the map's key with a switch to tint the land by faction.
- **Phase order changed (2026-10-22): NPC trade straight after the faction data,** before reputation and seats of power. NPC trade needs the factions' characters (the zones are alike, so nothing else makes groups want different things) but not standing or seats, and it is what makes the market's charts move on their own. Seats gain their tribute from trade when they come.
- **NPC trade's rules** (decided 2026-10-22):
  - **A tick every real minute,** matching the minute candles: the same pace at any game speed. Production and use inside a tick follow game time.
  - **Steady use by faction:** each group uses each resource at a steady rate set by its faction, more than it makes of what it is short of and less of what it is strong in. A shortage lasts, so the strong sell to the short every tick. (Rejected: pulling stock back to a target, under which trade dies down once everyone is at target; and no use at all, under which prices only fall.)
  - **Prices stay inside the merchant's band,** from the same constant (`BALANCE.merchant.spread`, 0.85 to 1.15): nobody can buy from one and sell to the other for free gold, and a shortage shows as a price near 1.15. Narrowing or widening the merchant's spread moves both.
  - **Plunder lowers a group's stock at once,** until the city refills (8 game hours): raiding a faction's cities raises its prices for a while.
- **NPC trade's numbers** (decided 2026-10-22, all in `BALANCE.npcTrade`):
  - **The model.** 96 groups (16 zones × levels 5–10). A group's *target* is its members' full-strength stock (the NPC table × the member count). Every game hour each group makes and uses resources and drifts back towards its target; every real minute one auction per resource sets the world price, (world target ÷ world stock)^sensitivity inside the merchant's band, and groups above target sell to those below.
  - **Moderate volume:** groups make and use 2% of their target per game hour, so the factions move about 15M lumber and 0.5B food between them per game hour, against 100–350M for a typical player trade on the dev stack. Players clearly move prices.
  - **Sensitivity:** the price reaches 1.15 when the world's stock is a quarter short of target (the exponent comes from that and the merchant's spread).
  - **Prices wander gently:** each faction's making rises and falls a little at random (seeded), so prices drift a few % over a game day when nobody plays. Acts of god bring the big shocks later.
  - **The world is balanced:** each resource's extra making and using is scaled so the world as a whole neither gains nor loses (the strengths alone would leave stone in glut at 0.85 and lumber short at 1.15 for good). Factions still trade with each other.
  - **Each zone's land shapes what it makes:** a zone makes more of a resource the more of its valleys yield it, against the world average (forest lumber, desert stone, hills iron, swamp, grass and lake food), counted from the map. On the dev stack's map Franconia has 44% more forest than average and Moravia 34% less, so states become known for what their land gives. It sits on top of the faction's character, and the world stays balanced.
  - **Strengths and shortages: +50%,** more making of what a faction is strong in, more using of what it is short of.
  - **Players trade along the curve, with a ±1% spread:** players buy from and sell to the factions' shared stock along the auction's own price curve, factions selling 1% above it and buying 1% below, as far as the curve goes before the band's edge (about a quarter of the world's stock); past it the merchant is cheaper. A big order simply pays more as it fills.
  - **Gold** (decided 2026-10-22): each group's treasury is its members' gold in the NPC table (55,000 at level 1 to 1,500,000 at level 10, not the food-matching gold NPC cities hold for plunder): about 15B across the factions on the dev stack's map. A group makes and uses 2% of its treasury per game hour (the Italian League making 50% more, the world balanced) and drifts back to it like its stock, so a drained faction recovers over about a game day. In the auction a group buys only what its gold pays for; players selling to the factions are paid only while the factions hold gold, and the merchant buys the rest. On the dev stack's map gold halves the food the factions trade with each other (poorer groups can't buy all they want); prices behave as before.
- **Phase order: seats of power straight after factions** ([historical-cities.md](historical-cities.md) since 2026-10-24), with the ballista rule change before them (2026-10-20; changed 2026-10-22, below). Taking a seat is a fight against fortifications, and most of a seat's value (capture, the daily draft, the title, bigger armies) doesn't need NPC trade; its tribute from trade and market rights arrive with NPC trade. The ballista rule change ([reference/ballista-farming-and-wall-range.md](../reference/ballista-farming-and-wall-range.md)) also makes farming cheaper, so it changes how fast resources enter the game, and should be settled before NPC trade is tuned.
- **Reputation's rules** (decided 2026-10-31, phase 4; numbers in `BALANCE.reputation`):
  - **Standing:** each player has a standing with each faction, from -100 to 100, starting at 0 and drifting back towards 0 (half-life 3 game days). Stored as a row per player and faction they've dealt with (`faction_standing`), the value and when it was last set; the drift is worked out when read, so no job runs.
  - **Prices go through the city's home faction.** Players trade with the factions' pooled stock (phase 3), not with one faction, so a city trades with them through the faction holding its zone: its nearest market, as Membership's Players note says. The player's standing with that faction sets the spread that city gets. (Rejected: splitting the pool into five faction rows with their own stock, which brings in regional prices, still an open question, and changes the auction, the book and its chart; and a spread weighted by each faction's share of the stock, which players couldn't follow.) So raiding your neighbours hurts your own market, and raiding far away doesn't, until relations between factions (phase 6) make rivals care.
  - **The spread:** today's 2% (1% each way) at 0; narrowing to none at 100 (the factions trade at their curve price); widening to 10% at -50. Never below none: a negative spread would let a player buy and sell straight back at a profit.
  - **Refusal:** at -50 or below the home faction won't trade with that city at all. The merchant and other players still do, and the book shows the factions row as closed to it.
  - **What lowers it:** every attack on a member (a barbarian city from level 5, won or lost), 0.3 a level (1.5 at level 5, 3 at level 10), with the faction it belongs to; capturing one, another 20.
  - **What raises it:** a won attack on a bandit camp (levels 1-4), 0.1 a level, with the faction whose land it's on (answering the open question: farming bandits slowly earns goodwill and is a way to mend standing); and trading with the factions, 1 a 20M gold traded with the city's home faction, at most 5 a game day.
  - **Shown to players:** their standing with each faction, its band (hostile, unfriendly, neutral, friendly, honoured) and what it does to their prices, on the Factions panel; the factions row of the book and every quote for the city in view; the change in each battle report against a member or a bandit camp.
  - **Not in this phase:** rivals gaining standing (needs relations between factions, phase 6), retaliation, and what standing lets a player see (Ideas from a real trading terminal).
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
- **The merchant becomes a last resort** (decided, see Decided): its middle price stays near 1.00, with a spread, so the market never seizes up but factions and players can always offer better prices. The tax rate keeps selling at the merchant's middle price (`merchantBase`), so what it earns doesn't change.
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
    - A faction you have angered could send reinforcements to a member under attack (this fits the planned historical cities, which let their owner draft troops from neighbouring NPC cities: [historical-cities.md](historical-cities.md)).
    - At worst, it could raid your cities. That needs armies led by NPCs, which the game doesn't have yet.
  - New players are exempt from retaliation (beginner protection).
- **Relations between factions:** alliances, wars and embargoes, which change who trades with whom and so cause the shortages. They could also give quests ("deliver 1M iron to the Saxon League" for standing).
- **The main risk:** attacking barbarians is the core of single-player play. If factions hit back too hard, that becomes a chore. Keep the low levels unaligned "bandits", and keep every effect tunable in `BALANCE`.

#### Membership (decided 2026-10-20)

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
- **Franconian Heartland:** Franconia, Thuringia, Swabia and Bavaria (4, centre). It borders every other faction, so it's the crossroads where trade and wars meet.
- **Bohemian Crown:** Bohemia, Moravia and Carinthia (3, east).
- **Italian League:** Lombardy, Tuscany and Romagna (3, south).

Counting member cities at level 5 and above, the four three-zone factions would have 3,612–3,737 each, and the Franconian Heartland, with four zones, 4,958.

**Low levels stay unaligned.** Levels 1–4 (31,581 cities, 62%) are bandits:
- they belong to no faction and don't trade;
- attacking them costs no standing, so the usual farming is untouched;
- perhaps clearing bandits even raises your standing with the faction whose land they're on.

Levels 5–10 (19,636 cities) are members. Where the line falls is one number in `BALANCE`.

**A character for each, by design** (decided 2026-10-22, in `shared/core/src/factions.ts`):

| Faction | Strong in | Short of | Temperament |
|---|---|---|---|
| Saxon League (north) | lumber | stone | trading |
| Lotharingian Crown (west) | stone | food | keeps to itself |
| Franconian Heartland (centre) | food | lumber | trading (the crossroads) |
| Bohemian Crown (east) | iron, stone | food | warlike |
| Italian League (south) | food, gold | iron | trading |

Every resource has a faction strong in it and another short of it (a core test checks), so there is always a reason to trade. How much stronger or shorter (production and use multipliers, target stock) goes in `BALANCE` with NPC trade. A flag for each is still to draw; for now each has a colour.

**Borders can move.** A war between factions could, rarely, change who holds a zone. That changes one of the 16 entries, and every NPC city in the zone changes sides with it: dramatic on the map, and cheap.

**Players:**
- A player isn't a member of any faction, but has a standing with each.
- Where a player's city stands could still matter: the faction holding your zone is your nearest market, and the first to notice what you do.

### Historical cities: seats of power

Moved to a design of its own on 2026-10-24: [historical-cities.md](historical-cities.md). Historical cities (levels 12 to 18) are seats of power over an area of the map, held by a faction until a player takes one. For the factions: a state belongs to the faction holding its level 16 seat, so seats are how borders move, and taking one from a faction costs standing with it.

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

### Ideas from a real trading terminal (Fincept Terminal, 2026-10-31)

[Fincept Terminal](https://github.com/Fincept-Corporation/FinceptTerminal) is an open-source finance terminal (C++ and Qt, AGPL-3.0, its name a trademark): equity research, portfolios, quant tools, AI agents, brokers, news and global data. Read from its website and README for features a game market could borrow. Only the ideas are taken: none of its code, text or branding (its licence and trademark rule that out anyway).

**What fits, cheapest first:**

- **More order types** (its bracket, OCO and GTT orders). Today an order is limit or market and rests until filled or cancelled (`market_orders` has no expiry):
  - *good till a time*: a resting order that cancels itself, a timed event like the rest;
  - *stop-loss and take-profit*: an order that waits off the book until the price crosses a level, then places itself;
  - *one cancels the other*: two orders where a fill of one cancels the other.

  These are the first level of trading scripts (Standing orders and rules, above) as plain order options. They're checked on the ticks and sweeps that already run (`npcTradeJob`, `npcSweep`), and each counts against the order limit like any order.
- **Price alerts and a watchlist** (its Watchlist): a player marks a resource and a price and gets a push and a toast when the world price crosses it. Cheap, and useful to players who don't trade often. The alerts are kept per player, a few at most.
- **A market news feed** (its News and Geopolitics): short notices that say why prices move, made from what the game already knows. "Raids on the Saxon League's cities: its lumber stock is down 20%", "The Bohemian Crown is short of food". Later, "War between the Saxon League and the Bohemian Crown", seats taken and acts of god. They go in the ticker beside the factions' trades. This is what the market's aim asks for: prices moving for reasons players can see.
- **A ledger of the player's trading** (its Portfolio and risk metrics): profit and loss on their trades, average buy and sell prices per resource, gold spent on fees, and what their stock is worth at today's price. All of it comes from their `market_trades` rows, which are kept 180 days (`BALANCE.marketTrades`), so a ledger would cover that long unless it kept its own totals.
- **Market actions in flows** (its Node Editor and workflows): flows already chain actions over a player's cities (`attackTargets`, `trainTroops`, `healTroops`, `setMayor`, `wait`; [architecture.md](../architecture.md), Flows). A *buy* or *sell* action ("sell lumber above 1.05, keep 5M") would give players automated trading inside a system they already know, before any script language. A visual node editor is more than a phone can show well; flows' list of steps suits every screen.
- **What standing lets you see** (its Global Data and Relationship Map): an economy screen per faction, its stock against its target, its treasury, what it's short of, and later its relations with the other factions. How much a player sees grows with their standing (phase 4) or with a seat in the area ([historical-cities.md](historical-cities.md), Knowledge), so information is something to earn.

**Bigger, for later phases:**

- **Forward contracts** (its derivatives): agree today to buy or sell an amount at a fixed price on a set day, the gold or resources held until then. With acts of god and the almanac's forecasts this is real hedging ("lock in food before the forecast drought"). Needs care: escrow for both sides, what happens when a side can't pay or deliver, and a cap on size.
- **A trading season and leaderboard** (its Alpha Arena, strategies compared head to head): ranked by trading profit over a season, with a title or medal as the prize. There is no leaderboard of any kind yet (the Stats page shows only the player's own figures), so this would be the first.
- **Testing a rule before it runs** (its backtesting and paper trading): a script or market flow run against the last week's candles to show what it would have done. Cheap once scripts exist, since candles are kept.
- **Caravans on the map** (its Maritime vessel tracking): already an idea under NPC economy (Regional prices), which this backs: trade you can see moving is trade you can raid.

**What doesn't fit:** company research and valuation (statements, DCF, M&A), the volatility surface and options, fixed income, a spreadsheet, notes and file management, and AI agents. The game has four resources and gold, not thousands of instruments. An AI advisor would cost money per player, and wouldn't be the same for every player, which matters for fairness.

## Phases

In this order (decided 2026-10-20; NPC trade moved before reputation and seats on 2026-10-22):

1. **Charts and the merchant.** **Built 2026-10-22** (branch `market-overhaul`), as Where things stand describes:
   - Lightweight Charts (5.2.1) on the Market page in place of recharts: candles and volume over an hour, a day, a week or a month, the merchant's prices as dashed lines, and the order book's depth. Lazy-loaded with the page: the market tab is about 61 kB gzipped (its budget went from 115 to 70 kB). recharts and `components/ui/chart.tsx` are gone.
   - `market_candles`, written as trades happen: each trade updates its minute, hour and day candle directly, so no roll-up job is needed, only the deletion of old ones.
   - The merchant as a last resort: 0.85 to buy, 1.15 to sell, the tax rate still at 1.00.
   - The order limit, 10 a minute.
   - The credit: the chart's own logo, a line under the chart linking to TradingView (the licence asks for its notice and a link on a page players can reach), and README.md.
   - deviations.md: the merchant's spread, the candles and the order limit.
2. **The faction data.** **Built 2026-10-22:**
   - The five factions in core (`shared/core/src/factions.ts`: `FACTIONS`, `factionOfZone`, `npcFaction`), members from `BALANCE.factions.minLevel` (5), worked out from zone and level with nothing stored. Which faction holds a zone is fixed data for now; it moves into the database when borders can move (phase 6).
   - Their names in a `data-factions` locale namespace, and their colours (`client/web/src/lib/factions.ts`).
   - Shown on a barbarian city's map card (its faction, or Bandits below level 5), in a Factions panel (zones, strengths, shortages, temperament) and in the map's key, with a switch that tints the land by faction (remembered per browser).
   - No rule changes: nothing behaves differently yet, so deviations.md has no entry.
3. **NPC trade.** **Built 2026-10-22**, with the rules and numbers in Decided, above:
   - The rules in core (`shared/core/src/npc-economy.ts`: `npcTick`, the price curve `worldPrice`, players' fills `factionSells` / `factionBuys`, `landFactors`, `plunderGroup`), all numbers in `BALANCE.npcTrade`. A simulation over the dev stack's map, at game speed 60: prices wander between about 0.97 and 1.05 over three game days; the factions move 10–25M lumber and 0.3–0.9B food a game hour; a 300M lumber purchase fills at about 1.02.
   - The state in one `world_state` row (`npc-economy`): each group's stock, each faction's wander, the prices, the zones' land (counted once from the map), the groups as last counted, the ticker. The worker ticks every real minute (`npcTradeJob`): it counts the members from the map, runs the auction, adds it to the world's candles, and the factions then fill players' resting orders their price has crossed (`npcSweep`).
   - Players trade with the factions through the order book (a factions row on each side, sorted with the players' and the merchant's, and their depth in the depth chart), between other players' orders and the merchant (`planFills`). Their trades are `market_trades` rows marked `npc` (migration 0028), and the trade form says how much went to the factions.
   - Plunder: a won attack on a member lowers its group's stock by the loot (`plunderNpc`, from `attackNpc`).
   - The ticker: a few made-up trades per resource each tick, picked at random among the groups that traded, the last 50 kept in the state and shown in the Market page's *Between the factions* tab.
   - Not yet: candles per faction (there is one world price, so they would show the world's price with a faction's volume).
   - deviations.md: NPC factions trade.
   - **The factions' gold** (2026-10-22): each group holds gold (`NpcEconomy.gold`, `groupTreasury`, `worldGold`), as decided above. The order book's factions row buys only what their gold pays for, and the Factions panel shows each faction's gold against its treasury (`GET /factions`).
   - **The phone trading flow** (2026-10-22): on a phone the trade form opens in a sheet from Buy and Sell kept at the bottom of the screen, or from a row of the order book, and a finger dragging up or down on the chart scrolls the page (`handleScroll.vertTouchDrag` off; across still pans the chart). Below the wide terminal (`xl`) the panes grow to their content and only the page scrolls, so a finger on the order book or a list never gets caught in it; the longer lists (trades, the factions' trades, the player's orders and trades) show their first 12 rows and a Show more.
   - **Live updates** (2026-10-22): the Market page doesn't poll. Each tick, each order placed or cancelled and each fill of the merchant's sweep broadcasts `server.MarketUpdate` with the resources that moved (`ctx.broadcast`, to everyone connected; market data is public); the client marks those resources' book, history, quote and affordable queries and the summary stale, so only what is on screen refetches. Pushes sent while a socket was down are lost, so the client refreshes every market query when it reconnects (`usePushSync`). With many traders the broadcasts could be throttled to one per resource per few seconds.
4. **Reputation.** **Built 2026-10-31**, with the rules and numbers in Decided, above:
   - The rules in core (`shared/core/src/reputation.ts`: `standingNow`, `changeStanding`, `factionSpread`, `standingTier`, `attackStanding`, `tradeStanding`, `homeFaction`), every number in `BALANCE.reputation`. The factions' price functions take the spread (`factionMarginal`, `factionSells`, `factionBuys`).
   - A `faction_standing` row per player and faction (migration 0030): the value, when it was set, and the standing trade gained on the last game day. The backend's `engine/reputation.ts` reads and changes it (`standingsOf`, `addStanding`, `tradedWithFactions`) and works out each city's terms (`cityTerms`).
   - The market: the book, a quote and the affordable amount take the city (`cityId`, optional; the base spread without one), placing an order uses its own, and the factions fill each resting order at its city's spread (`npcSweep`); a refused city gets the book's factions row closed (`refused`). Gold traded with the factions raises standing with the city's home faction.
   - Combat: `attackNpc` changes standing for any attack on an unheld barbarian city, and the battle report carries the change (`standing`).
   - The client: standing with each faction (its band, value and what it does to prices) on the Factions panel, the city's terms under the order book, and the change in battle reports. The `app` size budget went from 115 to 118 kB (backlog: English text in the first page).
   - deviations.md: standing with the factions.
5. **The ballista rule change, then seats of power.**
   - First the rule change: traps hit only ground troops, and ranged groups stop once the wall is in range ([reference/ballista-farming-and-wall-range.md](../reference/ballista-farming-and-wall-range.md)). **Done 2026-10-20.**
   - The seats themselves are now their own design, with their own phases: [historical-cities.md](historical-cities.md) (2026-10-24).
6. **Relations between factions and retaliation.** Wars, embargoes, reinforcements, and seats changing hands between factions. Then, maybe, raids, caravans and regional prices. **Put off** (2026-11-01, the maintainer): retaliation stays the prices reputation already sets; reinforcing members, raiding players' cities and wars between factions are a TODO.md item (*Angry factions*) for later. What is built: a player holding a state's capital cuts the state off from its faction ([historical-cities.md](historical-cities.md), phase 4).
7. **Acts of god.** Scheduled events, their effects on cities and NPC groups, the almanac's forecasts, weather in the map and the town. They can start any time after phase 3, once there are NPC prices for them to move.
8. **Trading scripts.**
   - The API's rate limits come first (in phase 1).
   - Then standing orders and rules, then the language, and the TypeScript sandbox only if it's still wanted.

Each phase records its rule changes in deviations.md (*(design change)*) and its numbers in `BALANCE`.

## Open questions

- **NPC trade, later:** candles per faction or per region (with prices by region, below).
- **Prices:** one world price per resource, or prices by region with travel time?
- **Retaliation:** prices only, reinforcing their cities, or raiding yours?
- **The merchant once factions trade:** does its middle price stay at 1.00 for every resource, or follow the factions' prices (the curve, retuned)?
- **Seats of power:** their open questions are in [historical-cities.md](historical-cities.md).
- **Events:** which ones, how often, how much damage, and whether they also hit troops or marches (a storm delaying armies)?
- **Forecasts:** how often are they right? Can research or a building improve them?
- **Scripts:** which level to aim for (rules, a language, TypeScript)? Which building or hero runs them, and what limits come with its level?
- **Outside bots:** keep the API open to them, with the same limits as in-game scripts? Or ask players not to use them?
- **Ideas from Fincept Terminal** (Ideas being weighed): which to take, and in which phase? The order types, alerts and news feed are small and could come before or alongside reputation; market actions in flows could replace the first level of trading scripts. Should stop orders and alerts be free, or gated by the Marketplace's level?
