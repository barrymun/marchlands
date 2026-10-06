# Deviations from the original server

The specs in `docs/spec/` describe what the C++ Spitfire server actually did, bugs included. This file lists where evony-re does something different, and why. Every tunable value lives in `shared/core/src/balance.ts`.

## Ported exactly

- **Static data.** Building, research and troop costs, times and prerequisites, and items are converted from `config_*` (`tools/legacy-import`).
- **Economy.** Fields (production `100F`/h, storage `10000F` — *(design change)* every city's storage is ×20 (`BALANCE.storageMultiplier`), workers `10F`), cottages, base +100/h, tax income, hero salaries (`level×20`/h; *(design change)* switched off for now with `BALANCE.heroSalaries = false`; when on they are paid per real hour, unaffected by `GAME_SPEED` (`BALANCE.salaryPerRealHour`)), 6-minute population and loyalty drift.
- **Timing.**
  - Build time: `time × 0.995^management × 0.9^Construction`; demolition takes half the build time.
  - Research time: `time × 0.995^stratagem`.
  - Training time: `× 0.995^power × 0.9^(Military Science | Metal Casting)`.
  - Fortification time: `× 0.995^management × 0.9^Construction`.
- **Prestige** (`GetPrestigeOfAction`) and the refund ratios: demolish 1/3, cancelled research 1/3, cancelled batch 1/3 in progress or 1/1 queued.
- **Heroes.**
  - Stat rolls (`RandomStat`), tavern heroes, hire cost `level×1000`, reward `level×100` for +5 loyalty.
  - Level-up experience `level²×100`, the experience books and the loyalty medals.
  - Hero capture rule: d100 > loyalty, needs a free Feasting Hall slot.
- **March time** (`CalcTroopSpeed`): the slowest unit decides; Compass +10% per level on foot, Horseback Riding +5% per level on mounted and siege, both capped by the Academy level.
- **Battle simulator.** A float32-exact port of `EvonyAge1BattleCalc`, verified against all 36,567 regression cases (`npm test`).
- **NPC cities.** The level 1–10 table, layout and regeneration (`max/80` resources, `max/10` troops and forts every 6 min). Valley garrisons follow `ValleyData::Reset`.
- **Other.** The Amulet (24 slots, 60/25/10/5% odds, per-item counts); comfort and levy (costs, effects, 15-minute cooldowns); the 4×4 state grid.

## Bugs fixed

| Original behaviour | evony-re |
|---|---|
| Speed-up coin cost used `=` instead of `+=` in the 15-minute tier, so prices were not monotonic | fixed; coin cost uses the **remaining** time, not the total |
| Negative counts and amounts (training, troops sent, `buyResource`, furlough days) minted resources or cents | all amounts validated as positive integers |
| Resources sent with an army were never deducted but were returned on arrival | deducted on departure; load checked against carry capacity |
| `num = 0` let anyone use any item for free | the item count is checked and the item consumed |
| Research and troop prerequisites were never checked | enforced (Academy, buildings, techs, items) |
| Upgrading past level 10 read out of bounds | maximum level enforced |
| Cancelling construction never refunded, and could hit another player's building | full refund for construction; demolition cancel refunds nothing |
| Any alliance member resigning disbanded the alliance | only the last member leaving disbands it; a Host must hand over first |
| Alliance permission checks were missing or dead (`rank < 3`); joining needed no invitation | rank checks on every action; invitations and applications are required; 23-hour rejoin cooldown |
| Relation lists were saved cumulatively; runtime-created alliances were never inserted | normalised `alliance_relations` table |
| Two alliance-less players counted as the same alliance | they have no relation |
| Map castles always showed relation 0 (friendly) | the real relation |
| A sender's "sent" mail went to the receiver's mailbox | each party gets its own copy |
| Login reset cents to 5000 and refilled Speakers | removed |
| Chat cheats (`\cents`, `\resources`, `\buff`) for everyone; admin was the name "Daisy" | `/api/v1/admin/*` for operator accounts only |
| Plaintext passwords; unknown user names auto-registered | scrypt hashes; explicit register endpoint |
| Siege units got the mayor bonus twice (switch fall-through) | applied once |
| Captured hero copied into every empty slot; a "returning" hero stayed SEIZED | one slot; the hero goes home idle |
| Abatis never consumed; an overkill trebuchet volley killed nothing | fixed in game battles (`fixes: true`); parity mode kept for the regression tests |
| Iron Working's troop defence bonus used integer division (`(lvl×5+100)/100`), so it did nothing below level 20 | +5% per level in game battles (`fixes: true`); parity mode unchanged |
| Rolling logs multiplied their damage by the target's defence (no life division), so a few hundred logs wiped out the largest foot group of any size | divided by defence × life like every other attack in game battles (`fixes: true`); parity mode unchanged |
| `restTime` in seconds added to a millisecond timestamp | seconds × 1000 |
| *(design change)* One construction at a time per city | two at once (`BALANCE.buildQueues`); Bernini's Hammer adds a third |
| *(design change)* One research at a time per city's Academy | two at once (`BALANCE.researchQueues`); cancel and speed-up take a `techId` to pick one |
| Training takes at least 1 second per unit | *(design change)* no minimum (`BALANCE.minTrainUnitSeconds = 0`): once mayor Attack and Military Science / Metal Casting bring a unit's time below 1 game second it trains instantly (batches finish in the same request) |
| *(design change)* Valley levels are fixed by the map | any lord can raise an unowned valley one level at a time for gold (`BALANCE.valleyUpgrade`: 10,000 for Lv 1→2, doubling each level, up to Lv 10); its garrison regenerates at the new level |
| Level-10 buildings need a Michelangelo's Script item (bought with coins) | *(design change)* no item needed (`BALANCE.buildingItemRequirements = false`), as this server has no coin shop |
| Hero items (experience books, attribute boosts) are bought on use with cents | *(design change)* they can also be bought with the hero's city gold (`BALANCE.heroItemGold`: 1 gold per experience point, 100,000 for a 24-hour attribute boost); loyalty medals still cannot be bought |
| Items are bought with cents | *(design change)* some can also be bought with a city's gold (`BALANCE.goldShop`): War Ensign 250,000 |
| Experience per hero level is level² × 100 without limit | *(design change)* it stops growing at level 100 (`BALANCE.heroExpCapLevel`): every level from 100 on needs 1,000,000 |
| The Rally Spot army limits were never enforced | at most one army per Rally Spot level, each of at most 10,000 troops per level (100,000 at level 10; a War Ensign adds 25%), as in Evony |
| Fixed hero names like `"Test Name453160"` | name and portrait generator |

## Gaps filled

The original either stubbed these or never answered them.

- **Attacks.** Battles against player cities, barbarian cities and valleys:
  - plunder up to the army's load; resources protected by the Warehouse × store percent are safe;
  - city loyalty −10 to −15 per win; capture at 0 if the attacker's title allows another city;
  - a lord's last city cannot be taken;
  - barbarian cities can be captured, and become cities with their buildings;
  - valley occupation (one valley per Town Hall level);
  - honor and hero experience from kills; injured troops through Medicine;
  - hero capture when the attacking army is wiped out;
  - battle reports for every party involved.
- **Other missions.** Transport (to own or allied cities); reinforcement (merge into your own city, or station with an ally or on your own valley); scouting with intel (more detail with Informatics); founding a new city (needs a hero and 10,000 of each resource).
- **Recalling armies**, and sending home allied armies stationed with you.
- **Production bonuses.**
  - Agriculture, Lumbering, Masonry and Mining: +10% per effective level.
  - Mayor management: +1% per point.
  - Valleys: *(design change)* every valley gives 8–35% by level (+3% per level, Evony's lake table; Evony had grassland 3–12% and swamp/forest/desert/hill 5–23%), for the matching resource (lake, swamp, grassland → food; forest → wood; desert → stone; hill → iron).
  - Stockpile: +10% storage per level.
  - Production buffs: +25%.
- **Troop food upkeep** from `config_troops.movecost`. *(design change)* It is eaten per real hour, unaffected by `GAME_SPEED` (`BALANCE.upkeepPerRealHour`), while production speeds up. *(design change)* Desertion is switched off for now (`BALANCE.starvationDesertion = false`): food stops at 0 and troops stay. With it on, troops desert at 10% per game hour while food is at 0.
- **Market.**
  - Escrow when an order is placed; price-time priority matching at the resting order's price; a 0.5% fee paid by the buyer.
  - *(design change)* **Instant settlement**: the lord placing an order is paid in the same transaction; lords whose resting orders are hit are paid within a moment (zero-time shipments). `BALANCE.marketShipmentBaseMs > 0` restores Evony's travel time (60 min ÷ Marketplace level). Merchant Fleet therefore has no effect.
  - *(design change)* **Computer merchant** (`core/src/merchant.ts`, `BALANCE.merchant`): always buys and sells every resource in any amount. It quotes around a reference price (±5%); its trades move the price along an exponential curve (fills are priced along the curve, so splitting orders or round-tripping gains nothing) and the price drifts back to its base with a 6-game-hour half-life. Lords' orders at a better or equal price are filled first. A worker job lets the merchant fill resting orders its drifting price has crossed. **Currently fixed** (`BALANCE.merchant.fixedPrice = 1`): the merchant buys and sells every resource at 1.00 gold, with no spread and no curve, which puts a floor under sell prices. Lords' orders keep the same rules, but no lord can beat the merchant's price, so in practice every trade goes through the merchant. Set `fixedPrice: null` to bring the curve back.
  - **Market and limit orders**, a quote endpoint, and a trade log (`market_trades`) with recent trades and hourly (game time) price candles.
  - Order cap of 2 resting orders per Marketplace level; cancellation refunds.
- **Walls.** Fortifications take wall space (by Walls level).
- **Items.** A declarative effect for every item in `config_items`: production, attack, defence and upkeep buffs; boxes, chests and keys, troop boxes, hero helms; the chat icon; Ritual of Pact; Bernini's Hammer (one extra build queue); War Ensign; Speech Text; Civil Code; Penicillin.
- **Nobility titles** (Knight … Prince) bought with prestige and medals. A title limits how many cities a lord may own.
- **Social.** Friends and block list (blocked lords' mail and whispers are dropped); mail delete and bulk read; alliance event log, member circulars, military overview and diplomacy drop.
- **Quests.** A real catalogue: about 30 beginner quests over the original quest groups, with targets evaluated from game state and claimable awards, plus a daily gift.
- **Beginner protection** really applies (7 days or Town Hall 5). Truce and holiday protect cities, and holiday requires all armies to be home.
- **Rankings** are computed in SQL with search and paging. The original kept them in memory and re-pushed PlayerInfo to everyone every 5 seconds.
- **World map.** A procedural generator (`WORLD_MAP=generated`) or the original 800×800 layout (`WORLD_MAP=legacy`).

## Data corrections

- In `config_troops`, the combat and logistics columns of ids 8, 9 and 10 were rotated: row 8 carried cavalry stats. `tools/legacy-import/convert.mjs` rotates them back, so transporters carry 5,000, cavalry 100 and cataphracts 80.
- Item names that were double-encoded in the dump ("Beginnerâ€™s Package") are repaired.

## Values chosen without a source

These Evony Age 1 values were not in the original code. They are marked `(evony)` in `balance.ts`:

- warehouse protection table;
- wall space per fortification;
- loyalty damage per attack of 10–15;
- market fee and shipment time;
- curing injured troops at 25% of training cost;
- hero helm and troop box contents;
- title requirements;
- starvation rate.

Adjust them freely.
