# Evony (Age 1) Private Server — Engine Specification

Paths here are in the original server, [sonya75/evony-private-server](https://github.com/sonya75/evony-private-server) on GitHub.

Source analysed: `evony-private-server/src` (C++, "spitfire" by Daisy, 2018), primarily `spitfire.cpp/.h`,
`main.cpp`, `structs.h`, `defines.h`, `connection.cpp`, plus the engine-adjacent classes they call
(`City`, `PlayerCity`, `NpcCity`, `Client`, `Hero`, `Map`, `Tile`, `Valley`, `BattleCalc`/`combatsimulator.h`,
`AllianceMgr`, `Utils`, `xml_writer.hpp`) and the DB dumps `DB/evony (3).sql` (main/config DB) and
`DB/s2 (1).sql` (game-server DB).

This document describes **what the C++ actually does** (including bugs), so the TypeScript/Postgres
rewrite can reproduce or deliberately fix behaviour. Items tagged **[BUG]** are defects in the original;
**[NOT IMPLEMENTED]** marks features the original never finished; **[REWRITE NOTE]** marks
recommendations that are *not* derived from the C++.

Packet handlers (`src/packets/*`) are out of scope except where they create the timed events the engine
consumes (building/research/army/troop queues); those producer-side formulas are summarised in §7.

---

## 0. Conventions

* **Time.** `Utils::time()` = milliseconds since Unix epoch (`system_clock`). *All* timestamps in memory,
  DB columns (`starttime`, `endtime`, `reachtime`, `lastlogin`, `creation`, mail `senttime`, buff `endtime`,
  city resource timer) are **epoch ms**. Config durations (`buildtime`) are **seconds**.
* **Tile ids.** `id = y * mapsize + x`; `x = id % mapsize`, `y = floor(id / mapsize)` (macros
  `GETXYFROMID`, `GETXYFROMID4(x, y, id, mapsize)`, `GETIDFROMXY`). Coordinates displayed as `"(x,y)"`.
* **Randomness.** C `rand()` seeded once with `time(seconds)` in `main()` and again with
  `Utils::time()` (ms) in the IO thread. `rand() % n` is used everywhere (modulo bias accepted).
* **Troop index order** (`stTroops`, battle arrays, army DB strings, report `typeId = index + 2`):

  | idx | field | TR id | client name (AMF key) |
  |---|---|---|---|
  | 0 | worker | 2 | `peasants` |
  | 1 | warrior | 3 | `militia` |
  | 2 | scout | 4 | `scouter` |
  | 3 | pike | 5 | `pikemen` |
  | 4 | sword | 6 | `swordsmen` |
  | 5 | archer | 7 | `archer` |
  | 6 | transporter | 8 | `carriage` |
  | 7 | cavalry | 9 | `lightCavalry` |
  | 8 | cataphract | 10 | `heavyCavalry` |
  | 9 | ballista | 11 | `ballista` |
  | 10 | ram | 12 | `batteringRam` |
  | 11 | catapult | 13 | `catapult` |

  Fortification ids: 14 trap, 15 abatis, 16 archer tower, 17 rolling log, 18 trebuchet.
  `stForts` field order: `traps, abatis, towers, logs, trebs`.
* **Resources** `stResources`: `gold, food, wood, stone, iron` (doubles). Note `City::SetResources(gold, food,
  wood, stone, iron)` argument order.

### 0.1 Enumerations (`defines.h`)

| Group | Values |
|---|---|
| Prestige action | `DEF_RESEARCH=1`, `DEF_BUILDING=2`, `DEF_TRAIN=3` |
| Player status | `DEF_NORMAL=0`, `DEF_PEACETIME=1`, `DEF_TRUCE=2`, `DEF_BEGINNER=3`, `DEF_HOLIDAY=5` |
| Tile type | `FOREST=1`, `DESERT=2`, `HILL=3`, `SWAMP=4`, `GRASS=5`, `LAKE=6`, `FLAT=10`, `CASTLE=11`, `NPC=12` (1–6 = valleys) |
| Relation | `DEF_ALLIANCE=0` (same alliance), `DEF_ALLY=1`, `DEF_NEUTRAL=2`, `DEF_ENEMY=3`, `DEF_NORELATION=4`, `DEF_SELFRELATION=5` |
| Alliance rank | `HOST=4`, `VICEHOST=5`, `PRES=6`, `OFFICER=7`, `MEMBER=8` |
| Hero status | `IDLE=0`, `MAYOR=1`, (2 reinforce – undefined), `ATTACK=3` (any outbound march), `SEIZED=4`, `RETURN=5` |
| Mission type | `TRANS=1`, `REINF=2`, `SCOUT=3`, `BUILDCITY=4`, `ATTACK=5` |
| Army direction | `FORWARD=1`, `BACKWARD=2`, `STAY=3` (camped/reinforcing) |
| Mail type | `INBOX=1`, `SYSTEM=2`, `SENT=3` |
| Timed event type | `DEF_TIMEDARMY=1`, `DEF_TIMEDBUILDING=2`, `DEF_TIMEDRESEARCH=3` |
| Server status | `STOPPED=0`, `STARTING=1`, `ONLINE=2`, `SHUTDOWN=3` |

Building ids: 1 Cottage, 2 Barracks, 3 Warehouse, 4 Sawmill, 5 Quarry ("Stonemine"), 6 Ironmine, 7 Farm,
20 Stable, 21 Inn, 22 Forge, 23 Marketplace, 24 Relief Station, 25 Academy, 26 Workshop, 27 Feasting Hall,
28 Embassy, 29 Rally Spot, 30 Beacon Tower, 31 Town Hall, 32 Walls. (`Utils::GetBuildingName` returns these
display names, `"Failed"` otherwise.)

Research ids: 1 Agriculture, 2 Lumbering, 3 Masonry, 4 Mining, 5 Metal Casting, (6 unused), 7 Informatics,
8 Military Science, 9 Military Tradition, 10 Iron Working, 11 Logistics, 12 Compass, 13 Horseback Riding,
14 Archery, 15 Stockpile, 16 Medicine, 17 Construction, 18 Engineering, 19 Machinery, 20 Privateering.
(`Client::research[25]`, index = research id.)

States (zones), index 0–15: FRIESLAND, SAXONY, NORTH MARCH, BOHEMIA, LOWER LORRAINE, FRANCONIA,
THURINGIA, MORAVIA, UPPER LORRAINE, SWABIA, BAVARIA, CARINTHIA, BURGUNDY, LOMBARDY, TUSCANY, ROMAGNA.

---

## 1. Runtime architecture

* Single process, singleton `spitfire` holds **all game state in memory**; the DB is only read at boot and
  written opportunistically (packet handlers call `SaveToDB()`) and at shutdown. There is **no periodic
  autosave** (see §5.9).
* Threads:
  1. **Main thread** → `run()` loads data, spawns threads, then joins them and performs the shutdown save.
  2. **IO thread** (exactly 1; `thread_pool_size_` hard-coded 1) runs `asio::io_service::run()`. Incoming
     packets are parsed **and handled inline on the IO thread** (`connection::handle_read` →
     `request_handler::handle_request`). The `packetqueue` path is commented out.
  3. **Timer thread** → `TimerThread()` (§5). Runs concurrently with the IO thread with **no locking**
     (all `lists.lock()` calls are commented out) **[BUG: data races]**.
* Global in-memory collections:
  * `players : list<Client*>` — every account (online or not) is resident.
  * `m_city : vector<City*>` — all NPC + player cities.
  * `map : Map` — `mapsize²` `Tile`s.
  * `m_alliances : AllianceMgr` — fixed array of 1000 (`DEF_MAXALLIANCES`) alliance slots.
  * `armylist`, `buildinglist`, `researchlist : list<stTimedEvent>` — timed events. `stTimedEvent{type, id,
    accountid, castleid, data*}` where `data` is `stArmyMovement*`, `stBuildingAction{city, client,
    positionid}` or `stResearchAction{city, client, researchid}`. `AddTimedEvent` assigns `id = tecounter++`
    and appends to the list for its type. Equality (`list::remove`) is by `id`.
  * Config: `m_buildingconfig[35][10]`, `m_researchconfig[25][10]`, `m_troopconfig[20]`, `m_items[400]`,
    `m_gambleitems` (5 rarity pools).
  * Ranking lists (§11), rank-search caches.
  * Counters: `m_heroid`, `m_cityid`, `m_allianceid`, `armycounter`, `tecounter` (§4.11).

---

## 2. `config.json` (read by `Init()` from the process CWD)

All keys are required (any missing key → `Init()` returns false → process exits).

| Key | Type | Use |
|---|---|---|
| `bindaddress` | string | listen address for game socket |
| `bindport` | **string** | listen port (passed to resolver as service string) |
| `maxplayers` | number | `NewClient()` refuses to create a `Client` when `currentplayersonline >= maxplayers` |
| `mapsize` | number | map edge length (typ. 500 or 800; DB dump is 800) |
| `sqlhost`, `sqluser`, `sqlpass` | string | MySQL credentials (port fixed 3306, `compress=true;auto-reconnect=true`) |
| `dbmaintable` | string | **main DB name** (e.g. `evony`): `account`, `config_*`, `settings`, `servers` |
| `dbservertable` | string | **game-server DB name** (e.g. `s2`): `accounts`, `cities`, `heroes`, `alliances`, `armies`, `mail`, `reports`, `tiles`, `Trades` |
| `servername` | string | stored only |
| `reportbasepath` | string | filesystem dir prefix where report XML files are written (`<path><guid>.xml`) |
| `reportbaseurl` | string | URL prefix embedded in reports (`reportUrl` attr) |

Two connection pools: `accountpool` → `dbmaintable`, `serverpool` → `dbservertable`.

---

## 3. Database schema and serialized string formats

### 3.1 Main DB (`evony`)

* `account(id PK AI, name, email, ip, lastlogin double, creation double, password, status, reason)` — master
  login account. Only `email`, `password` are read by the engine (LEFT JOIN on `accounts.parentid`).
* `config_building(id PK, buildingid, level, buildtime, wood, food, stone, iron, gold, prereqbuilding,
  prereqitem, prereqtech, inside, blimit)` — 205 rows.
* `config_research(id PK, researchid, level, buildtime, wood, food, stone, iron, gold, prereqbuilding,
  prereqitem, prereqtech)` — 190 rows.
* `config_troops(troopid PK, buildtime, population, wood, food, stone, iron, gold, inside, prereqbuilding,
  prereqitem, prereqtech, life, attack, defense, load, movecost, speed, range)` — 17 rows (ids 2–18).
* `config_items(id PK, name, cost, description, buyable, cangamble, itemtype, daylimit, rarity)` — 229 rows.
* `config_quests(id PK, mainId, isFinish, description, name, typeId, prereqbuilding, prereqitem, prereqtech,
  prereqquest)` — **not loaded by the engine** (§4.1.6).
* `settings(id, server, setting, options, desription)` — one row `setting='itemxml'` holding the client item
  XML (`<itemdef><items><itemEum id name itemType dayLimit userLimit desc itemDesc iconUrl price
  playerItem/>…</items><special>…</special></itemdef>`). **Not loaded** (code commented out); presumably served
  by the web root.
* `servers(id, name, ip)` — not used by the engine.

### 3.2 Game-server DB (`s2`)

| Table | Columns (type) | Engine use |
|---|---|---|
| `accounts` | `accountid PK AI`, `parentid` (→`account.id`), `username`, `lastlogin double`, `creation double`, `ipaddress`, `status`, `reason`, `buffs text`, `sex`, `flag`, `faceurl`, `research text`, `items text`, `allianceid` (default **0**), `alliancerank`, `misc text`, `cents`, `prestige double`, `honor double`, `changedface`, `icon`, `allianceapply`, `allianceapplytime`, `castlesign` | loaded at boot; updated by `Client::SaveToDB` |
| `cities` | `id PK AI`, `accountid`, `misc`, `status`, `allowalliance`, `logurl`, `fieldid`, `transingtrades`, `troop`, `name`, `buildings`, `fortification`, `trades`, `gooutforbattle`, `hasenemy`, `gold/food/wood/iron/stone bigint`, `creation double`, `troopqueues` | loaded; updated by `PlayerCity::SaveToDB` |
| `heroes` | `id double PK`, `ownerid`, `castleid`, `name`, `status`, `itemid`, `itemamount`, `basestratagem`, `stratagem`, `stratagemadded`, `stratagembuffadded`, `basepower`, `power`, `poweradded`, `powerbuffadded`, `basemanagement`, `management`, `managementadded`, `managementbuffadded`, `logurl`, `remainpoint`, `level`, `upgradeexp double`, `experience double`, `loyalty` (default 70), `troop`, `hbuffs NOT NULL`, `troops NOT NULL` | loaded per city; `Hero::SaveToDB/InsertToDB/DeleteFromDB` |
| `alliances` | `id PK AI`, `name`, `founder`, `leader`, `note`, `intro`, `motd`, `allies`, `neutrals`, `enemies`, `members`, `created` | loaded |
| `armies` | `armyid PK AI`, `heroid double`, `direction`, `resource text`, `troops text`, `starttime`, `reachtime`, `resttime`, `missiontype`, `startfieldid`, `targetfieldid`, `cityid double`, `clientid double` | loaded at boot; **truncated and rewritten at shutdown** |
| `mail` | `id PK AI`, `content varchar(1000)`, `senderid`, `title varchar(45)`, `senttime`, `readtime`, `receiverid`, `type`, `pid` | loaded per account; `CreateMail` inserts |
| `reports` | `id PK AI`, `accountid`, `reportid NOT NULL`, `guid varchar(32)`, `title varchar(32)`, `type_id`, `back`, `attack`, `armytype`, `startpos varchar(32)`, `targetpos varchar(32)`, `eventtime`, `isread` | loaded; truncated+rewritten at shutdown |
| `tiles` | `id PK`, `level`, `type`, `ownerid int` | **not loaded** in the shipped build (`DEF_NOMAPDATA`, §4.2) |
| `Trades` | `id`, `restype`, `price`, `amount` | unused by engine |

**[BUG] schema mismatches:** code reads/writes `reports.typeid` but the column is `type_id`; `reports.reportid`
(NOT NULL, no default) is never supplied; `heroes.hbuffs`/`heroes.troops` (NOT NULL, no default) are never
supplied by `InsertToDB`. With non-empty `reports` the boot `rs.value("typeid")` throws and aborts `run()`.

The `s2` dump contains **only tile rows** (640 000 rows = 800×800; ids 0–639 999) and no accounts/cities.
Tile type distribution in the dump: 1:58 249, 2:58 865, 3:58 594, 4:58 964, 5:58 719, 6:58 657, 10:19 704,
11:61, 12:268 187; levels 2–10 only (no level 1); `ownerid = -1` for 639 986 rows (treat `-1` as unowned —
in C++ `m_ownerid` is `uint32` so `-1` would read as 4 294 967 295 and look "owned").

### 3.3 Serialized string formats (text columns)

All parsers split with `my_split` (consecutive delimiters collapse; empty tokens dropped) or `strtok`.

| Column | Format | Writer | Notes |
|---|---|---|---|
| `accounts.buffs` | `id,desc,endtimeMs|…` | `DBBuffs` | Parser needs exactly 3 tokens; endtime via `atoi64`. **[BUG]** writer uses Poco `%?d` for string args → emits format-error text; buffs effectively don't round-trip. Commas in `desc` would break parsing. |
| `accounts.research` | `id,level,castleid,starttime,endtime|` ×25 (ids 0–24, all written) | `DBResearch` | Parser needs 5 tokens. `castleid>0` ⇒ research in progress (§4.6). |
| `accounts.items` | `itemName,count|…` (only count>0 written) | `DBItems` | `SetItem(name,count)`; unknown item name → null deref on `GetItem`. |
| `accounts.misc` | `icon,haschangedface` | `DBMisc` | **[BUG]** writer streams `icon` (int8) as a raw char and the `?:` binds wrong; parser sets `haschangedface = true` always (casts `c_str()` pointer to bool). Expects exactly 2 tokens else logs error. |
| `accounts.castlesign` | `tileid,tileid,…` | `DBCastleSign` | **Not loaded at boot** (`ParseCastleSign` never called). |
| `cities.misc` | `population,workrate.gold,workrate.food,workrate.wood,workrate.iron,workrate.stone,loyalty,grievance,lastResourceUpdateMs` | `PlayerCity::DBMisc` | Default for new city: `50,10.000000,100.000000,100.000000,100.000000,100.000000,90,0,<nowMs>` (pop 50, tax 10 %, all workrates 100 %, loyalty 90, grievance 0). `workrate.gold` is the **tax rate**. |
| `cities.buildings` | `type,level,position,status,starttime,endtime|…` | `DBBuildings` | position: inner −2…31 (−1 Town Hall, −2 Walls), outer 1001…1040. status 0 idle, 1 building/upgrading, 2 destructing. |
| `cities.troop` | `troopTypeId,count|…` (12 pairs; writer order archer, worker, warrior, scout, pike, sword, transporter, ballista, ram, catapult, cavalry, cataphract) | `DBTroops` | Negative counts → 0. |
| `cities.fortification` | `traps,abatis,towers,logs,trebs` | `DBFortifications` | |
| `cities.troopqueues` | per queue: `positionId,frontEndtimeMs(,troopId,count,costtimeMs)*|` | `DBTroopQueues` | Empty queues skipped. Restore logic in §4.5 (buggy). |
| `cities.trades`, `transingtrades` | always written empty | | Market not persisted. |
| `alliances.members` | `accountId,rank|…` | | Only members whose account exists are added. |
| `alliances.allies/neutrals/enemies` | `allianceId|allianceId|…` | | |
| `armies.resource` | `food,wood,stone,iron,gold` (ints) | | |
| `armies.troops` | 12 ints in **stTroops index order** (worker…catapult) | | |
| `armies.heroid` | hero id or `-1` | | |

---

## 4. Boot sequence

`main()`:
1. `srand(time_seconds)`; create singleton; `serverstatus = STARTING`.
2. `Init()` – read `config.json` (§2). Constructor defaults before Init: `mapsize=800`, `m_heroid=1000`,
   `m_cityid=100000`, `m_allianceid=100`, `armycounter=tecounter=0`.
3. `ConnectSQL()` – create the two pools.
4. `InitSockets()` – resolve `bindaddress:bindport`, `SO_REUSEADDR`, bind (throws on failure), listen,
   start async accept. (Port-843 policy listener is **commented out**; see §14.) Accept callbacks don't run
   until the IO thread starts, so connections wait in the backlog during data load.
5. `serverstatus = ONLINE`.
6. `run()` (below). Exceptions from `run()` are logged and the process shuts down.
7. After `run()` returns: `stop_all()`, destroy singleton, wait for stdin.

`run()` steps, in order:

### 4.1 Configuration tables (from `accountpool` / main DB)

Any DB exception in this block aborts `run()` (except `std::exception` which is logged and continues).

#### 4.1.1 `config_building` → `m_buildingconfig[buildingid][level-1]` (`ORDER BY buildingid`)

| Field | Source |
|---|---|
| `time` | `buildtime` (seconds) |
| `destructtime` | `buildtime / 2` (seconds, double) |
| `food/wood/stone/iron/gold` | same-named columns |
| `prestige` | **`gold`** column **[BUG: meaningless; unused]** |
| `buildings` | parsed from `prereqbuilding` |
| `techs` | parsed from `prereqtech` |
| `items` | parsed from `prereqitem` |
| `limit` | `blimit` (1 = unique building, 0 = multiple allowed) |
| `inside` | `inside` (1 = inner city, 0 = outer field, 2 = walls, 3 = fortification-like rows 14–18) |
| `population` | never set |

**Prereq string format:** `"id,level|id,level|…"`. Split on `|`, then each token on `,` into
`{id, level}`. `""` (empty) ⇒ no entries. `"0,0"` ⇒ one entry `{0,0}` which consumers skip (`if (req.id)`).
Each token **must** have two numbers (C++ asserts). Meaning of `id`:
* `buildings`: building type id; satisfied if the city's **max level among buildings of that type** ≥ level.
* `techs`: research id; satisfied if `client.research[id].level ≥ level`.
* `items`: **config_items.id** (numeric index into `m_items`), level = quantity; satisfied if the player
  owns ≥ quantity of `m_items[id].name`. On *upgrade* (pcastle) the items are consumed. In data, every
  level-10 building requires item `19,1` = `consume.blueprint.1` (Michelangelo's Script).

Indexing: `[cfgid][level-1]`; i.e. `m_buildingconfig[type][L]` is the cost to go **from level L to L+1**
(`[type][0]` = build new). Data rule (verified for all rows): every cost and time doubles per level:
`value(L) = value(1) × 2^(L-1)`. Base (level-1) values and prereqs are tabulated in Appendix A.

#### 4.1.2 `config_troops` → `m_troopconfig[troopid]` (ids 2–18)

`time = buildtime` (seconds per unit), `destructtime = 0`, `food/wood/stone/iron/gold`, `inside`,
`population`, prereqs parsed as above. **The `life/attack/defense/load/movecost/speed/range` columns are
ignored** — combat and speed use hard-coded tables (§8, §7.2). Data in Appendix B.

#### 4.1.3 `config_research` → `m_researchconfig[researchid][level-1]`

`time = buildtime` (converted as int), `destructtime = buildtime/2` (int), costs, prereqs. Doubling rule holds.
Appendix C.

#### 4.1.4 `config_items` → `m_items[id]`, gamble pools

`name` (the item key string, e.g. `consume.1.a`), `desc=description`, `cost`, `saleprice=cost`,
`buyable` (bool), `cangamble` (bool), `daylimit`, `type=itemtype`, `rarity`. `m_itemcount++` per row.
Item lookup by name (`GetItem`) is a linear scan of `m_items[0..399]`.

If `cangamble`, the item pointer is appended to a pool by `rarity`:

| rarity | pool | items in DB (count) |
|---|---|---|
| 5 or anything else (incl. 0) | `common` | 32 |
| 4 | `special` | 16 |
| 3 | `rare` | 14 |
| 2 | `superrare` | 8 |
| 1 | `ultrarare` | 1 (`consume.hegemony.1`) |

(Full membership in Appendix D.) The pools are consumed by the shop "amulet" gamble packet: 16 slots from
`common`, 4 from `special`, 3 from `rare`, 1 top slot = `superrare` with 95 % else `ultrarare`; the prize
index is drawn from `rand()%100000`: <60000 → one of the 16 common slots, <85000 → special slot,
<95000 → rare slot, else slot 23 (top). Client `kind = rarity-1` (top ultrarare slot uses `rarity`).
(Detail belongs to the shop spec.)

#### 4.1.5 `config_items` derived prereq usage
Building/research prereq `items` reference `m_items[id]` by **numeric id**, so item ids must be preserved
when migrating.

#### 4.1.6 `config_quests` — not loaded
The engine never reads `config_quests` (quests are hard-coded in the quest packet handler). Schema for
reference: `mainId` (quest group), `isFinish`, `description`, `name`, `typeId`, `prereqbuilding`
(comma list of building ids, `'0'` none), `prereqitem`, `prereqtech`, `prereqquest` (quest id). Rows:
1 Rebuild(type1), 2 Domain Expansion(2), 3 Commodity Gathering(4, bld 4,5,6,7), 4 Comforting(5, bld 31),
5 Resource Levy(5, 31), 6 Administration(6), 7 Trading(7, 31), 8 Scientific Research(8), 9 Alliance(9),
10 Correspondence(10, 31), 11 Hero Recruitment(11), 12 Military Service(11), 13 Scouting(13, quest 16),
14 Fortification(14), 15 Colony(15), 16 City Expansion(16), 17 Rich Store(17, bld 7), 18 Transportation(18),
19 Alarming(19, quest 12), 20 Population Increase(20); `isFinish=1` group: 21 The Medals (quest 30),
22 Wealthy Society, 23 Prestige Building (31), 25 Item Purchase, 26 Christmas Hunt, 27 Consolation,
28 Guidelines (31), 29 BattleField (quest 16), 30 Promotion; 31 Amulet (mainId 3, type 31, item 48).

### 4.2 Map

`map = new Map(mapsize)`: allocates `mapsize²` tiles. Each tile defaults: `m_type=FLAT(10)`, `m_level=-1`,
`m_ownerid=0`, `m_npc=false`, `m_city=null`, `m_valley=null`, `m_castleid=0`, `m_zoneid=GetStateFromXY`.

**States:** the map is a 4×4 grid of quarters: `col = floor(x / (mapsize/4))`, `row = floor(y / (mapsize/4))`,
`state = row*4 + col` (0–15), using the half-open bounds `[k*0.25*mapsize, (k+1)*0.25*mapsize)`.

#### 4.2.1 Shipped behaviour: random map each boot (`#define DEF_NOMAPDATA` at top of spitfire.cpp)

For every tile id `x` in `0 … mapsize²-1`:
```
type  = rand()%8 + 1          // 1..8
level = rand()%10 + 1         // 1..10
if type == 7: type = FLAT(10)
if type == 8: type = NPC(12); city = AddNpcCity(id); city.m_level = level;
              city.Initialize(true,true); city.m_ownerid = 0; tile.m_zoneid = state(id)
ownerid = 0
```
⇒ ~75 % valleys (types 1–6, 12.5 % each), 12.5 % flats, 12.5 % NPC cities, levels uniform 1–10.
**The map is not persisted and is regenerated on every boot**; player cities loaded later overwrite their
tiles (§4.5). Progress logged every 1 %.

#### 4.2.2 Alternate path (compiled out): load `tiles`
`SELECT id, ownerid, type, level FROM tiles ORDER BY id`; copy into tiles; for `type==NPC`:
`AddNpcCity(id)`, `Initialize(true,true)` **before** setting `m_level` **[BUG: NPC initialised as level 0 →
default stats, `IDLE_POPULATIONS[-1]` out of bounds]**, then `m_level=level`, `m_ownerid=ownerid`. After all
accounts/cities/alliances load, **"Incrementing valleys"**: every tile with `type < 11` and `ownerid == 0`
gets `level++`, wrapping 11 → 1 (valley levels rotate on each restart).

**[REWRITE NOTE]** Persist the map in Postgres; seed once from the `s2` tile dump (treat `ownerid=-1` as 0).

#### 4.2.3 `CalculateOpenTiles()` (called right after map creation — *before* player cities load)
Per state: count tiles with `type ≥ FLAT` as occupiable; flats counted in `m_totalflats`; unowned flats
counted in `m_openflats` and pushed to `m_openflatlist[state]`; owned flats, castles, NPCs count as occupied;
`m_cities` (type 11), `m_npcs` (other ≥ 10 non-flat). Stats: `numbercities = cities+npcs`,
`playerrate = int(occupied/occupiable*100)`, `players = cities`. Counters are `uint16` (overflow for maps
> ~1000²). `GetRandomOpenTile(state)` picks and **removes** a random entry from the open-flat list
(returns −1 if none). New-player creation decrements `m_openflats[zone]`, takes a random open flat, rejects
if it is not FLAT/unowned, and calls `CalculateOpenTiles()` again after creation. Because the list is built
before player cities load, a stale flat can be picked; the FLAT/owner check then fails with error −25.

### 4.3 NPC city creation (`AddNpcCity` + `NpcCity::Initialize`)

`AddNpcCity(tileid)`: new `NpcCity{m_tileid, m_type=NPC, m_cityname="Barbarian City", m_status=0}`;
pushed to `m_city`; tile `m_city=city, m_npc=true, m_type=NPC`. (`Tile::GetName()` for NPC returns
`"Barbarian's City"`.)

`Initialize(resources, troops)` (flags ignored) sets current **and** max values from the level table, then
`SetupBuildings()`, `ResetHero()`, `m_loyalty = (level>2) ? 90 : 80`, `m_population =
IDLE_POPULATIONS[level-1]`.

| Lvl | gold | food | wood | stone | iron | warrior | pike | sword | archer | cavalry | traps | abatis | towers | logs | trebs | population |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 55 000 | 100 000 | 20 000 | 20 000 | 20 000 | 50 | 40 | 30 | 10 | 8 | 1 000 | 0 | 0 | 0 | 0 | 1 000 |
| 2 | 65 000 | 200 000 | 30 000 | 30 000 | 30 000 | 50 | 45 | 40 | 30 | 25 | 1 850 | 550 | 0 | 0 | 0 | 4 000 |
| 3 | 75 000 | 900 000 | 75 000 | 75 000 | 75 000 | 200 | 160 | 65 | 40 | 60 | 2 000 | 1 000 | 650 | 0 | 0 | 8 000 |
| 4 | 300 000 | 1 600 000 | 120 000 | 120 000 | 120 000 | 400 | 400 | 100 | 100 | 150 | 4 500 | 1 875 | 550 | 0 | 0 | 16 000 |
| 5 | 450 000 | 3 000 000 | 180 000 | 180 000 | 180 000 | 750 | 1 000 | 350 | 250 | 200 | 3 750 | 1 875 | 1 250 | 750 | 0 | 25 000 |
| 6 | 600 000 | 4 000 000 | 200 000 | 200 000 | 200 000 | 4 000 | 1 750 | 550 | 500 | 450 | 4 250 | 1 500 | 1 500 | 950 | 400 | 33 000 |
| 7 | 800 000 | 4 500 000 | 500 000 | 500 000 | 500 000 | 12 000 | 3 000 | 750 | 800 | 750 | 5 600 | 2 800 | 1 850 | 1 100 | 700 | 38 000 |
| 8 | 1 000 000 | 8 000 000 | 800 000 | 800 000 | 800 000 | 15 000 | 6 750 | 4 000 | 3 000 | 2 000 | 7 200 | 3 600 | 2 400 | 1 440 | 900 | 58 000 |
| 9 | 1 200 000 | 14 000 000 | 550 000 | 550 000 | 550 000 | 60 000 | 18 000 | 2 000 | 6 750 | 2 500 | 9 000 | 4 500 | 3 000 | 1 800 | 1 125 | 68 000 |
| 10 | 1 500 000 | 19 000 000 | 600 000 | 600 000 | 600 000 | 400 000 | 0 | 0 | 0 | 0 | 11 000 | 5 500 | 3 666 | 2 200 | 1 375 | 78 000 |
| other | = level 1 values | | | | | | | | | | | | | | | `IDLE_POPULATIONS[level-1]` |

NPC troops are a separate 5-field struct (`warrior, pike, sword, archer, cavalry`). NPC `m_ownerid` = 0.

`SetupBuildings()` (all at level `L = m_level`; positions per §3.3):
* Outer: Sawmill(4) @ `1011+(L-1)*3`, Quarry(5) @ `1012+(L-1)*3`, Ironmine(6) @ `1013+(L-1)*3`;
  Farms(7) @ `1001 … 1001 + (10+(L-1)*3) - 1` (i.e. `10+3(L-1)` farms).
* Inner: Academy(25)@0, Forge(22)@1, Embassy(28)@2, Feasting Hall(27)@3, Marketplace(23)@4,
  Beacon Tower(30)@5, Stable(20)@6, Inn(21)@7, Rally Spot(29)@8, Relief Station(24)@9, Workshop(26)@10,
  Barracks(2)@11, Cottages(1)@12…31, Town Hall(31)@−1, Walls(32)@−2.

`ResetHero()` (re-rolls the NPC's temporary hero; called at init and on **every** scout of the NPC):
`level = rand()%(L*10)+1`, `power = 30+rand()%30`, `poweradded = level`, `management = 30+rand()%30`,
`stratagem = 30+rand()%30`, `status = IDLE`, `name = "TestName" + (rand()%100)`.

`RecoverFromAttack()` (+18 % of *current* troops/forts each, capped at max) exists but is **never called**.

### 4.4 Accounts (server DB)

1. `SELECT COUNT(*) FROM accounts` (progress only).
2. `SELECT accounts.*, <main>.account.email, <main>.account.password FROM accounts LEFT JOIN <main>.account
   ON account.id = accounts.parentid ORDER BY accountid` (cross-database join).
3. Per row: `NewClient()` (assigns `internalid` from a static counter, appends to `players`); set
   `accountexists=true`, `accountid`, `masteraccountid=parentid`, `playername=username`, `password`, `email`,
   `allianceid`, `alliancerank`, `lastlogin`, `creation`, `status`, `sex`, `flag`, `faceurl`, `cents`,
   `prestige` (via `Prestige(+x)`, clamped 0…2 100 000 000), `honor`; `ParseBuffs`, `ParseResearch`,
   `ParseItems`, `ParseMisc` (§3.3); `CheckBeginner(false)`.
   * **Not loaded:** `ipaddress`, `reason`, `changedface`, `icon` column, `allianceapply*`, `castlesign`.
   * Client defaults: `allianceid=-1`, `currentcityindex=-1`, `currentreportid=1`, `mailpid=1`,
     `office="Civilian"`, `beginner=false`, `cents=0`, `connected=0`, `socket=null`.
4. Mail: `SELECT * FROM mail WHERE receiverid=<accountid>`; each row → `stMail{title, content, senttime,
   readtime, mailid=pid, playerid=senderid, type_id=type}` appended to `maillist`; `mailpid = max(pid)+1`.

`CheckBeginner`: if `beginner` and (`now - creation > 7 days` (604 800 000 ms) or any city Town Hall ≥ 5)
→ `beginner=false`. **[BUG/NOT IMPLEMENTED]** `beginner` is never set to `true` anywhere (not at load, not at
account creation), so beginner protection is inert; all checks against it pass.

### 4.5 Cities and heroes

1. `SELECT COUNT(*) FROM cities`; `SELECT * FROM cities`.
2. Per row: find client by `accountid`; if missing log error and skip. `AddPlayerCity(client, fieldid, id)`:
   * `PlayerCity{m_type=CASTLE, m_logurl="", m_status=0, m_tileid, m_castleid=id, m_accountid}`;
     `SetBuilding(31 Town Hall, level 1, position −1)` (also sets `m_level=1`); resources 0;
     `ParseMisc("50,10,100,100,100,100,90,0,<now>")`; append to `client.citylist`, `citycount++`; push to
     `m_city`; tile: `m_city=city, m_npc=false, m_ownerid=accountid, m_type=CASTLE, m_castleid=id`.
     (If the tile had an NPC city, that `NpcCity` stays in `m_city` as an orphan and keeps regenerating.)
   * Then from the row: `food, wood, iron, stone, gold`, `name → m_cityname`, `logurl`, `fieldid`,
     `creation`; `ParseTroops(troop)`, `ParseBuildings(buildings)`, `ParseTroopQueues(troopqueues)`,
     `ParseFortifications(fortification)`, `ParseMisc(misc)` (overrides the default misc).
   * **Not loaded:** `status`, `allowalliance`, `gooutforbattle` (defaults `false` after every restart),
     `hasenemy`, `trades`, `transingtrades`.
3. `ParseBuildings`: each `type,level,position,status,start,end` → `SetBuilding(...)`. If `status` is 1 or 2,
   a `DEF_TIMEDBUILDING` event `{city, client, positionid}` is added (§5.4).
   `SetBuilding` rules (`City::SetBuilding`):
   * `position > 1000` → outer slot `position-1000` (must be ≤ 40), stores `id=position`.
   * else `-2 ≤ position ≤ 31` → inner slot `position+2`, stores `id=position`.
   * For player cities, setting Barracks(2) or Walls(32) with `level>0` creates a troop queue
     `{positionid=position, status=0, nextqueueid=0}` if none exists for that position; `level==0` removes it.
     (Walls at −2 own the **fortification** queue.)
   * Setting Town Hall(31) sets `city.m_level = level` (player and NPC).
4. `ParseTroopQueues`: for each `pos,endtime,(tid,count,cost)*`:
   ```
   for each (tid,count,cost):
       if SetTroopQueue(pos, tid, count, cost, endtime): endtime = 0 else endtime += cost
   SetTroopQueue: if no queue for pos → false
                  if endtime <= now → SetTroops(tid,count) (grant immediately) → false
                  else push {tid,count,costtime=cost,queueid=nextqueueid++,
                             endtime = queue.empty ? now + cost : 0} → true
   ```
   **[BUG]** (a) the first pending item restarts with full `cost` from now instead of the saved endtime;
   (b) after one item is queued, `endtime` is reset to 0 so every later item satisfies `endtime <= now` and is
   granted instantly; (c) granted fortification items (ids 14–18) go through `SetTroops`, which ignores them
   (lost), and `ParseFortifications` afterwards overwrites forts anyway. `starttime` is not restored.
5. `ParseTroops`: `SetTroops(type, count)` (additive, negatives → 0). `ParseFortifications`: `traps, abatis,
   towers, logs, trebs` → `City::SetForts` (overwrite).
6. Heroes: `SELECT * FROM heroes WHERE castleid = <city.m_castleid>`; row `a` → `m_heroes[a]` (no bound check
   vs 10 slots) with all stat columns, `logurl→m_logourl`, `name`, `remainpoint`, `level`, `upgradeexp`,
   `experience`, `loyalty` (clamped ≤100), `status`, `itemid`, `itemamount`, `m_castleid=cityid`,
   `m_ownerid=accountid`, `m_client=client`. Mayor: the first hero with status `MAYOR` becomes `city.m_mayor`;
   any further `MAYOR` heroes are reset to `IDLE`. `m_heroid = max(m_heroid, id+1)`.
   (Heroes with status ATTACK/RETURN whose army is not restored stay in that status forever.)
7. `m_cityid = max(m_cityid, id+1)` (unused for creation — new city ids come from the DB auto-increment).
8. `client->CalculateResources()` (§7.3) — because `m_timers.updateresources` comes from `misc`, **offline
   production is credited at boot** for the elapsed time.

### 4.6 Research timers
For every client and research index `a` in 0…24 with `research[a].castleid > 0`: if the city exists, set
`city.m_researching = true` and add a `DEF_TIMEDRESEARCH` event `{city, client, researchid=a}`; else log error.
(Index 0 events are dropped by the timer.)

### 4.7 Alliances
`SELECT * FROM alliances` → `CreateAlliance(name, founder, id, savetodb=false)` into the first free slot
(throws if 1000 slots full). `ParseMembers` (`accountId,rank|`; for each existing client:
`AddMember`, set `client.allianceid/alliancerank`), owner = first member with rank `HOST(4)`
(`m_ownerid`, `m_owner = playername`), `ParseRelation` for enemies/allies/neutrals, `name`, `founder`, `note`.
`m_allianceid = max(m_allianceid, id+1)`. Not loaded: `leader`, `intro`, `motd`, `created`.
`client.alliancename` is **not** set here.

### 4.8 Armies
`SELECT * FROM armies`; per row (skip silently if client, city, or hero (when `heroid>0`) not found):
`stArmyMovement{client, city, hero, targetfieldid, direction, resources (§3.3), troops (§3.3), starttime,
reachtime, resttime, missiontype, startfieldid, herolevel/heroname from hero, startposname=city name,
targetposname=Tile::GetName(target), armyid = armycounter++}`. `king` is not restored.
Pushed **directly** onto `armylist` as `stTimedEvent{type=ARMY, id=0}` (not via `AddTimedEvent`) **[BUG:
all restored armies share id 0, so `armylist.remove(evt)` later removes all of them at once]**; appended to
`client.armymovement`. If the target tile is owned by another client whose relation to the sender is
`ALLIANCE` or `ALLY`, also appended to that owner's `friendarmymovement`. Enemy lists are **not** rebuilt.
Finally `armylist.sort(by reachtime asc)`.

### 4.9 Reports
`SELECT * FROM reports`; per row with existing client: `stReport{armytype, back, attack, type_id=typeid,
startpos, targetpos, title, guid, eventtime, isread, reportid = client.currentreportid++}` appended to
`reportlist`. Report bodies are XML files on disk (`reportbasepath + guid + ".xml"`), read on demand by
`readreport(guid)` (returns `""` on failure).

### 4.10 Finalisation
* "Validating players": for players whose `GetAlliance() == (Alliance*)-1` reset alliance fields —
  **no-op** (`GetAlliance` returns null, never −1).
* (Valley increment — compiled out, §4.2.2.)
* `SortPlayers()`, `SortHeroes()`, `SortCastles()` (§11).
* Start timer thread (`TimerThreadRunning=true`), start 1 IO thread, join IO threads, join timer thread,
  then shutdown persistence (§13).

### 4.11 Id counters

| Counter | Initial | Bumped at boot to | Used for |
|---|---|---|---|
| `m_heroid` | 1000 | max(hero.id)+1 | new hero id when hired from the inn (`m_heroid++`) |
| `m_cityid` | 100000 | max(city.id)+1 | unused (DB auto-increment `LAST_INSERT_ID()` is used) |
| `m_allianceid` | 100 | max(alliance.id)+1 | new alliance id when `CreateAlliance(..., 0)` |
| `armycounter` | 0 | +1 per restored army | `armyId` of new armies (non-persistent; re-numbered each boot) |
| `tecounter` | 0 | — | `stTimedEvent.id` |
| `client.currentreportid` | 1 | +1 per report | per-player report id (re-numbered each boot) |
| `client.mailpid` | 1 | max(pid)+1 | per-player mail id |
| account id | DB AI | — | `accounts.accountid` |

---

## 5. TimerThread

### 5.1 Loop and scheduling semantics

```
t1h = t30m = t6m = t5m = t3m = t1m = t5s = t1s = t100ms = now
while serverstatus == ONLINE:
    try:
        now = time()
        if t1s   < now: t1s   += 1000                    // no work
        if t100ms< now: <100 ms tasks §5.2–5.5>; t100ms += 100
        if t5s   < now: <5 s tasks §5.6>;   t5s   += 5000
        if t1m   < now: <1 min tasks §5.7>; t1m   += 60000
        if t3m   < now: t3m += 180000                    // no work (save thread commented out)
        if t6m   < now: <6 min tasks §5.8>; t6m   += 360000
        if t1h   < now: t1h += 3600000                   // no work
        process packetqueue (always empty — packets are handled on the IO thread)
        log if packet processing > 50 ms
        sleep(1 ms)
    catch (...): log; TimerThreadRunning = false   // loop continues
```
* Every task fires on the first iteration after start (timers initialised to "now" and compared with `<`).
* If the thread falls behind, each task runs **at most once per ~1 ms iteration** and its timer advances by one
  interval, so it catches up in bursts rather than skipping.
* (`t5m`, `t30m` blocks are commented out; the 30-min block would have re-sorted rankings.)

Summary of periodic work:

| Interval | Task |
|---|---|
| 100 ms | troop/fort training queues; army movement events; building completion; research completion |
| 1 s | nothing |
| 5 s | rebuild all rankings (+ `PlayerInfoUpdate` push to every connected player); buff expiry |
| 1 min | resource accrual for all cities; push `ResourceUpdate` for each online player's focus city; expire rank-search caches |
| 3 min | nothing |
| 6 min | NPC regeneration; player city population/loyalty drift |
| 1 h | nothing |

### 5.2 Troop & fortification training (100 ms)

For every client, every city, every troop queue (`m_troopqueue`, one per Barracks position and one for
Walls at position −2):
```
head = queue.front()
if head exists and head.endtime <= now:
    gain = head.count * GetPrestigeOfAction(DEF_TRAIN, head.troopid, 1, city.m_level)   // §6
    client.Prestige(+gain); client.PlayerInfoUpdate()
    if city.mayor: mayor.experience += gain; city.HeroUpdate(mayor, 2)
    if queue.positionid == -2: city.SetForts(head.troopid, head.count)   // additive; pushes server.FortificationsUpdate
    else:                      city.SetTroops(head.troopid, head.count)  // additive; pushes server.TroopUpdate
    queue.pop_front()
    if new head exists: newHead.endtime = now + newHead.costtime        // costtime is in ms
```
Only the head of each queue can complete per tick. Queued items other than the head carry `endtime = 0`
until promoted. Mayor experience is added but **no hero level-up** happens here.

### 5.3 Army movement (100 ms)

Iterates over a **copy** of `armylist` (`tarmylist`). For each army `am`:

1. If `am.client == null`: `delete am; armylist.erase(iter)` **[BUG: erases using an iterator from the copy —
   UB]**; continue.
2. If `direction == STAY`: skip (camped armies never expire).
3. If `am.reachtime < now`:
   * **FORWARD** → arrival handling (§5.3.1).
   * **BACKWARD** → return handling (§5.3.6).

#### 5.3.1 Arrival: target validity (all mission types)
```
tile = map[am.targetfieldid]
valid = true
if fclient.Beginner() and tile.type > 10: valid = false                 // beginner can't hit castles/NPCs
if tile.ownerid > 0:
    oclient = GetClient(tile.ownerid)
    if oclient == null: valid = false        // [BUG] then dereferences oclient on the next line → crash
    rel = GetRelation(fclient.accountid, oclient.accountid)
    if rel in {SELFRELATION, ALLIANCE, ALLY}: valid = false
    if oclient.Beginner() and tile.type == CASTLE: valid = false
if not valid: send army back (§5.3.5) — no report
```
Note: the validity check applies to *every* mission type, so a transport/reinforcement to an own or
allied city would bounce. **[BUG] `GetRelation`**: players loaded from the DB have `allianceid = 0` (column
default) and `0 == 0` returns `DEF_ALLIANCE`, so **any two alliance-less players are treated as allied** and
cannot scout/attack each other (only players with `allianceid=-1`, i.e. created this session, are exempt).
`GetRelation` rules: same account → SELF; either client missing or `allianceid < 0` → NORELATION; equal
alliance ids → ALLIANCE; either ≤ 0 → NORELATION; otherwise alliance A's lists: enemy → ENEMY, ally → ALLY,
neutral → NEUTRAL, else NORELATION.

If valid, dispatch on `missiontype`:
* `SCOUT` → §5.3.2 / §5.3.3 / §5.3.4.
* `ATTACK` → **[NOT IMPLEMENTED]** (`// TODO`). No `continue` and no state change, so the army stays
  `FORWARD` with `reachtime < now` and is re-examined every 100 ms forever (stuck march, hero stuck in
  ATTACK status).
* `TRANS`, `REINF`, `BUILDCITY` → **[NOT IMPLEMENTED]** — same stuck behaviour. (The dispatch packet
  `army.newArmy` only creates armies for SCOUT and ATTACK; the REINF branch is empty; TRANS/BUILDCITY create
  nothing.) There is no plunder, no valley/NPC/city capture, no colonisation, no injured-troop handling.

#### 5.3.2 Scout a valley or flat (`tile.type < CASTLE`, i.e. types 1–10, owned or not)
```
if tile.m_valley == null: tile.m_valley = new ValleyData   // [BUG] m_tile never set → Reset() derefs garbage
tile.m_valley.Reset(false)                                  // §10; regenerates only if >6 min since last
report = new stReport {
  guid = random 28 chars [0-9a-z], attack=true, back=false, armytype=SCOUT(3), isread=false,
  reportid = fclient.currentreportid++, title="Scout Report", type_id=1, eventtime=now,
  startpos = "<am.startposname> (<sx>,<sy>)", targetpos = "<am.targetposname> (<tx>,<ty>)" }
write XML file (§6.2 valley scout) to reportbasepath + guid + ".xml"
fclient.reportlist.push_front(report)
send back (§5.3.5); fclient.SelfArmyUpdate(); fclient.ReportUpdate()
```
No combat occurs at valleys (even if the valley is owned by another player or has troops).

#### 5.3.3 Scout a player-owned city (`tile.type ≥ CASTLE` and `ownerid > 0`) — scout battle
```
oclient = GetClient(tile.ownerid)            // if null: falls through with no action (army stuck)
campers = [a in oclient.armymovement ∪ oclient.friendarmymovement
           where a.direction == STAY and a.targetfieldid == fieldid]
atk.hero = {attack: am.hero.GetPower(), intel: am.hero.GetStratagem()} if hero
atk.troops[2] = am.troops.scout                          // only scouts fight
atk.research / def.research = {military_tradition(9), iron_working(10), medicine(16), compass(12),
                               horseback_riding(13), archery(14), machinery(19)} raw research levels
                               of fclient / oclient (not capped by Academy)
def.troops[2] = Σ campers.scout
besthero = camper hero with highest GetPower(), then any hero in defenderCity.m_heroes with higher power
           (any status, even heroes away)          // bestPower starts at -1 (int16)
defenderCity = (PlayerCity*) tile.m_city             // [BUG] for an owned NPC tile this is an NpcCity
mainScouts = defenderCity.m_gooutforbattle ? defenderCity.troops.scout : 0
def.troops[2] += mainScouts
def.hero = {attack: besthero.GetPower(), intel: besthero.GetStratagem()} if besthero
// walls/fortifications are NOT passed (wallLevel=0, forts=0)
result = CombatSimulator.fight(atk, def)             // §8
// TODO in source: no scout report is generated for either side in this branch

damage = def.troops[2] - result.defenderTroops[2]
if campers and damage > 0:
    for camper c:
        dmg = ceil(c.troops.scout * damage / def.troops[2])     // integer division → ceil no-op
        c.troops.scout = max(0, c.troops.scout - dmg)
        if all 12 troop counts of c == 0:
            if c.hero: c.hero.status = IDLE; c.client.HeroUpdate(c.hero.id, c.city.castleid)
            c.client.armymovement.remove(c)
            if am.client != c.client: am.client.friendarmymovement.remove(c); am.client.FriendArmyUpdate()
            else: am.client.armymovement.remove(c)
            c.client = null; c.client.SelfArmyUpdate()   // [BUG] null dereference
if damage > 0:
    mainLoss = ceil(mainScouts * damage / def.troops[2])
    defenderCity.troops.scout = max(0, defenderCity.troops.scout - mainLoss)
    defenderCity.TroopUpdate()

if result.result (defender alive / won):
    if result.attackerTroops[2] == 0:                   // all attacking scouts died
        if am.hero:
            am.hero.loyalty = max(0, loyalty - 5)
            if defenderCity.GetBuildingLevel(FeastingHall 27) > defenderCity.HeroCount():
                chance = rand() % 100
                if chance > am.hero.loyalty:            // HERO CAPTURED
                    remove hero from fcity.m_heroes (first matching slot → null)
                    put hero into EVERY empty slot of defenderCity.m_heroes   // [BUG] missing break
                    hero.client = oclient; hero.ownerid = oclient.accountid; hero.loyalty = 0
                    hero.powerbuffadded = stratagembuffadded = managementbuffadded = 0
                    hero.status = SEIZED(4)
                    defenderCity.HeroUpdate(hero, 0)   // "hired"
                    fcity.HeroUpdate(hero, 1)          // "fired"
                    remove army (client list + armylist), delete am; continue
            // not captured: comment says "return hero to city immediately" but:
            hero.status = SEIZED(4); fcity.HeroUpdate(hero, 2)   // [BUG] hero stays SEIZED in own city
            remove army, delete am; continue
        remove army (no hero), delete am; continue
// attacker scouts survived (won or lost):
am.troops.scout = result.attackerTroops[2]
send back (§5.3.5) — but sets am.hero.status = RETURN without null check [BUG: crash if no hero]
am.client.SelfArmyUpdate(); continue
```
Notes: the hero's `castleid` is not updated on capture; DB is not updated; defender gets no notification
other than `HeroUpdate`.

#### 5.3.4 Scout an NPC city (`tile.type ≥ CASTLE`, `ownerid == 0`)
```
report as in §5.3.2 (title "Scout Report", type_id 1, armytype 3, attack=true, back=false)
npc = (NpcCity*) tile.m_city; npc.ResetHero()           // NPC hero re-rolled on every scout
write XML file (§6.2 NPC scout)
fclient.reportlist.push_front(report)
send back (§5.3.5) (hero.status = RETURN if hero); SelfArmyUpdate; ReportUpdate
```
No combat; scouts never die.

#### 5.3.5 "Send back" (common)
```
am.direction = BACKWARD
am.reachtime = now + (am.reachtime - am.starttime - am.resttime)   // one-way travel time
am.resttime  = 0
am.starttime = now
if am.hero: am.hero.status = RETURN(5)
```

#### 5.3.6 Return home (BACKWARD and `reachtime < now`)
```
if hero: hero.status = IDLE
city.resources += am.resources            // no storage cap
city.troops    += am.troops
client.armymovement.remove(am)
if hero: city.HeroUpdate(hero, 2)
client.SelfArmyUpdate(); client.PlayerInfoUpdate(); city.TroopUpdate(); city.ResourceUpdate()
report { guid, attack=false, back=true, armytype=missiontype, isread=false,
         reportid=client.currentreportid++,
         startpos/targetpos as above,
         title = SCOUT→"Scout Returned", ATTACK→"Attack Returned", else "Returned",
         type_id=1, eventtime=now }
write XML (§6.2 return)
client.reportlist.push_front(report); client.ReportUpdate()
armylist.remove(evt); delete am
```
`enemyarmymovement` entries of the target owner (added at dispatch for ATTACK) are never removed
**[BUG: dangling pointer after delete]**.

### 5.4 Building completion (100 ms)

For each event in `buildinglist` (`stBuildingAction{city, client, positionid}`):
```
bldg = city.GetBuilding(positionid)
if bldg.endtime < now:
  if bldg.status == 1:                                   // construct / upgrade
      bldg.status = 0; bldg.level += 1
      city.SetBuilding(bldg.type, bldg.level, positionid, 0, 0, 0)   // clears start/end times;
                                                                     // may create barracks/walls queue;
                                                                     // Town Hall updates city.m_level
      if type == Inn(21): delete all city.m_innheroes[0..9] (re-rolled on next tavern view)
      if type == TownHall(31) and level == 5:
          client.Beginner(false)
          CreateMail("System", playername, "Beginner's Protection Expired", <text below>, MAIL_SYSTEM)
      push server.BuildComplate {buildingBean: bldg.ToObject(), castleId: city.castleid}   (sent after the following)
      remove event
      gain = GetPrestigeOfAction(DEF_BUILDING, type, newLevel, city.m_level)
      client.Prestige(+gain)
      client.CalculateResources(); city.CalculateStats()
      if mayor: mayor.experience += gain; city.HeroUpdate(mayor, 2)
      client.PlayerInfoUpdate(); city.ResourceUpdate(); send BuildComplate
  elif bldg.status == 2:                                 // destruct
      bldg.status = 0; bldg.level -= 1
      refund = m_buildingconfig[type][newLevel] / 3 (each of food, wood, stone, iron, gold; integer division)
      city.resources += refund                           // refund = 1/3 of the cost of the destroyed level
      if newLevel == 0: city.SetBuilding(0,0,positionid)  // slot cleared
      else:             city.SetBuilding(type, newLevel, positionid)
      client.CalculateResources(); city.CalculateStats()
      send server.BuildComplate {buildingBean, castleId}
      remove event; CalculateResources; CalculateStats; city.ResourceUpdate()
      // no prestige change for destruction
  else: event stays forever (status 0 with stale endtime) — noted TODO in source
```
`buildingBean` = `{startTime, endTime, level, status, typeId, positionId, name}`.

Beginner-protection mail body (verbatim, `\n` line breaks):
```
Dear player,
This letter is dedicated to inform you that the Beginner's Protection is expired (7 days protection period was due or Town Hall has been upgraded to level 5). Now you are formally joining the battlefields of Evony. This is a competitive world. You never know when your enemies will come to your city gate. Therefore countermeasures must be made to secure your realm. It's recommended that you upgrade the Walls and build more fortified units, making it a great cost to those who lay their eyes upon your territory.In initial phase, your troops are far from enough to edge out the rivals, therefore you are also advised to build more Warehouses to preserve the resources from plundering.
Hang in there and stay alert.Good luck!
```
(Sent every time a Town Hall reaches 5, regardless of beginner status. The 7-day expiry path never sends it.)

### 5.5 Research completion (100 ms)

For each event in `researchlist` (`{city, client, researchid}`):
```
if researchid == 0: remove event; continue
r = client.research[researchid]
if r.endtime < now:
    city.m_researching = false
    r.level += 1; r.endtime = 0; r.starttime = 0; r.castleid = 0
    remove event
    gain = GetPrestigeOfAction(DEF_RESEARCH, researchid, r.level, city.m_level)
    client.Prestige(+gain); client.CalculateResources(); city.CalculateStats()
    if mayor: mayor.experience += gain; city.HeroUpdate(mayor, 2)
    client.PlayerInfoUpdate(); city.ResourceUpdate()
    send server.ResearchCompleteUpdate {castleId}
```
One research at a time per city (`m_researching`), but research levels are per player.

### 5.6 Every 5 s
1. (`market.Process()` is commented out — **the market is not ticked**.)
2. `SortPlayers()` (also sends `server.PlayerInfoUpdate` to **every connected** player each run),
   `SortHeroes()`, `SortCastles()`, `m_alliances->SortAlliances()` (§11).
3. Buff expiry: for each client, for each buff with non-empty id and `now > endtime`:
   * if `id == "PlayerPeaceBuff"` (Truce Agreement): `SetBuff("PlayerPeaceCoolDownBuff",
     "Truce Agreement in cooldown.", now + 12 h)` (43 200 000 ms);
   * `RemoveBuff(id)` → pushes `server.PlayerBuffUpdate {buffBean:{descName, endTime, typeId},
     updateType: 1}`.
   (Index-based loop while the vector is mutated — may skip an entry; harmless next tick.)
   `SetBuff` on an existing id only updates `endtime` (desc unchanged) and pushes `updateType 0`.

### 5.7 Every 1 min
* For every client: `CalculateResources()` (§7.3 — recompute stats and accrue resources for **all** cities).
  If `client.socknum > 0` and `currentcityindex != -1` and that city exists, push its `server.ResourceUpdate
  {castleId, resource}` (other cities are not pushed).
* `CheckRankSearchTimeouts(now)`: drop cached client/hero/castle rank searches whose `lastaccess + 30000 < now`
  (alliance search cache is never expired **[BUG: leak]**; `lastaccess` is not refreshed on cache hits).

### 5.8 Every 6 min
For every city in `m_city` (try/catch-all):
* **NPC** → `NpcCity::CalculateStats(true, true)` (regeneration):
  * food, wood, stone, iron: `+= max/80`, capped at max (gold does **not** regenerate);
  * each NPC troop type (warrior, pike, sword, archer, cavalry) and each fort type: `+= max/10` (integer
    division of max), capped at max.
  ⇒ resources full again after 80 ticks (8 h), troops/forts after 10 ticks (1 h).
* **Player** → `PlayerCity::RecalculateCityStats()` (§7.4: population and loyalty drift, gold production,
  push `ResourceUpdate`).

### 5.9 Things the timer does NOT do
* No autosave (the SaveThread / 3-min/5-min save hooks are commented out; `SaveThread()` is declared but has
  no body). Data is persisted only by packet handlers and at clean shutdown (§13).
* No beginner-protection expiry check (only at boot).
* No hero level-ups, loyalty decay, or hero salary-induced desertion.
* No market matching / trade delivery.
* No troop upkeep (`m_troopconsume` is always 0).
* No injured troops / relief station healing (`m_injuredtroops` never changes).
* No alliance cleanup, no deleted-hero/city processing (`m_deletedhero`, `m_deletedcity` are written by
  packets but never consumed).

---

## 6. Prestige and reports

### 6.1 `GetPrestigeOfAction(action, id, level, thlevel)`
```
base = table[action][id]   (0 if not listed)
prestige = base * 2^level / 2^(thlevel - 1)      // loops; thlevel ≤ 1 → no division
```
`thlevel` is `city.m_level` (= Town Hall level, updated *before* the call when the Town Hall itself
completes). Train calls use `level = 1` and multiply by unit count. Parameters are `int8`.

| DEF_RESEARCH (×2 already applied) | base |
|---|---|
| 1 Agriculture | 52 (26×2) |
| 2 Lumbering | 62 |
| 3 Masonry | 82 |
| 4 Mining | 110 |
| 5 Metal Casting | 114 (not final) |
| 7 Informatics | 118 (not final) |
| 8 Military Science | 122 |
| 9 Military Tradition | 156 |
| 10 Iron Working, 11 Logistics, 12 Compass, 13 Horseback Riding, 14 Archery, 15 Stockpile, 16 Medicine, 17 Construction, 18 Engineering, 19 Machinery, 20 Privateering | 52 each (not final) |

| DEF_BUILDING | base |
|---|---|
| 1 Cottage | 4 |
| 2 Barracks | 28 |
| 3 Warehouse | 21 |
| 4 Sawmill | 7 |
| 5 Quarry | 9 |
| 6 Ironmine | 11 |
| 7 Farm | 5 |
| 20 Stable | 36 |
| 21 Inn | 26 |
| 22 Forge | 26 |
| 23 Marketplace | 32 |
| 24 Relief Station | 26 (not final) |
| 25 Academy | 30 |
| 26 Workshop | 38 |
| 27 Feasting Hall | 35 |
| 28 Embassy | 18 |
| 29 Rally Spot | 25 |
| 30 Beacon Tower | 39 |
| 31 Town Hall | 112 |
| 32 Walls | 128 |

| DEF_TRAIN (per unit, before ×2^1 / 2^(TH-1)) | base |
|---|---|
| 2 Worker | 0.5 |
| 3 Warrior | 0.5 |
| 4 Scout | 1.0 |
| 5 Pike | 2.0 |
| 6 Swords | 3 |
| 7 Archer | 4 |
| 8 Transporter | 5 |
| 9 Cavalry | 6 |
| 10 Cataphract | 7 |
| 11 Ballista | 8 |
| 12 Ram | 9 |
| 13 Catapult | 10 |
| 14 Trap | 1 |
| 15 Abatis | 2 |
| 16 Archer Tower | 3 |
| 17 Rolling Log | 4 |
| 18 Trebuchet | 5 |

(All train values except worker/warrior/pike are marked "not final".)
Examples: Cottage→L1 with TH1: 4·2 = 8. Town Hall→L2: 112·4/2 = 224. 100 warriors at TH3: 100·0.5·2/4 = 25.

`Client::Prestige(delta)` adds and clamps to `[0, 2 100 000 000]`.

### 6.2 Report XML formats

Files are written with the minimal XML writer (`xml_writer.hpp`): 4-space indentation, newline before each
child open tag, empty elements self-close (`<x a="b"/>`), attribute/content escaping of `& < > ' "`.
No XML declaration. `reportUrl = reportbaseurl + guid + ".xml"`. Troop `typeId = stTroops index + 2`.
Only non-zero troop types are emitted.

**Valley/flat scout** (§5.3.2):
```xml
<reportData reportUrl="{url}">
    <scoutReport isFound="false" isSuccess="true" isAttack="true">
        <scoutInfo heroLevel="{valleyHero.level}" heroName="{valleyHero.name}" heroUrl="">
            <troops>
                <troopStrType typeId="{idx+2}" count="{n}"/>
            </troops>
        </scoutInfo>
        <battleInfo isAttack="true"/>
    </scoutReport>
</reportData>
```

**NPC scout** (§5.3.4):
```xml
<reportData reportUrl="{url}">
    <scoutReport isFound="true" isSuccess="true" isAttack="true">
        <scoutInfo support="{npc.loyalty}" population="{npc.population}" gold="{int gold}" heroLevel="{h.level}" heroName="{h.name}" heroUrl="">
            <resource>
                <food>{int}</food>
                <wood>{int}</wood>
                <iron>{int}</iron>
                <stone>{int}</stone>
            </resource>
            <fortifications>                         <!-- only if any fort > 0 -->
                <fortificationsType typeId="14" count="{traps}"/>   <!-- each only if > 0; order 14,15,17,16,18 -->
                <fortificationsType typeId="15" count="{abatis}"/>
                <fortificationsType typeId="17" count="{logs}"/>
                <fortificationsType typeId="16" count="{towers}"/>
                <fortificationsType typeId="18" count="{trebs}"/>
            </fortifications>
            <troops>                                 <!-- only if any NPC troop > 0; order 3,5,6,7,9 -->
                <troopStrType typeId="3" count="{warrior}"/>
                <troopStrType typeId="5" count="{pike}"/>
                <troopStrType typeId="6" count="{sword}"/>
                <troopStrType typeId="7" count="{archer}"/>
                <troopStrType typeId="9" count="{cavalry}"/>
            </troops>
            <buildings>
                <buildingType type="{t}" levels="{l1,l2,...}"/>   <!-- t = 1..30 ascending; inner then outer
                                                                       slots; types 31/32 excluded -->
            </buildings>
        </scoutInfo>
        <battleInfo isAttack="true" unNomal="No defending troops found.">
            <backTroop>
                <troops heroLevel="{}" heroName="{}" heroUrl="{logourl}" isHeroBeSeized="false">  <!-- hero attrs only if hero -->
                    <troopInfo typeId="{idx+2}" remain="{n}"/>
                </troops>
            </backTroop>
        </battleInfo>
    </scoutReport>
</reportData>
```
(`resource` order is food, wood, iron, stone. The `buildings` element is always emitted.)

**Army returned** (§5.3.6):
```xml
<reportData reportUrl="{url}">
    <troopMovement isBack="true" type="{missiontype}" heroLevel="{}" heroName="{}" heroUrl="{}">  <!-- hero attrs only if hero -->
        <troops typeId="{idx+2}" count="{n}"/>      <!-- one element per non-zero type -->
    </troopMovement>
</reportData>
```

Report list metadata (`stReport`): `reportid, armytype (mission), back, attack, type_id (0 trade, 1 army,
2 other), startpos, targetpos, title, guid, eventtime, isread`. `server.NewReport` push:
`{count: unread total, army_count: unread type 1, trade_count: unread type 0, other_count: unread type 2}`.

**[REWRITE NOTE]** Store report bodies in Postgres (e.g. JSON or the same XML text) instead of files.

---

## 7. Formulas

### 7.1 Durations (producer side, packet handlers)
* **Build new** (`castle.newBuilding`): `ms = floor(1000 × cfg[type][0].time × 0.995^mayorManagement ×
  0.9^Construction)`; building set to `level 0, status 1, start=now, end=now+ms`. One construction/
  destruction at a time per city (any slot with status ≠ 0 blocks). Prereqs checked against
  `cfg[type][0]`; resources deducted immediately.
* **Upgrade**: `ms = floor(cfg[type][L].time × 0.995^mgmt × 0.9^Construction) × 1000`; items in
  `cfg[type][L].items` are consumed.
* **Destruct**: `ms = floor(cfg[type][L-1].destructtime × 1000 × 0.995^mgmt × 0.9^Construction)`
  (`destructtime = buildtime/2`), status 2.
  (`mayorManagement = management + managementadded + managementbuffadded`; no mayor ⇒ factor 1.)
* **Research**: `ms = floor(cfg[tech][level].time × 0.995^mayorStratagem) × 1000` (no tech modifier);
  only when `!city.m_researching`; resources deducted.
* **Troop training** (`AddToBarracksQueue`): queue length must be `< barracks level`.
  ```
  t = troopcfg[id].time
  if position == -2 (walls/forts): t *= 0.995^mayorManagement * 0.9^Construction
  else:
      m = 0.995^mayorPower
      if id in {catapult 13, ram 12, transporter 8, ballista 11}:
          t *= m * 0.9^MetalCasting          // then FALLS THROUGH (missing break) [BUG]:
      t *= m * 0.9^MilitaryScience
  costtime(ms) = floor(t) * count * 1000
  endtime = queue empty ? now + costtime : 0
  ```
* **Speed-up coin cost** `calculatecoinsforspeedup(msLeft)`:
  ```
  c = 0
  if t >= 8h:  c += 50*floor(t/8h);  t %= 8h
  if t > 6h:   return c + 50
  if t >= 2.5h: c += 20*floor(t/2.5h); t %= 2.5h
  if t > 2h:   return c + 20
  if t >= 1h:  c += 10*floor(t/1h);  t %= 1h
  if t > 30m:  return c + 10
  if t >= 15m: c  = 5*floor(t/15m);  t %= 15m      // [BUG] '=' instead of '+='
  if t > 0:    c += 5
  return c
  ```

### 7.2 March time `CalcTroopSpeed(city, troops, from, to)` → seconds (int32)
```
distance = sqrt((fx-tx)^2 + (fy-ty)^2)          // tile units, NO map wrap-around
mech = first present of: catapult 80, ballista 100, ram 120, transporter 150, cataphract 750, cavalry 1000; else 10000
foot = first present of: worker 180, warrior 200, archer 250, sword 275, pike 300, scout 3000; else 10000
academy = city level of Academy(25)
hbr     = min(research[HorsebackRiding 13].level, academy)
compass = min(research[Compass 12].level, academy)
mech *= 1 + 0.05*hbr
foot *= 1 + 0.10*compass
speed = min(mech, foot) / 1000 / 60              // tiles per second
return int(distance / speed)                     // = distance * 60000 / effectiveSpeed seconds
```
(The ordered if/else chains are equivalent to taking the minimum.) Example: warriors only, no tech:
`distance × 300 s` (5 min/tile). Dispatch sets `reachtime = now + seconds×1000 + resttime`
(**[BUG]** `restTime` from the client is in seconds but added as ms). Return trip duration = outbound
duration excluding rest (§5.3.5).

Dispatch-side checks (`army.newArmy`, scout/attack only): rally-spot limit compares against
`city.armymovement.size()` which is never populated **[BUG: no limit]**; beginner (−69); target owner missing
(−13); relation SELF/ALLIANCE/ALLY (−13); target beginner castle (−70); insufficient troops (−29); scout
mission without scouts (−61); attack without hero (−71); hero missing/not idle (−80). On success: troops
deducted, hero `status=ATTACK`, army added to `client.armymovement` (and `oclient.enemyarmymovement` for
attacks — **[BUG]** null `oclient` for NPC/valley attacks → crash).

### 7.3 City economy (`Client::CalculateResources` → per city `CalculateStats` + `CalculateResources`)

`client.population = Σ city.m_population`.

**`CalculateStats()`:**
```
maxres = {food:10000, wood:10000, stone:10000, iron:10000, gold:0}; production = 0; workpop = 0
maxpopulation = 50
for each inner building of type Cottage(1) at level L: maxpopulation += COTTAGE[L]
for each outer building of type Farm(7)→food, Sawmill(4)→wood, Quarry(5)→stone, Ironmine(6)→iron at level L:
    maxres[r] += FIELD_CAP[L]; production[r] += FIELD_CAP[L]/100; workpop[r] += FIELD_CAP[L]/1000
FIELD_CAP = [10000, 30000, 60000, 100000, 150000, 210000, 280000, 360000, 450000, 550000]   (L=1..10)
COTTAGE   = [100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500]
production[r] *= workrate[r]/100            (r = food, wood, stone, iron)
totalWork = int( Σ_r workrate[r]*workpop[r]/100 )
availablepopulation = population - totalWork            (uint32; underflows if negative)
efficiency = population >= totalWork ? 100 : population/totalWork*100
production.gold = population * workrate.gold/100        (workrate.gold = tax rate %)
```
Warehouses, techs (Agriculture etc.), valleys and mayor management are **not** applied
(`CalculateResourceStats` is an empty TODO; `m_resourcemanagement = m_resourcetech = m_resourcevalley = 0`,
`m_resourcebaseproduction = 100`).

**`CalculateResources()`** (accrual since `m_timers.updateresources`, then timer = now):
```
diff = now - lastUpdate (ms)
for r in food, wood, stone, iron:
    add = ((production[r] + 100) * efficiency/100 / 3_600_000) * (1 + management/100) * diff
    if r == food: add -= troopconsume                    // always 0; and per-call, not per-time [BUG]
    if res[r] < max[r]: res[r] = min(max[r], res[r] + add)   // never reduced if above cap
salary = Σ heroes level*20                               // gold/hour
res.gold = max(0, res.gold + (production.gold - salary) * diff/3_600_000)   // no gold cap
```
i.e. every city has a flat +100/h of each basic resource on top of field production.

### 7.4 Population and loyalty drift (`RecalculateCityStats`, every 6 min)
```
target = int(maxpopulation * min(loyalty + grievance, 100) / 100)
step   = int(maxpopulation * 0.05)
if population > target:
    if population - step < target: population = target
    elif population - step < 0: population = maxpopulation        // dead branch
    else: population -= step
elif population < target:
    if population + step > target: population = target
    elif population + step > maxpopulation: population = maxpopulation
    else: population += step
targetLoyalty = 100 - min(workrate.gold + grievance, 100)
if loyalty > 1: loyalty moves 1 point toward targetLoyalty
production.gold = population * workrate.gold/100
push server.ResourceUpdate
```
(Grievance is never changed by the engine.)

### 7.5 Relief station multiplier (`GetReliefMultiplier`, used by `army.getTroopParam`)
Relief Station level: 0 → 1; 1–3 → 2; 4 → 3; 5–7 → 4; 8–9 → 5; 10 → 6.
`getTroopParam`: `marchSkillParam = Compass×10`, `loadSkillParam = Logistics×10`,
`driveSkillParam = HorsebackRiding×5`, `transportStationParam = relief multiplier`.

---

## 8. Combat simulator (`CombatSimulator::fight`, BattleCalc.cpp)

Only invoked by the scout-vs-player-city path today, but it is a complete field-battle model (troops,
walls, forts) intended for attacks.

Inputs: `attacker{research, hero{attack, intel, leadership}, troops[12], attack/defence/life_modifier=1}`,
`defender{same + fortifications[5] (trap, abatis, archer tower, rolling log, trebuchet), wallLevel=0,
gateOpen, trapKillPower=logKillPower=rockKillPower=1.25}`. Output `battleResult{attackerTroops[12],
defenderTroops[12], fortification[5], result (1 = defender still alive), totalRounds}`.

**Base stats** `{life, attack, defense, speed, range}` by troop index:
worker {100,5,50,180,10}, warrior {200,50,50,200,20}, scout {100,20,50,3000,20}, pike {300,150,150,300,50},
sword {350,100,250,275,30}, archer {250,120,50,250,1200}, transporter {700,10,60,150,10},
cavalry {500,250,180,1000,100}, cataphract {1000,350,350,750,80}, ballista {320,450,160,100,1400},
ram {5000,250,160,120,600}, catapult {480,600,200,80,1500}.
Forts: trap {0,0,0,0,5000}, abatis {0,0,0,0,5000}, archer tower {2000,300,360,0,1300},
rolling log {0,500,0,0,1300}, trebuchet {0,800,0,0,5000}.

Groups: melee-type flag `troopTypes` = true for all except archer(5), ballista(9), catapult(11) (ranged);
ground = {0..5}; mech = {9,10,11}; mounted = {7,8}; ranged = {5,9,11};
nonRanged (target-preference order) = {7,8,3,4,1,0,6,2,10}.
Damage modifiers (attacker type → defender type, default 1 when 0): pike→cavalry 1.8, pike→cataphract 1.8,
sword→pike 1.1, cavalry→archer 1.2, cataphract→archer 1.2. (Column 14 = 0.3 for all, never used.)

**modifyStats** (per side, copy of base):
```
defense[i] = max( (1000 - int((IronWorking*5+100)/100) * ((100+hero.intel)/100) * defense[i] * defMod) / 1000, 0.5 )
ground i: life *= (Medicine*5+100)/100 * lifeMod; attack *= atkMod; speed *= (Compass*10+100)/100
mech i:   life *= lifeMod; attack *= atkMod; speed *= (HorsebackRiding*5+100)/100
ranged i: range *= (Archery*5+100)/100
mounted:  life *= lifeMod; attack *= atkMod; speed *= (HorsebackRiding*5+100)/100
```
("defense" is a damage-taken multiplier; lower is better. `(IW*5+100)/100` is integer division.)
Archer tower (defender): `life *= (Medicine*5+100)/100`, `attack *= atkMod`,
`defense = max(1 - (IW*5+100)*(100+intel)*360*defMod/1e7, 0.5)`,
`range *= (Archery*5 + wallLevel*4.5 + 100)/100`.

Setup: `wallHP = 50000 * wallLevel * (wallLevel+1)`. `field = max over present troop types (either side,
excluding scouts) of 200 + baseRange`, and over present forts of `200 + fortRange`; attackers start at 0,
defenders at `field`. Trap kill budget per round `trapDieRate = traps*(5 + rand()%5)/100`; abatis rate
`abatis/10`; log rate `logs/10`; rock rate `trebs/10`. `effectiveTroops` = count.

Rounds (max 100):
1. **Movement** in order `{2,7,8,3,4,1,0,6,10,5,9,11}`: for each type i:
   * defender i (not scout 2/transporter 6): if no living attacker within `location - range`, move
     `location = max(nearestAttackerLocation, location - speed)`;
   * attacker i: scouts(2)/transporters(6) only move if the attacker has nothing but scouts/transporters;
     if no living defender within `location + range`, `location = min(nearestDefenderLocation, location + speed)`.
2. **Attacks** in order `{2,7,8,3,4,5,1,0,6,10,9,11}`, defender of type i then attacker of type i:
   * Melee attacker: target = in-range enemy with minimum distance (ties → higher `attack × effective`);
     attackers additionally may target the archer tower (at `field`) if no troop is in range.
     `killed = modifier × count × attack × targetDefense / targetLife`.
   * Ranged attacker: target = in-range enemy ranged type with highest `attack × effective` (attackers also
     consider the archer tower), else fastest in-range non-ranged type.
     `mod = 0.25 if distance ≤ target.range and target is melee; 0.5 if distance > range/2; else 1`;
     `killed = ceil(attack × targetDefense × count × mod / targetLife)`.
   * `target.effective = max(0, effective - killed)`. Attacker with no target but `location + range ≥ field`
     hits the wall: `wallHP = max(0, wallHP - floor(count × attack))`.
   (Kills use `count` from the start of the round, so simultaneous.)
3. **Traps** (if traps): attacker types in `[field-5000, field)` get
   `kills = min(traps, trapDieRate) × 0.5 × 1.25 / nTypesInZone` each; traps -= used.
4. **Abatis**: first of cavalry, else cataphract in zone: `kills = min(abatis, abatis/10) × 0.535`
   (abatis are never consumed).
5. **Rolling logs**: among ground types 0–5 within `[field-1300, field)`, the one with max
   `effective × attack`: `kills = floor(min(logs, logs/10) × 1.25 × 500 × defense)`; logs -= used.
6. **Trebuchets**: among all types within `[field-5000, field)`, max `effective × attack`; if
   `effective×life×defense > rate×1.25×800`: trebs -= rate, kills = `floor(rate×800×1.25/(defense×life))`;
   else trebs -= `ceil(defense×life×effective/(1.25×800))`.
7. **Archer towers** (count = remaining): target ranged attacker (max attack×effective) within
   `field - towerRange`, else fastest non-ranged; `mod = 0.5 if distance > range/2 else 1`;
   `killed = attack × count × mod / (defense × life)`.
8. `count = effective` for all; attacker alive if any count > 0; defender alive if any count > 0 or
   `wallHP > 0`. Stop when either side is dead.

Result: per-type remaining counts, forts `{traps, abatis, archerTowers, logs, trebs}` remaining,
`result = defenderAlive`, `totalRounds = min(round+1, 100)`.

---

## 9. Hero generation

### 9.1 `RandomStat()` (base attribute roll)
```
r = rand() % 10000
r < 6500 → 15 + rand()%21   (15–35)   65.00 %
r < 8500 → 30 + rand()%21   (30–50)   20.00 %
r < 9500 → 45 + rand()%16   (45–60)   10.00 %
r < 9900 → 60 + rand()%11   (60–70)    4.00 %
r < 9950 → 70 + rand()%6    (70–75)    0.50 %
r < 9975 → 75 + rand()%5    (75–79)    0.25 %
else     → 10                           0.25 %
```

### 9.2 `CreateRandomHero(innlevel)` (tavern heroes)
```
level = rand() % (innlevel*5) + 1                    // 1 .. 5*innlevel
basemanagement = RandomStat(); basestratagem = RandomStat(); basepower = RandomStat()
pts = level
power = rand() % pts;            pts -= power;  power += basepower
management = rand() % pts;       pts -= management; management += basemanagement   // pts ≥ 1 here
stratagem = pts;                 stratagem += basestratagem                          // remainder
loyalty = 70; experience = 0; upgradeexp = level² × 100; id = 0 (assigned m_heroid++ on hire)
name = "Test Name" + power + management + stratagem   (decimal concatenation, e.g. "Test Name423155")
logourl = "images/icon/player/faceA20.jpg"
remainpoint = 0; *added/*buffadded = 0; status = IDLE
```
There is **no names list** in the source; names are placeholders. The tavern shows `innlevel` heroes
(slots `0 … innlevel-1`, generated lazily, cleared when the Inn finishes upgrading, re-rolled with the
`consume.refreshtavern.1` item). Hiring costs `level × 1000` gold and requires `Feasting Hall level >
HeroCount()`; the hired hero gets `id = m_heroid++` and is `InsertToDB`'d.

Hero effective stats: `GetPower() = power + poweradded + powerbuffadded` (same for management, stratagem);
returned as `int16`.

### 9.3 Temporary heroes
* NPC city hero: §4.3 `ResetHero` (level `1…10L`, stats 30–59, `poweradded = level`).
* Valley hero: §10 (level 1–20, stats 30–59, `poweradded = level`).
Both named `"TestName" + (0–99)`.

---

## 10. Valley data (`ValleyData::Reset(force)`)
Lazily created per tile on first scout; regenerated only if `force` or `now - lastUpdated ≥ 360 000 ms`.
```
hero: level 1 + rand()%20; power/management/stratagem 30 + rand()%30; poweradded = level; IDLE; "TestName"+rand()%100
troops = 0
types = []
if rand()%3 > 0: types += warrior(idx1)
if rand()%3 > 0: types += pike(idx3)
if L > 2 and rand()%3 > 0: types += sword(idx4)
if L > 4 and rand()%3 > 0: types += archer(idx5)
if L > 6 and rand()%3 > 0: types += cavalry(idx7)
if types empty: types = [warrior]
x = 2^(L-1) * 10000
budget = (x + rand()%x) / len(types)          // double
troops[t] = ceil(budget / TROOP_EXPS[t])
TROOP_EXPS (by idx 0..11) = [225, 305, 695, 900, 1350, 1350, 2975, 2850, 8750, 10000, 13750, 29000]
lastUpdated = now
```
`L` = tile level. **[BUG]** `m_tile` is never assigned by the caller, so `L` is read through an
uninitialised pointer. Valley troops are only used for scout reports (no valley combat exists).

---

## 11. Rankings (`SortPlayers`, `SortHeroes`, `SortCastles`, `SortAlliances`)
Rebuilt every 5 s (and at boot / new player creation). All sorts are stable descending; ranks 1…N.
* **Players** (all accounts): by `prestige` (also writes `client.prestigerank` and pushes
  `server.PlayerInfoUpdate` to connected clients), `honor`, `title`, `population`, `citycount`.
* **Heroes** (every hero in every player city): by `stratagem`, `power`, `management`, `grade=level`
  (base values without added/buff); entries carry `name`, `kind = owner playername`.
* **Castles** (player cities): by Town Hall level (`grade = "Level N"`) and `population`; entries carry
  name, owner, alliance name.
* **Alliances**: `members` list (two stable sorts: by prestige, then by member count ⇒ member count desc,
  ties by prestige), `prestige` (Σ member prestige),
  `honor` (Σ member honor); also recomputes `m_allicitycount`. (`stAlliance` stores members/honor/prestige in
  a union — the three lists use separate structs so it works.)
* **Rank search** (`DoRankSearch(key, type 1 player / 2 hero / 3 castle / 4 alliance, list, …)`):
  case-insensitive substring match on player name / hero name / castle name / alliance name; results cached
  by `(list, key)` and returned as a filtered list with original ranks; caches expire after 30 s (§5.7).

---

## 12. Messaging helpers

* `SendMessage(client, msg, nosender, tv, alliance)` / `MassMessage(...)` → `server.SystemInfoMsg
  {alliance, tV, noSenderSystemInfo, msg}`.
* `CloseClient(client, reasonCode, msg)` → `server.ConnectionLost {reasonCode, msg}` then close socket.
  Reason codes: 1 server restarting, 2 server about to shut down, 3 logged in elsewhere, 4 maintenance,
  5 custom message.
* `CreateMail(sender, receiver, subject, content, type)`: sender `"System"` ⇒ `senderid 0`. Appends
  `stMail` to receiver's list and inserts `mail(senderid, receiverid, title, content, senttime=now, type,
  pid=rcv.mailpid++)`. For player senders it then creates the "sent" copy **[BUG: pushed to the receiver's
  list, DB row has receiverid = receiver and the original type, `pid = snd.mailpid++`]**. No `server.NewMail`
  push is sent by `CreateMail`.
* Error envelopes: `CreateError(cmd, code, msg)` = `{cmd, data:{errorMsg, packageId: 0.0, ok: code}}`;
  `CreateError3(cmd, code, msg)` = `{cmd, data:{reasonCode, msg}}`.
* Chat commands (`ParseChat`, message starting with `\`; returns false so the text isn't broadcast;
  reply via SystemInfoMsg): `motd` (rank ≥3 check, otherwise nothing), `restart` (only player "Daisy":
  kick all, shutdown), `online` (count of clients with a socket), `debug` (toggle echo of every received
  command), `massmsg <text>` (only "Daisy"; `&lt;` → `<`), `cents` (**anyone**: +50 000 cents), `resources`
  (**anyone**: +10 000 000 of each resource to focus city), `tempvar <n>` (sets `icon`), `kick <code>|<msg>`
  (kicks the *caller*), `buff <id> <desc> <n>` (`endtime = now + n` ms), `commands`, unknown →
  "Command '<cmd>' does not exist." **[REWRITE NOTE]** gate these behind an admin flag.

---

## 13. Persistence and shutdown

* Shutdown trigger: SIGINT/SIGTERM/SIGQUIT (asio signal set), `\restart`, or `stop()`. `Shutdown()`:
  `serverstatus = SHUTDOWN` (timer loop exits), close acceptor, `MassDisconnect()` (each connected client
  gets SystemInfoMsg "Server shutting down." and `server.ConnectionLost {reasonCode:4, msg:""}`), stop all
  connections, stop io_service.
* After threads join, `run()` saves:
  1. every `Client::SaveToDB()` (`UPDATE accounts SET buffs, research, items, misc, status, ipaddress, sex,
     flag, faceurl, allianceid, alliancerank, cents, prestige, honor, lastlogin, changedface, icon,
     allianceapply, allianceapplytime, castlesign WHERE accountid`);
  2. every city `PlayerCity::SaveToDB()` (`UPDATE cities SET misc, status, allowalliance, logurl, fieldid,
     transingtrades, troop, troopqueues, name, buildings, fortification, trades, gooutforbattle, hasenemy,
     gold, food, wood, iron, stone WHERE id`);
  3. every hero `Hero::SaveToDB()` (all stat columns, `troop=''`, name, castleid, ownerid, status,
     remainpoint);
  4. `TRUNCATE armies` then insert every army in `armylist` (`heroid` or −1, direction, resource string,
     troop string, starttime, reachtime, resttime, missiontype, startfieldid, targetfieldid, cityid,
     clientid);
  5. `TRUNCATE reports` then insert every report of every client (fails on the `typeid` column, §3.2).
* Mid-session saves happen only inside packet handlers (e.g. after building/research/army actions, account
  creation). A crash loses all timer-driven changes since the last such save (training completions,
  research/building completions, resource accrual, prestige, reports, armies).

**[REWRITE NOTE]** Make every timer mutation transactional in Postgres (or persist on a short interval) and
derive state from timestamps rather than relying on a clean shutdown.

---

## 14. Wire protocol (brief — the rewrite uses JSON)

* **Transport:** raw TCP on `bindport` (Flash client). Every message in both directions is
  `uint32 big-endian length` + one AMF3-encoded value (always an Object: `{cmd: "group.command",
  data: {...}}`).
* **Inbound limits:** length must satisfy `4 ≤ size < MAXPACKETSIZE (32768/10 = 3276 bytes)` or the
  connection is closed. Body sanity check: first bytes should be `0x0A 0x0B 0x01` (AMF3 Object marker,
  traits = dynamic anonymous) — the check uses `&&` so it only rejects if *all three* bytes differ.
* **Outbound:** encoded into a 15 000-byte stack buffer (no bounds check). Writer uses the AMF3 string
  reference table (repeated strings sent as references) and object reference table; integers use AMF3
  U29 (values beyond 29 bits are truncated), doubles big-endian.
* **Dispatch:** `cmd` split on `.` → group (`common, report, server, castle, field, quest, alliance, tech,
  login, rank, trade, shop, mail, fortifications, troop, interior, hero, friend, city, furlough, army,
  gameClient`, else unknown) → handler class. Empty group/command (except `login`) is dropped. With
  `debugmode`, every command name is echoed to the player as a system message. Server pushes use `server.*`
  commands (`PlayerInfoUpdate`, `ResourceUpdate`, `TroopUpdate`, `FortificationsUpdate`, `HeroUpdate
  {castleId, hero, updateType 0 hire/1 fire/2 update}`, `BuildComplate`, `ResearchCompleteUpdate`,
  `SelfArmysUpdate {armys:[armyBean]}`, `FriendArmysUpdate`/`EnemyArmysUpdate` (**[BUG]** array built but
  never attached), `NewReport`, `NewMail`, `PlayerBuffUpdate`, `ItemUpdate`, `CastleUpdate`,
  `InjuredTroopUpdate`, `SystemInfoMsg`, `ConnectionLost`). Note `TroopUpdate` uses the misspelled key
  `caslteId`.
* `armyBean` (`stArmyMovement::ToObject`): `hero` (name), `direction`, `resource{wood,food,stone,gold,iron}`,
  `startPosName`, `king`, `troop{peasants, militia, scouter, pikemen, swordsmen, archer, carriage,
  lightCavalry, heavyCavalry, ballista, batteringRam, catapult}`, `startTime`, `armyId`, `reachTime`,
  `heroLevel`, `restTime`, `missionType`, `startFieldId`, `targetFieldId`, `targetPosName`.
* **Flash socket policy:** handler exists (`startpolicy`) but its port-843 listener is commented out, and
  the game port does not recognise the request (the 4-byte length read of `<pol` exceeds the limit and the
  socket is closed). If served, the server reads exactly 22 bytes, compares to `<policy-file-request/>`,
  and writes 246 bytes:
  `<?xml version="1.0"?><!DOCTYPE cross-domain-policy SYSTEM "/xml/dtds/cross-domain-policy.dtd"><cross-domain-policy><site-control permitted-cross-domain-policies="master-only"/><allow-access-from domain="*" to-ports="*" /></cross-domain-policy>`
  followed by `\n\n\0`.
* Connection lifecycle: on accept, `uid = rand()*rand()*rand()`, `PlayerCount(+1)`; on stop the online count
  is recomputed as "clients with a socket", and `client.socket = null`, `socknum = 0` (`connected` is not
  cleared).

---

## 15. Bugs, gaps and TODOs (consolidated)

**Not implemented (must be designed for the rewrite):**
1. Attack missions on arrival (battle vs valley/NPC/player, plunder, loyalty reduction/capture of NPC
   cities and valleys, city capture, hero capture on attack, battle reports, honor). Combat simulator exists
   (§8) but is unused for attacks.
2. Transport (delivering resources), reinforce (STAY/camping, recall via `army.callBackArmy` is an empty
   handler), build-city/colonise missions.
3. Scout report for scouting a player city (TODO in source); defender-side notifications/reports.
4. Injured troops / relief station; troop upkeep (food consumption); warehouse protection; tech, valley,
   mayor and buff production bonuses; hero salary is the only gold sink.
5. Hero leveling from experience; general (non-mayor) hero XP; loyalty dynamics.
6. Beginner protection is never granted (flag always false) and never expires on a timer.
7. Market processing; trades not persisted.
8. Periodic autosave; persistent map (random each boot); `castlesign`, `gooutforbattle`, city `status`,
   `allowalliance` not restored at boot.
9. `config_quests` and `settings.itemxml` not loaded.

**Defects to avoid reproducing:**
1. Alliance-less players loaded from DB have `allianceid 0` ⇒ `GetRelation` returns `ALLIANCE` for any pair.
2. Restored armies all have timed-event id 0 ⇒ one `armylist.remove` deletes all of them.
3. Arrival with ATTACK/TRANS/REINF/BUILDCITY never resolves (army and hero stuck forever, re-checked every 100 ms).
4. Null dereferences: missing target owner on arrival; `c->client = 0; c->client->SelfArmyUpdate()`; scout
   return without hero; `oclient` for NPC/valley attacks at dispatch.
5. Captured hero inserted into every empty defender slot; un-captured "returned" hero left SEIZED.
6. `ValleyData::m_tile` never set.
7. Troop-queue restore grants queued troops instantly and resets the first item's timer; restored fort items lost.
8. `AddToBarracksQueue` switch fall-through double-applies the mayor factor for siege units.
9. `restTime` seconds added as ms; rally-spot army limit never enforced.
10. Buff and account-misc DB serialisation broken (`%?d` for strings; `icon` as char; `haschangedface`
    always true).
11. Reports: `typeid` vs `type_id`, missing `reportid`; heroes: missing `hbuffs`/`troops`.
12. `CreateMail` sent-copy goes to the receiver.
13. Building events with unexpected status never leave `buildinglist`.
14. `NpcCity::Initialize` before `m_level` assignment when loading map from DB; uint32 `ownerid = -1`.
15. `calculatecoinsforspeedup` 15-minute bucket uses `=` instead of `+=`.
16. IO thread and timer thread mutate shared state without locks.
17. `enemyarmymovement` never cleaned (dangling pointers); `Friend/EnemyArmysUpdate` send empty payloads.
18. Debug/cheat chat commands (`\cents`, `\resources`) available to every player.

**[REWRITE NOTE] suggested engine shape for TypeScript/Postgres:** a single authoritative tick loop
(100 ms) driven by a priority queue of due events keyed by `endtime/reachtime` (instead of scanning lists),
lazy resource accrual from timestamps (`CalculateResources` is already timestamp-based), periodic jobs at
5 s / 1 min / 6 min as above, and every state transition committed in one DB transaction.

---

## Appendix A — `config_building` base values (level 1; level L = base × 2^(L-1))

Columns: time (s), wood, food, stone, iron, gold (always 0), inside, blimit, prereqbuilding per level.
Every level-10 row additionally has `prereqitem = '19,1'` (1× `consume.blueprint.1`); all other rows
`'0,0'`. `prereqtech` is `''` except rows 14–18.

| id | Building | time | wood | food | stone | iron | inside | blimit | prereqbuilding (L1…L10) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Cottage | 75 | 500 | 100 | 100 | 50 | 1 | 0 | L1–2 none; L3–10 `31,L-1` (Town Hall L−1) |
| 2 | Barracks | 300 | 1200 | 250 | 1500 | 500 | 1 | 0 | `29,1` (Rally Spot 1) all levels |
| 3 | Warehouse | 600 | 1500 | 100 | 1000 | 300 | 1 | 0 | none |
| 4 | Sawmill | 45 | 100 | 100 | 250 | 300 | 0 | 0 | none |
| 5 | Quarry | 60 | 500 | 180 | 150 | 400 | 0 | 0 | none |
| 6 | Ironmine | 90 | 600 | 210 | 500 | 200 | 0 | 0 | none |
| 7 | Farm | 30 | 300 | 50 | 200 | 150 | 0 | 0 | none |
| 20 | Stable | 270 | 2000 | 1200 | 800 | 1000 | 1 | 1 | `7,5` (Farm 5) |
| 21 | Inn | 240 | 2000 | 300 | 1000 | 400 | 1 | 1 | `1,2` (Cottage 2) |
| 22 | Forge | 180 | 1000 | 125 | 600 | 1200 | 1 | 1 | `6,3` (Ironmine 3) |
| 23 | Marketplace | 750 | 1000 | 1000 | 1000 | 1000 | 1 | 1 | none |
| 24 | Relief Station | 3600 | 5000 | 1500 | 4500 | 500 | 1 | 1 | `20,1` (Stable 1) |
| 25 | Academy | 480 | 2500 | 120 | 1500 | 200 | 1 | 1 | `31,2` |
| 26 | Workshop | 540 | 1500 | 150 | 500 | 1500 | 1 | 1 | `22,2` (Forge 2) |
| 27 | Feasting Hall | 300 | 2500 | 400 | 1200 | 700 | 1 | 1 | `21,1` (Inn 1) |
| 28 | Embassy | 720 | 2000 | 200 | 500 | 300 | 1 | 1 | `31,2` |
| 29 | Rally Spot | 150 | 600 | 100 | 2000 | 150 | 1 | 1 | none |
| 30 | Beacon Tower | 450 | 1000 | 150 | 3000 | 300 | 1 | 1 | `2,1` (Barracks 1) |
| 31 | Town Hall | 1800 | 3000 | 200 | 2500 | 200 | 1 | 1 | L1–2 none; L3–10 `32,L-2` (Walls L−2) |
| 32 | Walls | 1800 | 1500 | 3000 | 10000 | 500 | 2 (L10: 1) | 1 | L1–2 `5,2|26,1`; L3–10 `31,L-2` |
| 14 | (Trap) | 60 | 500 | 50 | 100 | 50 | 3 | 0 | `32,1`; tech `0,0` (single level) |
| 15 | (Abatis) | 120 | 1200 | 100 | 0 | 150 | 3 | 0 | `32,2`; tech `5,1` |
| 16 | (Archer Tower) | 180 | 2000 | 200 | 1000 | 500 | 3 | 0 | `32,3`; tech `14,3` |
| 17 | (Rolling Log) | 360 | 6000 | 300 | 0 | 0 | 3 | 0 | `32,5`; tech `5,4` |
| 18 | (Trebuchet) | 600 | 0 | 600 | 8000 | 0 | 3 | 0 | `32,7`; tech `5,6` |

## Appendix B — `config_troops`

| id | unit | time (s/unit) | pop | wood | food | stone | iron | gold | inside | prereq bld | prereq tech | (ignored) life/atk/def/load/movecost/speed/range |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Worker | 50 | 1 | 150 | 50 | 0 | 10 | 0 | 1 | `2,1` | — | 100/5/10/200/2/11/10 |
| 3 | Warrior | 25 | 1 | 100 | 80 | 0 | 50 | 0 | 1 | `2,1` | — | 200/50/50/20/3/12/20 |
| 4 | Scout | 100 | 1 | 200 | 120 | 0 | 150 | 0 | 1 | `2,2` | `7,1` | 100/20/20/5/5/180/20 |
| 5 | Pike | 150 | 1 | 500 | 150 | 0 | 100 | 0 | 1 | `2,2` | `9,1` | 300/150/150/40/6/18/50 |
| 6 | Swords | 225 | 1 | 150 | 200 | 0 | 400 | 0 | 1 | `2,3` | `10,1` | 350/100/250/30/7/17/30 |
| 7 | Archer | 350 | 2 | 350 | 300 | 0 | 300 | 0 | 1 | `2,4` | `14,1` | 250/120/50/25/9/15/1200 |
| 8 | Transporter | 1000 | 3 | 1500 | 600 | 0 | 350 | 0 | 1 | `2,6` | `11,1|5,3` | 500/250/180/100/18/60/100 |
| 9 | Cavalry | 500 | 6 | 600 | 1000 | 0 | 500 | 0 | 1 | `2,5` | `13,1` | 1000/350/350/80/35/45/80 |
| 10 | Cataphract | 1500 | 4 | 500 | 2000 | 0 | 2500 | 0 | 1 | `2,7` | `10,5|13,5` | 700/10/60/5000/10/9/10 |
| 11 | Ballista | 3000 | 5 | 3000 | 2500 | 0 | 1800 | 0 | 1 | `2,9` | `5,5|14,6` | 320/450/160/35/50/6/1400 |
| 12 | Ram | 4500 | 10 | 6000 | 4000 | 0 | 1500 | 0 | 1 | `2,9` | `10,8|5,7` | 5000/250/160/45/100/7/600 |
| 13 | Catapult | 6000 | 8 | 5000 | 5000 | 8000 | 1200 | 0 | 1 | `2,10` | `5,10|14,10` | 480/600/200/75/250/5/1500 |
| 14 | Trap | 60 | 1 | 500 | 50 | 100 | 50 | 0 | 2 | `32,1` | — | 0 |
| 15 | Abatis | 120 | 2 | 1200 | 100 | 0 | 150 | 0 | 2 | `32,2` | `5,1` | 0 |
| 16 | Archer Tower | 180 | 0 | 2000 | 200 | 1000 | 500 | 0 | 2 | `32,3` | `14,3` | 0 |
| 17 | Rolling Log | 360 | 5 | 6000 | 300 | 0 | 0 | 0 | 2 | `32,5` | `5,4` | 0 |
| 18 | Trebuchet | 600 | 4 | 0 | 600 | 8000 | 0 | 0 | 2 | `32,7` | `5,6` | 0 |

(Note the DB's transporter/cavalry/cataphract stat columns look shifted relative to the hard-coded battle
stats; the battle uses §8 values.)

## Appendix C — `config_research` base values (level 1; ×2^(L-1))

| id | Tech | time | wood | food | stone | iron | gold | prereqbuilding (L = research level) | prereqtech |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Agriculture | 400 | 0 | 500 | 0 | 0 | 1000 | `25,1|7,L` | — |
| 2 | Lumbering | 500 | 500 | 0 | 0 | 100 | 1200 | `25,1|4,L` | — |
| 3 | Masonry | 600 | 0 | 0 | 500 | 200 | 1500 | `25,2|5,L` | `2,1` |
| 4 | Mining | 700 | 0 | 0 | 0 | 800 | 2000 | `25,2|6,L` | `3,1` |
| 5 | Metal Casting | 900 | 500 | 0 | 0 | 500 | 5000 | L1–5 `25,3|26,1`; L6–10 `25,1|26,1` | `4,2` |
| 7 | Informatics | 300 | 0 | 300 | 0 | 0 | 2000 | `25,3` | — |
| 8 | Military Science | 900 | 100 | 600 | 100 | 150 | 2500 | `25,1|22,L` | — |
| 9 | Military Tradition | 1200 | 120 | 800 | 0 | 200 | 3000 | `25,1` | `8,1` |
| 10 | Iron Working | 1500 | 150 | 700 | 0 | 300 | 3500 | `25,3` | — |
| 11 | Logistics | 1600 | 0 | 500 | 200 | 0 | 3000 | `25,4` | `8,2` |
| 12 | Compass | 1800 | 0 | 600 | 0 | 0 | 3000 | `25,4` | `8,3` |
| 13 | Horseback Riding | 2000 | 0 | 1000 | 0 | 0 | 6000 | `25,5|20,1` | `8,5` |
| 14 | Archery | 2400 | 800 | 0 | 500 | 600 | 5000 | `25,4` | `8,4` |
| 15 | Stockpile | 900 | 1200 | 0 | 1000 | 800 | 2000 | `25,6|3,L` | `2,3` |
| 16 | Medicine | 1800 | 0 | 1500 | 0 | 0 | 3600 | `25,6` | `11,3` |
| 17 | Construction | 1800 | 2000 | 0 | 2000 | 2000 | 5000 | `25,5` | `2,5|5,2` |
| 18 | Engineering | 2100 | 2500 | 0 | 3000 | 1500 | 6000 | `25,8` | `17,3` |
| 19 | Machinery | 2400 | 600 | 0 | 700 | 800 | 5500 | `25,9` | `5,4` |
| 20 | Privateering | 3600 | 0 | 5000 | 0 | 2000 | 10000 | `25,10` | `7,5|8,8` |

`prereqitem` is `''` for all research rows.

## Appendix D — Gamble pools (from `config_items`, `cangamble = 1`)

* **ultrarare (rarity 1):** consume.hegemony.1
* **superrare (2):** player.box.hero.d, player.box.special.2, player.box.special.3, player.box.troop.d,
  player.gold.1.b, player.more.castle.1.a, player.name.1.a, player.relive.1
* **rare (3):** consume.1.c, consume.2.c.1, consume.2.d, consume.blueprint.1, hero.loyalty.8,
  hero.loyalty.9, hero.reset.1.a, player.attackinc.1.b, player.box.hero.c, player.box.special.1,
  player.box.troop.c, player.defendinc.1.b, player.experience.1.c, player.heart.1.a
* **special (4):** consume.2.b.1, consume.2.c, consume.changeflag.1, player.box.gambling.medal.10,
  player.box.hero.b, player.destroy.1.a, player.experience.1.b, player.gold.1.a, player.peace.1,
  player.pop.1.a, player.resinc.1.b, player.resinc.2.b, player.resinc.3.b, player.resinc.4.b,
  player.troop.1.a, player.troop.1.b
* **common (5 / other):** consume.1.a, consume.1.b, consume.2.a, consume.2.b, consume.move.1,
  consume.refreshtavern.1, consume.transaction.1, hero.loyalty.1–7, hero.reset.1, player.attackinc.1,
  player.box.gambling.{food,gold,iron,stone,wood}, player.box.hero.a, player.box.troop.a,
  player.box.troop.b, player.defendinc.1, player.experience.1.a, player.fort.1.c, player.resinc.1–4,
  player.queue.building

`itemtype` values seen: 0 (medals), 1, 2 (boxes/chests), 3 (resource/tax boosts), 4 (general consumables).
`daylimit` 3650 = permanent ambassador items, 15/30/90 = timed items.

## Appendix E — New-player city defaults (from `common.createNewPlayer`, for context)
Account row inserted (`buffs/research/items/misc` empty); city row with `misc` default (§3.3),
`buildings = "31,1,-1,0,0.000000,0.000000"` (Town Hall L1), 100 000 of every resource,
`logurl = images/icon/cityLogo/citylogo_01.png`; in memory: 10 000× `consume.1.a`, `cents = 5000`, rankings
re-sorted, `CalculateOpenTiles()`. **[BUG]** after the city insert the code sets
`client.accountid = LAST_INSERT_ID()` of the *cities* table.
