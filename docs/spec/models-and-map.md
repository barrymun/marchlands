# Evony Age 1 Private Server: Models, City Economy and Map Specification

Source of truth: the C++ server at `evony-private-server/src`. This spec covers `Client`, `PlayerCity`, `City`, `NpcCity`, `Tile`, `ValleyData`, `Map` and `Utils`. Where they matter, it also covers the pieces of `structs.h`, `defines.h`, `spitfire.cpp` and `packets/*.cpp` that read or drive these models.

Conventions in this document:
- **"As-is"** marks behaviour reproduced from the C++, including bugs. **"Recommendation"** marks a suggested fix for the TypeScript rewrite. Never silently "fix" an as-is item when you need client compatibility or legacy-data compatibility.
- All timestamps are **milliseconds since Unix epoch** (`Utils::time()`), stored as JS `number`.
- `M` = `mapsize` (default 800, overridden by the server config JSON key `mapsize`).
- Client wire format is AMF3 objects. Key names are given exactly, typos included (e.g. `storeRercent`, `texRate`, `caslteId`).

---

## 0. Global constants and IDs (`defines.h`)

### 0.1 Tile types
| Const | Value | Meaning |
|---|---|---|
| FOREST | 1 | valley |
| DESERT | 2 | valley |
| HILL | 3 | valley |
| SWAMP | 4 | valley |
| GRASS | 5 | valley |
| LAKE | 6 | valley |
| FLAT | 10 | empty plain (a city can be founded here) |
| CASTLE | 11 | player city |
| NPC | 12 | barbarian (NPC) city |

Values 7–9 are unused. Any `type > 10` is a "city tile" (castle or NPC).

### 0.2 Building type IDs
| ID | Const | Name (`Utils::GetBuildingName`) |
|---|---|---|
| 1 | B_COTTAGE | "Cottage" |
| 2 | B_BARRACKS | "Barracks" |
| 3 | B_WAREHOUSE | "Warehouse" |
| 4 | B_SAWMILL | "Sawmill" |
| 5 | B_STONEMINE | "Stonemine" |
| 6 | B_IRONMINE | "Ironmine" |
| 7 | B_FARM | "Farm" |
| 20 | B_STABLE | "Stable" |
| 21 | B_INN | "Inn" |
| 22 | B_FORGE | "Forge" |
| 23 | B_MARKETPLACE | "Marketplace" |
| 24 | B_RELIEFSTATION | "Relief Station" |
| 25 | B_ACADEMY | "Academy" |
| 26 | B_WORKSHOP | "Workshop" |
| 27 | B_FEASTINGHALL | "Feasting Hall" |
| 28 | B_EMBASSY | "Embassy" |
| 29 | B_RALLYSPOT | "Rally Spot" |
| 30 | B_BEACONTOWER | "Beacon Tower" |
| 31 | B_TOWNHALL | "Town Hall" |
| 32 | B_WALLS | "Walls" |
| any other | — | "Failed" |

### 0.3 Troop / fortification type IDs (`TR_*`)
| ID | Const | Internal index (stTroops / battle arrays) = ID − 2 | Client key |
|---|---|---|---|
| 2 | TR_WORKER | 0 worker | `peasants` |
| 3 | TR_WARRIOR | 1 warrior | `militia` |
| 4 | TR_SCOUT | 2 scout | `scouter` |
| 5 | TR_PIKE | 3 pike | `pikemen` |
| 6 | TR_SWORDS | 4 sword | `swordsmen` |
| 7 | TR_ARCHER | 5 archer | `archer` |
| 8 | TR_TRANSPORTER | 6 transporter | `carriage` |
| 9 | TR_CAVALRY | 7 cavalry | `lightCavalry` |
| 10 | TR_CATAPHRACT | 8 cataphract | `heavyCavalry` |
| 11 | TR_BALLISTA | 9 ballista | `ballista` |
| 12 | TR_RAM | 10 ram | `batteringRam` |
| 13 | TR_CATAPULT | 11 catapult | `catapult` |
| 14 | TR_TRAP | fort index 0 | `trap` |
| 15 | TR_ABATIS | fort index 1 | `abatis` |
| 16 | TR_ARCHERTOWER | fort index 2 | `arrowTower` |
| 17 | TR_ROLLINGLOG | fort index 3 | `rollingLogs` |
| 18 | TR_TREBUCHET | fort index 4 | `rockfall` |

There is also a legacy set (`WORKER 1 … CATAPULT 11`, with no ballista). The models do not use it. Ignore it.

### 0.4 Research (tech) IDs (`T_*`)
1 Agriculture, 2 Lumbering, 3 Masonry, 4 Mining, 5 Metal Casting, 7 Informatics, 8 Military Science, 9 Military Tradition, 10 Iron Working, 11 Logistics, 12 Compass, 13 Horseback Riding, 14 Archery, 15 Stockpile, 16 Medicine, 17 Construction, 18 Engineering, 19 Machinery, 20 Privateering. (IDs 0, 6 and 21–24 are unused, but `Client.research` has 25 slots, indices 0..24.)

### 0.5 Other enums
- City/player status: `DEF_NORMAL 0, DEF_PEACETIME 1, DEF_TRUCE 2, DEF_BEGINNER 3, DEF_HOLIDAY 5`.
- Relations: `DEF_ALLIANCE 0, DEF_ALLY 1, DEF_NEUTRAL 2, DEF_ENEMY 3, DEF_NORELATION 4, DEF_SELFRELATION 5`.
- Alliance ranks: `HOST 4, VICEHOST 5, PRES 6, OFFICER 7, MEMBER 8`.
- Hero status: `IDLE 0, MAYOR 1, ATTACK 3, SEIZED 4, RETURN 5`.
- Missions: `TRANS 1, REINF 2, SCOUT 3, BUILDCITY 4, ATTACK 5`.
- Army direction: `FORWARD 1, BACKWARD 2, STAY 3`.
- Mail types: `INBOX 1, SYSTEM 2, SENT 3`.
- Timed action kinds: `DEF_RESEARCH 1, DEF_BUILDING 2, DEF_TRAIN 3`.
- `DEF_MAXITEMS = 400`, `DEF_STATES = 16`.

### 0.6 Coordinates
- `id = y * M + x`. `x = id % M`. `y = floor(id / M)`. Use integer division.
- Coordinates are 0-based. The map is a torus: `mapInfoSimple` wraps edges (see §8.5).

---

## 1. Shared structs

### 1.1 `stResources` (gold, food, wood, stone, iron), all `double`
The constructor argument order is `(gold, food, wood, stone, iron)`. **Every `SetResources`/`SetMaxResources` call uses this order.**
`ToObject()` → `{ wood, food, stone, gold, iron }` (numbers).

### 1.2 `stForts` (int32): `traps, abatis, towers, logs, trebs` (this order is used everywhere)

### 1.3 `stTroops` (int64 ×12), in this memory order:
`worker, warrior, scout, pike, sword, archer, transporter, cavalry, cataphract, ballista, ram, catapult` (index = TR id − 2).
`ToObject()` → `{ peasants, catapult, archer, ballista, scouter, carriage, heavyCavalry, militia, lightCavalry, swordsmen, pikemen, batteringRam }`.

### 1.4 `stBuilding`
| Field | Type | Meaning |
|---|---|---|
| id | int16 | position id (see §3.2) |
| level | int16 | 0..10 |
| type | int16 | building type id; 0 = empty slot |
| status | int16 | 0 = idle, 1 = upgrading/building, 2 = destructing |
| starttime | double ms | construction start |
| endtime | double ms | construction end |

`ToObject()` → `{ startTime, endTime, level, status, typeId, positionId, name }` (`name` = `GetBuildingName(type)`).

### 1.5 `stTroopTrain` (one training batch): `troopid int16, count int32, queueid int32, starttime, endtime, costtime (double ms)`.
### 1.6 `stTroopQueue` (one per barracks or walls): `status int8, positionid int16, nextqueueid int32, queue: list<stTroopTrain>`.
- Only the head of the queue has a real `endtime`. Later entries have `endtime = 0`. When the head completes, the next entry's `endtime = now + costtime`.

### 1.7 `stArmyMovement`
Fields: `hero*, heroname, direction, resources (stResources), startposname, king, troops (stTroops), starttime, armyid, reachtime, herolevel, resttime, missiontype, startfieldid, targetfieldid, targetposname, city*, client*`.
`ToObject()` → `{ hero (name string), direction, resource {wood,food,stone,gold,iron}, startPosName, king, troop {…stTroops keys}, startTime (number), armyId, reachTime (number), heroLevel, restTime (number), missionType, startFieldId, targetFieldId, targetPosName }`.

### 1.8 Other structs used by Client
- `stBuff { id string, desc string, endtime double }`
- `stItem { id string (item name key e.g. "player.resinc.1"), name, count int64, mincount int64, maxcount int64 }`
- `stResearch { level int16, castleid uint32, endtime double, starttime double }`
- `stMail { mailid uint32, playerid uint64 (sender), type_id int8, title, content, senttime uint64, readtime uint64 }`. `isread = readtime > 0`.
- `stReport { reportid uint32, armytype int8, back bool, attack bool, type_id int8 (0 trade, 1 army, 2 other), startpos, targetpos, title, guid (28 chars [0-9a-z]), eventtime uint64, isread bool }`
- `stCastleSign { tileid, id (castle db id), name, x, y }`
- `stPackage { desc, name, status, type, minmedal, maxmedal, id, isusenow, scores, providetime, expiredtime, claimedtime string, items: stItem[] }`
- `stBuildingConfig` (also used for troop and research config): `food, wood, iron, stone, gold (double), population int32, time double (seconds), destructtime double, buildings: stPrereq[], techs: stPrereq[], items: stPrereq[], limit, inside, prestige`. `stPrereq = { id, level }`.

---

## 2. `City` (base class of PlayerCity and NpcCity)

### 2.1 Fields
| Field | Type | Default | Meaning |
|---|---|---|---|
| m_cityname | string | "" | city name |
| m_status | int8 | 0 | city status (sent as `status`/`state`) |
| m_tileid | int32 | 0 | map tile id (`fieldId`) |
| m_type | int8 | 0 | `CASTLE` (11) or `NPC` (12) |
| m_level | int8 | 0 | city level. **Automatically set to the Town Hall level** whenever `SetBuilding` writes a type-31 building |
| m_loyalty | int8 | 0 | loyalty / "support" (0..100) |
| m_grievance | int8 | 0 | grievance / "complaint" (0..100) |
| m_resources | stResources | 0 | current stock |
| m_maxresources | stResources | 0 | storage caps |
| m_forts | stForts | 0 | fortification counts |
| m_innerbuildings[35] | stBuilding | zeroed | index = position + 2 |
| m_outerbuildings[41] | stBuilding | zeroed | index = position − 1000 |

### 2.2 `SetBuilding(type, level, position, status=0, starttime=0, endtime=0) → bool`
1. If `position > 1000` (outer):
   - If `position − 1000 > 40`, log an error and return false.
   - Write `m_outerbuildings[position−1000] = {id: position, type, level, status, starttime, endtime}` and return true.
   - Valid outer positions are therefore **1001..1040**. Position 1000 falls into the inner branch and is rejected.
2. Else (inner):
   - If `position < −2 || position > 31`, log an error and return false.
   - If `m_type == CASTLE` and `type ∈ {B_BARRACKS (2), B_WALLS (32)}`:
     - If `level > 0` and no troop queue exists for this position, push a new `stTroopQueue{ nextqueueid: 0, positionid: position, status: 0 }`.
     - Else if `level == 0` and a queue exists for this position, erase that queue.
   - If `type == B_TOWNHALL` and the city is a CASTLE or NPC, set `m_level = level`.
   - Write `m_innerbuildings[position+2] = {id: position, type, level, status, starttime, endtime}` and return true.

Removing a building: call `SetBuilding(0, 0, pos)`.

### 2.3 `GetForts(type)`
Maps TR_TRAP→traps, TR_ABATIS→abatis, TR_ARCHERTOWER→towers, TR_ROLLINGLOG→logs, TR_TREBUCHET→trebs. Any other value → 0.
`City::SetForts(traps, abatis, towers, logs, trebs)` overwrites all five values. Contrast with `PlayerCity::SetForts(type, count)` (§3.6), which adds.

---

## 3. `PlayerCity`

### 3.1 Fields (in addition to City)
| Field | Type | Default | Meaning |
|---|---|---|---|
| m_client | Client* | null | owner |
| m_castleid | uint64 | 0 | DB `cities.id` (client `id` / `castleId`) |
| m_accountid | int64 | 0 | owner account id |
| m_logurl | string | "images/icon/cityLogo/citylogo_01.png" (ctor); `AddPlayerCity` sets "" before DB load | city logo |
| m_population | int32 | 0 | current population |
| m_availablepopulation | uint32 | 0 | idle population = population − work population (can underflow; see §3.8) |
| m_maxpopulation | uint32 | 50 | population cap |
| m_allowalliance | bool | false | saved to DB. **ToObject always sends false** |
| m_gooutforbattle | bool | false | when true, the city's own scouts join scout defence (see battle spec) |
| m_hasenemy | bool | false | saved to DB only |
| m_creation | double | 0 | creation timestamp |
| m_researching | bool | false | true while a research is in progress in this city |
| m_lastcomfort | double ms | 0 | last "pacifyPeople" (comfort) time. **Not persisted** |
| m_lastlevy | double ms | 0 | last "taxation" (levy) time. **Not persisted** |
| m_troops | stTroops | 0 | troops at home |
| m_injuredtroops | stTroops | 0 | injured troops (only serialized; never filled anywhere) |
| m_production | stResources | 0 | per-hour base production. Gold = tax income |
| m_workpopulation | stResources | 0 | labour required by resource fields, per resource |
| m_workrate | stResources | 0 | percent sliders 0..100. **`workrate.gold` is the tax rate** |
| m_storepercent | stResources | 0 | never computed (always 0) |
| m_productionefficiency | double | 100 | percent |
| m_resourcebaseproduction | int32 | 100 | flat "natural" production per hour, per resource |
| m_resourcemanagement | double | 0 | hero management % bonus (**never set**: `CalculateResourceStats` is a stub) |
| m_resourcetech | int32 | 0 | tech % bonus (never set) |
| m_resourcevalley | int32 | 0 | valley % bonus (never set) |
| m_troopconsume | double | 0 | food upkeep per hour (**never set**) |
| m_timers.updateresources | double ms | — | last resource tick time (persisted in misc) |
| m_heroes[10] | Hero* | null | hired heroes |
| m_innheroes[10] | Hero* | null | heroes for hire in the inn (deleted on inn upgrade) |
| m_mayor | Hero* | null | the hero whose status is `DEF_HEROMAYOR` (first such hero found on load; extra mayors are reset to IDLE) |
| m_troopqueue | vector<stTroopQueue> | [] | one per barracks/walls position |
| armymovement | list | [] | (unused here; Client holds the movement lists) |
| m_trades, m_transingtrades | list | [] | market (not persisted: DB strings are empty) |

### 3.2 Building positions
- Inner: `-2` = Walls slot, `-1` = Town Hall slot, `0..31` = inner building slots. Array index = position + 2. The array has 35 entries, but `SetBuilding` accepts only −2..31.
- Outer (fields): `1001..1040` (array index 1..40; index 0 is never used).
- `GetBuilding(position)` accepts inner −2..35 (a bug: 33..35 address beyond the valid range) and outer up to 1040. It throws `out_of_range` otherwise.

### 3.3 Client serialization: `PlayerCity::ToObject()` ("castleBean")
```
{
  buildingQueues: [],                 // always empty array
  heros: [Hero.ToObject()...],        // only non-null m_heroes
  status: m_status,
  allowAlliance: false,               // hard-coded
  resource: Resources(),              // §3.4
  logUrl: m_logurl,
  fieldId: m_tileid,
  usePACIFY_SUCCOUR_OR_PACIFY_PRAY: 1,// hard-coded
  transingTrades: [],
  troop: Troops(),                    // §3.5
  id: m_castleid,
  name: m_cityname,
  buildings: Buildings(),             // §3.5
  fortification: Fortifications(),    // §3.5
  trades: [],
  fields: [],                         // owned valleys (never filled)
  goOutForBattle: false,              // hard-coded
  hasEnemy: false                     // hard-coded
}
```
`Hero.ToObject()` (for reference): `{ experience, id, itemAmount, level, logoUrl, loyalty, management, managementAdded, managementBuffAdded, name, power, powerAdded, powerBuffAdded, remainPoint, status, stratagem, stratagemAdded, stratagemBuffAdded, upgradeExp }`.

### 3.4 `Resources()` (the "resource" bean)
Let `eff = m_productionefficiency / 100` and `mgmt = 1 + m_resourcemanagement / 100`.
```
{
  maxPopulation: m_maxpopulation,
  taxIncome: m_production.gold,
  support: m_loyalty,
  wood:  { amount: res.wood,  storeRercent: int(storepercent.wood),  workPeople: int(workpopulation.wood),  max: int(maxres.wood),
           increaseRate: production.wood*eff*mgmt + m_resourcebaseproduction },
  stone: { … same pattern with stone … },
  iron:  { … same pattern with iron … },
  food:  { amount, storeRercent, workPeople, max,
           increaseRate: production.food*eff*mgmt - m_troopconsume + m_resourcebaseproduction },
  buildPeople: 0,
  workPeople: int(wp.food*wr.food/100 + wp.wood*wr.wood/100 + wp.stone*wr.stone/100 + wp.iron*wr.iron/100),
  curPopulation: m_population,
  herosSalary: Σ(hero.m_level * 20) over hired heroes,
  troopCostFood: m_troopconsume,
  gold: res.gold,
  texRate: int32(m_workrate.gold),           // tax rate (typo kept)
  complaint: m_grievance,
  populationDirection: -1 | 0 | 1            // see below
}
```
`populationDirection`: let `target = int(maxpop * min(loyalty + grievance, 100) / 100)`. Send −1 if `population > target`, 1 if `population < target`, otherwise 0.

Note that `production.X` here is already multiplied by `workrate.X/100` (see §3.8). Also note the inconsistency: `increaseRate` adds the base production *after* applying efficiency, but the real tick (§3.9) adds base production *before* efficiency.

### 3.5 Sub-objects
- `Troops()` / `InjuredTroops()` → `{ peasants, archer, catapult, ballista, scouter, carriage, heavyCavalry, militia, lightCavalry, swordsmen, pikemen, batteringRam }`.
- `Buildings()` → array of `{ startTime, endTime, level, status, positionId, name, typeId }`. It lists all inner buildings with type > 0 (array order, i.e. position −2..32), then outer buildings (1000..1040).
- `Fortifications()` → `{ trap: traps, rollingLogs: logs, rockfall: trebs, arrowTower: towers, abatis: abatis }`.
- `ResourceProduceData()` (response to `interior.getResourceProduceData` as `resourceProduceDataBean`) is an array of 4 objects, in this order: food (`typeid: 1`), wood (2), stone (3), iron (4):
  ```
  { technologicalPercentage: m_resourcetech, totalOutput: 0,
    heroPercentage: production.X * eff * (m_resourcemanagement/100),
    maxLabour: workpopulation.X, commenceDemands: 0, fieldPercentage: m_resourcevalley,
    naturalPercentage: m_resourcebaseproduction,
    armyPercentage: (food only) m_troopconsume, else 0,
    productionCapacity: production.X, typeid, commenceRate: workrate.X,
    cimeliaPercentage: 0, basicOutput: 0 }
  ```

### 3.6 Troop and fort mutators
- `SetTroops(typeId, amount)` **adds** `amount` to the matching field (TR ids 2..13). It then pushes `server.TroopUpdate`.
- `GetTroops(typeId)` reads a count. Unknown id → 0.
- `PlayerCity::SetForts(typeId, count)` **adds** `count` to the matching fort (TR 14..18). It then pushes `server.FortificationsUpdate`.
- `HasTroops(t)` returns true iff every one of the 12 home counts ≥ the requested count.
- `GetHero(id)` looks up a hero in `m_heroes`. `HeroCount()` counts non-null heroes.

### 3.7 Building queries
- `GetBuildingLevel(type)` = the **maximum** level among all inner and outer buildings of that type, or 0.
- `GetBuildingCount(type)` = the number of buildings of that type.
- `GetEffectiveTechLevel(techId)` = 0 if there is no Academy. Otherwise `min(academyLevel, client.research[techId].level)`.
- `GetReliefMultiplier()` maps Relief Station level to a multiplier: 0 → 1; 1–3 → 2; 4 → 3; 5–7 → 4; 8–9 → 5; 10 → 6. (The client receives this in `army.getTroopParam` as `transportStationParam`.)

### 3.8 `CalculateStats()` (static city stats; recomputed after every build, research, tax change or minute tick)
```
maxresources = {food:10000, wood:10000, stone:10000, iron:10000, gold:0}
production   = 0; workpopulation = 0
maxpopulation = 50

for each INNER building with type == 1 (Cottage):
    maxpopulation += COTTAGE_POP[level]
COTTAGE_POP = {1:100, 2:300, 3:600, 4:1000, 5:1500, 6:2100, 7:2800, 8:3600, 9:4500, 10:5500}

for each OUTER building:
    resource = {7:food (Farm), 4:wood (Sawmill), 5:stone (Stonemine), 6:iron (Ironmine)}[type]; skip other types
    k = T[level], where T = {1:1, 2:3, 3:6, 4:10, 5:15, 6:21, 7:28, 8:36, 9:45, 10:55}   // = L(L+1)/2
    maxresources[resource] += 10000 * k
    production[resource]   += 100 * k        // per hour at 100% work rate
    workpopulation[resource] += 10 * k       // labour needed

production.food  *= workrate.food  / 100
production.wood  *= workrate.wood  / 100
production.stone *= workrate.stone / 100
production.iron  *= workrate.iron  / 100

workpop = int32( wr.food*wp.food/100 + wr.stone*wp.stone/100 + wr.wood*wp.wood/100 + wr.iron*wp.iron/100 )
availablepopulation = population - workpop             // stored as uint32 (wraps if negative; as-is)
productionefficiency = (population >= workpop) ? 100 : float(population) / workpop * 100
production.gold = population * (workrate.gold / 100)  // tax income per hour
```
These are not implemented: Warehouse capacity, tech storage (Stockpile), valley bonuses, cottage technologies, gold cap.

### 3.9 `CalculateResources()` (time-based accrual; called every 60 s for every player and on several events)
```
CalculateResourceStats()   // stub, does nothing
now  = Utils::time()
diff = now - m_timers.updateresources      // ms, computed as uint64
m_timers.updateresources = now

base = m_resourcebaseproduction (100)
eff  = m_productionefficiency / 100
mgmt = 1 + m_resourcemanagement / 100      // always 1

food:  add = ((production.food  + base) * eff / 3600000) * mgmt * diff - m_troopconsume
wood:  add = ((production.wood  + base) * eff / 3600000) * mgmt * diff
stone: add = ((production.stone + base) * eff / 3600000) * mgmt * diff
iron:  add = ((production.iron  + base) * eff / 3600000) * mgmt * diff
for each of the four:  if (max > current) current = min(current + add, max)
                       // if current >= max: unchanged (over-cap stock is kept, not trimmed)

herosalary = Σ hero.m_level * 20                      // gold per hour
gold += (production.gold - herosalary) * diff / 3600000
if (gold < 0) gold = 0                                // gold has no cap
```
As-is quirk: `m_troopconsume` is subtracted once per call, not scaled by time. It is always 0 today. **Recommendation:** treat troop upkeep as per-hour, i.e. `-(troopconsume * diff / 3600000)`, and let food go negative or desert troops according to game rules once upkeep is implemented.

`Client::CalculateResources()` recomputes `client.population = Σ city.m_population`. Then, for each city, it calls `CalculateResourceStats(); CalculateStats(); CalculateResources();`.

### 3.10 `RecalculateCityStats()` (population, loyalty and tax drift; runs for every CASTLE every 6 minutes = 360000 ms)
```
target = int( maxpop * min(loyalty + grievance, 100) / 100 )
add    = int( maxpop * 0.05 )
if population > target:
    if population - add < target: population = target
    elif population - add < 0:    population = maxpop       // as-is oddity (unreachable in practice)
    else:                         population -= add
elif population < target:
    if population + add > target: population = target
    elif population + add > maxpop: population = maxpop
    else:                         population += add

targetLoyalty = 100 - min(workrate.gold + grievance, 100)
if loyalty > 1:                     // loyalty of 0 or 1 never recovers (as-is)
    if targetLoyalty < loyalty: loyalty -= 1
    elif targetLoyalty > loyalty: loyalty += 1

production.gold = population * (workrate.gold / 100)
push server.ResourceUpdate
```
Grievance never changes on its own. Only comfort actions (§3.11) and items change it. The `pshop.cpp` item sets loyalty to 100 and grievance to 0.

### 3.11 Tax, comfort and levy (packets/pinterior.cpp, operating on PlayerCity)
- **`interior.modifyTaxRate {castleId, tax}`**: if `tax ∉ [0,100]`, set `workrate.gold = 0`; otherwise set `workrate.gold = tax`. Reply `{ok:1, packageId:0.0}`. Then run `CalculateStats`, `CalculateResources` and `ResourceUpdate`, and save.
- **`interior.modifyCommenceRate {castleId, foodrate, woodrate, ironrate, stonerate}`**: first run `CalculateStats` and `CalculateResources` (to settle accrual at the old rates). Then set each rate, using the same 0..100 validation (an invalid value becomes 0). Reply ok, then run `CalculateStats` and `ResourceUpdate`.
- **`interior.pacifyPeople {castleId, typeId}` (comfort)**: cooldown is 15 min (`900000` ms) per city, tracked by `m_lastcomfort`. While on cooldown, reply with error code `-34` and the message `"<m>m <s>s interval needed for next comforting."`. **The cooldown timestamp is set before the resource check**, so a failed attempt still triggers the cooldown (as-is).
  | typeId | Cost | Effect |
  |---|---|---|
  | 1 Disaster Relief | food = maxpop | loyalty +5 (cap 100), grievance −15 (floor 0) |
  | 2 Praying | food = maxpop | loyalty +25 (cap 100), grievance −5 (floor 0) |
  | 3 Blessing | gold = maxpop/10 | food += maxpop. With a 10% chance (`rand()%10==1`), food += maxpop again, and the reply is error `-99` "Free blessing!" |
  | 4 Population Raising | food = maxpop*5 | population += maxpop/20 (cap maxpop) |
  If there are not enough resources, reply with error `-99` "Not enough food." or "Not enough gold.".
- **`interior.taxation {castleId, typeId}` (levy)**: cooldown is 15 min, tracked by `m_lastlevy` (error `-34`, `"… interval needed for next levy."`). If `loyalty <= 20`, reply with error `-99` "Loyalty too low. Please comfort first.". Otherwise loyalty −= 20, then:
  | typeId | Gain |
  |---|---|
  | 1 | gold += population/10 (integer division) |
  | 2 | food += population |
  | 3 | wood += population |
  | 4 | stone += population/2 (integer division) |
  | 5 | iron += population*0.40 |
  Levied resources may exceed caps.

### 3.12 Hero management and tech effects (actually implemented)
- **Resource production**: none. `m_resourcemanagement`, `m_resourcetech` and `m_resourcevalley` are always 0. The intended (commented-out) formula was `m_resourcemanagement = mayor ? mayor.management + managementadded + managementbuffadded : 0`. **Recommendation:** implement production as `production.X * eff * (1 + (mayorManagement + techPct + valleyPct)/100) + base`, with `techPct = 10 * effectiveLevel(Agriculture|Lumbering|Masonry|Mining)`, if real game parity is desired. This is not present in the source.
- **Hero salary**: `level * 20` gold per hour per hired hero.
- **Troop and fort training time** (`AddToBarracksQueue(position, troopid, count, …)`):
  - If the queue already holds as many entries as the building level, return −1. (Max concurrent batches = barracks/walls level.)
  - `costtime = troopconfig[troopid].time` (seconds per unit).
  - Walls queue (`position == -2`, fortifications): `costtime *= 0.995^(mayor.GetManagement()) * 0.9^(research[Construction].level)`. If there is no mayor, the first factor is 1.
  - Barracks:
    - `mayorinf = 0.995^(mayor.GetPower())` (1 if no mayor).
    - For catapult, ram, transporter and ballista, the C++ `switch` falls through. The effective formula is `costtime * mayorinf * 0.9^MetalCasting * mayorinf * 0.9^MilitaryScience`, so **mayorinf is applied twice** (as-is bug).
    - For other troops: `costtime * mayorinf * 0.9^MilitaryScience`.
  - Batch duration in ms: `floor(costtime) * count * 1000`. `starttime = now`, and `endtime = now + duration` if the queue was empty, otherwise 0.
  - Research levels used here are raw levels, not capped by the Academy.
  - Hero getters: `GetPower = power + poweradded + powerbuffadded`; `GetManagement = management + managementadded + managementbuffadded`; `GetStratagem = stratagem + stratagemadded + stratagembuffadded` (all int16).

### 3.13 `CheckBuildingPrereqs(type, levelIndex) → bool`
- Return false if `type <= 0 || type > 35`.
- `cfg = buildingconfig[type][levelIndex]`. The config is loaded with index = DB `level − 1`. The caller passes 0 for a new building, or the current level when upgrading, so in both cases this is the config row of the *target* level.
- Every `cfg.buildings` entry with `id != 0` requires `GetBuildingLevel(id) >= level`.
- Every `cfg.items` entry with `id != 0` requires `client.GetItemCount(itemsTable[id].name) >= level`. (An item prereq's "level" is the required count.)
- Every `cfg.techs` entry with `id != 0` requires `client.research[id].level >= level`. This uses the raw level, not the effective level.
- Return true only when every requirement is met.
- Config source tables:
  - `config_building`: columns `buildingid, level, buildtime (s), food, wood, stone, iron, gold, prereqbuilding, prereqtech, prereqitem, blimit, inside`. `destructtime = buildtime/2`. As-is bug: `prestige` is read from the `gold` column.
  - Prereq strings use the format `"id,level|id,level|…"`.
  - `config_troops`: `troopid, buildtime, food, wood, stone, iron, gold, inside, population, prereq*`, with no level dimension.
  - Demolition refund (spitfire timer): one third of the costs of the level being removed: `cfg[type][newLevel].{food,wood,stone,iron,gold} / 3`.

### 3.14 Push messages emitted by PlayerCity (to the owning client, only if connected)
| cmd | data |
|---|---|
| `server.CastleUpdate` | `{ updateType: 2, castleBean: ToObject() }` |
| `server.ResourceUpdate` | `{ castleId, resource: Resources() }` |
| `server.TradesUpdate` | `{ castleId, tradeBean: {amount, id, tradeType, price, tradeTypeName, dealedTotal, resourceName, resType}, updateType }` |
| `server.HeroUpdate` | `{ castleId, hero: Hero.ToObject(), updateType }`. updateType: 0 = hire, 1 = fire, 2 = update |
| `server.TroopUpdate` | `{ caslteId (sic), troop: Troops() }` |
| `server.FortificationsUpdate` | `{ castleId, fortification: Fortifications() }` |

### 3.15 DB persistence (`cities` table) and legacy text formats
`SaveToDB` runs `UPDATE cities SET misc, status, allowalliance, logurl, fieldid, transingtrades, troop, troopqueues, name, buildings, fortification, trades, gooutforbattle, hasenemy, gold, food, wood, iron, stone WHERE id = m_castleid`.
On load, the server reads `accountid, id, fieldid, food, wood, iron, stone, gold, name, logurl, creation`, then calls `ParseTroops(troop)`, `ParseBuildings(buildings)`, `ParseTroopQueues(troopqueues)`, `ParseFortifications(fortification)` and `ParseMisc(misc)`, in that order. After loading heroes, it calls `client.CalculateResources()`.
Heroes come from the `heroes` table `WHERE castleid = ?`. The columns are listed in the hero spec. Hero loyalty is clamped to ≤ 100.

**`misc`** (`DBMisc` / `ParseMisc`): comma-separated, 9 fields:
```
population,taxRate,foodRate,woodRate,ironRate,stoneRate,loyalty,grievance,lastResourceUpdateMs
```
Population is `%d`. The rates and the timestamp use C `%f`, which prints 6 decimals, e.g. `10.000000`. Loyalty and grievance are ints. Note the **wood, iron, stone** order. On parse, population is cast to **uint16** (as-is truncation above 65535; recommendation: do not truncate). Loyalty and grievance are cast to int8.
Default misc for a newly created city (`AddPlayerCity`): `"50,10.000000,100.000000,100.000000,100.000000,100.000000,90,0,<now>"` → population 50, tax 10%, all rates 100, loyalty 90, grievance 0.
A new city also gets a level-1 Town Hall at position −1, zero resources and status 0.

**`troop`** (`DBTroops` / `ParseTroops`): 12 `typeId,count` pairs separated by `|`, in this exact order:
`7,archer|2,worker|3,warrior|4,scout|5,pike|6,sword|8,transporter|11,ballista|12,ram|13,catapult|9,cavalry|10,cataphract`.
The parser accepts any order and any subset. Each pair is **added** (`SetTroops`). A negative count adds 0.

**`buildings`** (`DBBuildings` / `ParseBuildings`): records separated by `|`, with a trailing `|`. Each record is `type,level,position,status,starttime,endtime` (the times use `%f`). Inner buildings with type > 0 come first, in position order −2..31, then outer buildings 1000..1040. On parse, every record calls `SetBuilding`. If `status ∈ {1,2}`, a timed building event is scheduled; it completes when `endtime < now`. On completion:
- status 1: level++, status 0, times 0.
- status 2: level−−, refund 1/3, slot cleared if level reaches 0.

**`fortification`**: `traps,abatis,towers,logs,trebs` (ints), applied with `City::SetForts`, which overwrites.

**`troopqueues`** (`DBTroopQueues` / `ParseTroopQueues`): one segment per non-empty queue, each terminated by `|`:
```
positionId,headEndTimeMs[,troopId,count,costTimeMs]*|
```
Parse algorithm, per segment:
1. Read `position` and `endtime`.
2. For each `(troopid, count, costtime)` triple, call `SetTroopQueue(position, troopid, count, costtime, endtime)`:
   - If there is no queue at this position, return false.
   - If `endtime <= now`, the batch is already finished. Grant it immediately with `SetTroops(troopid, count)` and return false.
     - **As-is bug:** this uses SetTroops even for the walls queue (−2), so finished fort batches are lost or added as troops. **Recommendation:** use SetForts when position = −2.
   - Otherwise append the batch. Its endtime becomes `now + costtime` if the queue is empty, else 0, and the function returns true.
     - **As-is bug:** the remaining time is reset to the full `costtime` instead of using `endtime`.
3. After a true result, set `endtime = 0` for the following items. After a false result, `endtime += costtime`, so subsequent finished batches accumulate.

**`transingtrades`, `trades`**: always saved as empty strings.

---

## 4. `Client` (player account)

### 4.1 Fields
| Field | Type | Default | Meaning / DB column |
|---|---|---|---|
| socket | connection* | null | live socket |
| accountid | int64 | 0 | `accounts.accountid` (game account / player id) |
| masteraccountid | int64 | 0 | `accounts.parentid` (master login account) → `userId` |
| accountexists | bool | false | |
| PACKETSIZE | int32 | 153600 | |
| socknum | uint64 | 0 | |
| loggedin | bool | false | |
| internalid | uint64 | −1 | |
| playername | string | "Testname" | `username` |
| flag | string | "Evony" | `flag` (≤ a few chars, city banner) |
| faceurl | string | "" | `faceurl` |
| alliancename | string | "" | |
| alliancerank | int16 | 0 | `alliancerank` |
| office | string | "Civilian" | |
| ipaddress | string | "" | `ipaddress` |
| allianceid | int64 | −1 | `allianceid` (> 0 means in an alliance) |
| email | string | "" | from master `account.email` |
| password | string | "" | from master `account.password` |
| prestige | double | 0 | `prestige`. Adjusted via `Prestige(delta)`, which clamps to [0, 2,100,000,000] |
| honor | double | 0 | `honor` |
| beginner | bool | false | beginner protection flag |
| status | int32 | 0 | `status` (player state, sent as `state`) |
| rank | int32 | 0 | |
| title | int32 | 0 | `titleId` |
| connected | double | 0 | truthy when online |
| lastlogin | double | 0 | `lastlogin` (ms) |
| creation | double | 0 | `creation` (ms) |
| citycount | int32 | 0 | number of cities |
| sex | int32 | 0 | `sex` |
| population | int32 | 0 | Σ city population (recomputed on PlayerInfo / CalculateResources) |
| prestigerank, honorrank | uint32 | 0 | ranking positions |
| citylist | PlayerCity*[] | [] | |
| m_bdenyotherplayer | int | false | |
| allianceapply | string | | `allianceapply` |
| allianceapplytime | int64 | 0 | `allianceapplytime` |
| haschangedface | bool | false | `changedface` |
| changeface | uint16 | 0 | castle skin (1 = xmas, 2 = halloween?) |
| currentreportid | uint32 | 1 | next report id |
| icon | int8 | 0 | `icon` |
| cents | uint64 | 0 | `cents` (premium currency, "medal") |
| currentcityindex / currentcityid | uint32 | −1 | focused city |
| clientdelay | double | 0 | |
| debugmode | bool | false | |
| mailpid | uint32 | 1 | |
| packagelist, bufflist, reportlist, maillist, itemlist | lists | | |
| research[25] | stResearch | 0 | tech levels by T_ id |
| castlesignlist | stCastleSign[] | | bookmarks |
| armymovement / friendarmymovement / enemyarmymovement | stArmyMovement* lists | | own / incoming friendly / incoming hostile armies |

### 4.2 Beginner protection (`CheckBeginner`)
While `beginner` is true, clear it once `now − creation > 604800000` (7 days) or once any city's Town Hall level ≥ 5. A change pushes `server.PlayerInfoUpdate` unless the call passes `update=false`.

### 4.3 `ToObject()` (login "player" bean)
```
{
  newReportCount_trade: 0, newMaileCount_system: <unread mail type 2>, newReportCount: 0,
  isSetSecurityCode: false, mapSizeX: M, mapSizeY: M, newReportCount_other: 0,
  buffs: BuffsArray(), gamblingItemIndex: 1, changedFace: haschangedface,
  castles: [PlayerCity.ToObject() for first citycount cities],
  playerInfo: PlayerInfo(), redCount: 0, usePACIFY_SUCCOUR_OR_PACIFY_PRAY: 1,
  newMaileCount_inbox: <unread mail type 1>,
  currentDateTime: "YYYY.MM.DD HH.MM.SS" (server LOCAL time, zero-padded, e.g. "2011.07.27 03.20.32"),
  newReportCount_army: 0,
  friendArmys: [stArmyMovement.ToObject()...], saleTypeBeans: SaleTypeItems(),
  autoFurlough: false, castleSignBean: CastleSignArray(), furloughDay: 0,
  tutorialStepId: 0, newMailCount: <all unread mail>, furlough: false, gameSpeed: 1,
  enemyArmys: [...], currentTime: now (number), items: Items(), freshMan: false,
  finishedQuestCount: 0, selfArmys: [...], saleItemBeans: SaleItems()
}
```
(The "Maile" typos are part of the protocol.)

- `PlayerInfo()` → `{ [alliance: "", allianceLevel: 0, levelId: alliancerank] (only if allianceid > 0), createrTime: creation, office, sex, honor, bdenyotherplayer, id: accountid, accountName: email, prestige, faceUrl, flag, userId: masteraccountid, userName: playername, castleCount: citycount, medal: cents, ranking: prestigerank, titleId: title, lastLoginTime: lastlogin, population: Σ city.m_population }`.
- `BuffsArray()` → `[{ desc, endTime, id }]`.
- `Items()` → `[{ id, count, minCount, maxCount }]` for items with count > 0.
- `CastleSignArray()` → `[{ id: tileid, name, y, x }]`.
- `SaleTypeItems()` → exactly 4 tabs, `[{ typeName, items }]`. The `typeName` values are UTF-8 strings: 加速 (speed-up, item.type 1), 宝箱 (chests, 2), 生产 (production, 3), 宝物 (treasures, 4). `items` = `#`-joined names of all **buyable** config items of that type.
- `SaleItems()` → a fixed list of `{ saleType, items }`:
  - (1, "player.resinc.1")
  - (1, "player.resinc.2")
  - (1, "player.resinc.3")
  - (1, "player.resinc.4")
  - (0, "consume.1.c")
  - (1, "consume.2.b.1")
  - (1, "player.gold.1.a")
  - (1, "consume.refreshtavern.1")
  - (1, "consume.2.b")
  - (1, "consume.transaction.1")
- `Packages()` → `[{ desc, packageName, status, type, minMedal, maxMedal, id, isUseNow, scores, provideTime, expiredTime, claimedTime, itemList: [{id, count, name, minCount, maxCount}] }]`. **As-is bug:** every scalar field except desc and name is filled with `package.id`.

### 4.4 Client push messages
| cmd | data |
|---|---|
| `server.PlayerInfoUpdate` | `{ playerInfo }` |
| `server.SelfArmysUpdate` | `{ armys: [stArmyMovement.ToObject()] }` |
| `server.EnemyArmysUpdate` / `server.FriendArmysUpdate` | **as-is bug: `data` is sent empty.** Recommendation: `{ armys: [...] }` |
| `server.ItemUpdate` | `{ items: [{id, count, minCount, maxCount}] }` (only the changed item) |
| `server.HeroUpdate` | `{ castleId, hero }` |
| `server.NewMail` | `{ count_system, count, count_inbox }` (unread counts) |
| `server.NewReport` | `{ count, army_count (type 1), trade_count (type 0), other_count (type 2) }` (unread) |
| `server.PlayerBuffUpdate` | `{ buffBean: { descName, endTime, typeId }, updateType: 0 set / 1 removed }` |
| `castle.castleSignInfoArr` | `{ castleSignInfoArr: [{ id, name, y, x }] }` |

### 4.5 Mutators
- `SetBuff(id, desc, endtime)`: if a buff with this id exists, update its endtime only. Otherwise append it. Either way, push a PlayerBuffUpdate. `RemoveBuff(id)` erases the buff and pushes updateType 1. Every 5 s the server removes expired buffs. When `PlayerPeaceBuff` expires, it adds `PlayerPeaceCoolDownBuff` ("Truce Agreement in cooldown.") for 12 h.
- `AddItem(id, delta)`: if the item exists, `count += delta`. Otherwise, if delta ≥ 0, create it with name from config and count = delta. Push ItemUpdate.
- `SetItem(id, amount)`: same, but sets the count instead of adding.
- `GetItemCount(name)` or `GetItemCount(configIndex)`; the index form maps through `m_items[i].name`.
- `SetResearch(id, level, castleid, start, end)` and `GetResearchLevel(id)` (raw level).

### 4.6 DB persistence (`accounts` table) and legacy formats
`SaveToDB` runs `UPDATE accounts SET buffs, research, items, misc, status, ipaddress, sex, flag, faceurl, allianceid, alliancerank, cents, prestige, honor, lastlogin, changedface, icon, allianceapply, allianceapplytime, castlesign WHERE accountid=?`.
Loading uses `SELECT accounts.*, <main>.account.email, <main>.account.password FROM accounts LEFT JOIN <main>.account ON account.id = accounts.parentid`.

- **`buffs`**: `id,desc,endtime|…`. The parser requires exactly 3 tokens and reads endtime with `atoll`. As-is, the writer uses `%?d` for string fields, so Poco emits error placeholders and saved buffs are effectively corrupt. **Recommendation:** write `id,desc,endtimeInt|`.
- **`research`**: `i,level,castleid,starttime,endtime|` for i = 0..24. The writer uses default iostream formatting, which gives only 6 significant digits for doubles (e.g. `1.53e+12`), so timestamps lose precision (as-is). The parser requires 5 tokens.
- **`items`**: `itemName,count|`, only for count > 0. The parser requires 2 tokens and a non-empty name, and calls `SetItem`.
- **`misc`**: intended `icon,changedFace`. As-is, the writer streams `icon` (an int8) as a raw character, and operator precedence means the second value is the bool. The parser does `icon = atoi(tok0)` and `haschangedface = (bool)tok1.c_str()`, which is **always true**. **Recommendation:** store as integer columns.
- **`castlesign`**: `tileId,tileId,…,`. On load, each id whose tile is a CASTLE becomes `{ id: tile.m_castleid, name: tile.GetName(), x: id % M, y: id / M }`.
- Mail is loaded from table `mail WHERE receiverid=accountid` (`title, content, senttime, readtime, pid → mailid, senderid → playerid, type`). Reports come from a table with `accountid, armytype, back, attack, typeid, startpos, targetpos, title, guid, eventtime, isread`.

---

## 5. `NpcCity` (barbarian city)

### 5.1 Fields (in addition to City)
| Field | Meaning |
|---|---|
| m_troops / m_maxtroops | NPC-specific struct `{ warrior, pike, sword, archer, cavalry }` (int32). NPCs have only these 5 troop types |
| m_maxforts | stForts regeneration cap |
| m_temphero | a random defending hero (regenerated on scout) |
| m_calculatestuff | unused |
| m_population | idle population (for scout reports) |
| m_ownerid | tile owner id (normally 0) |
| `IDLE_POPULATIONS[10]` | `{1000, 4000, 8000, 16000, 25000, 33000, 38000, 58000, 68000, 78000}`, indexed by level−1 |

`spitfire::AddNpcCity(tileId)` creates the NPC with `m_type = NPC`, `m_cityname = "Barbarian City"`, `m_status = 0`, and links it to the tile (`tile.m_city`, `m_npc = true`, `m_type = NPC`).

### 5.2 `Initialize()` per-level table (resources, troops and forts are also the regeneration caps)
`SetResources` argument order is (gold, food, wood, stone, iron). Wood, stone and iron are always equal.
| Lvl | Gold | Food | Wood=Stone=Iron | Warrior | Pike | Sword | Archer | Cavalry | Traps | Abatis | Towers | Logs | Trebs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 55000 | 100000 | 20000 | 50 | 40 | 30 | 10 | 8 | 1000 | 0 | 0 | 0 | 0 |
| 2 | 65000 | 200000 | 30000 | 50 | 45 | 40 | 30 | 25 | 1850 | 550 | 0 | 0 | 0 |
| 3 | 75000 | 900000 | 75000 | 200 | 160 | 65 | 40 | 60 | 2000 | 1000 | 650 | 0 | 0 |
| 4 | 300000 | 1600000 | 120000 | 400 | 400 | 100 | 100 | 150 | 4500 | 1875 | 550 | 0 | 0 |
| 5 | 450000 | 3000000 | 180000 | 750 | 1000 | 350 | 250 | 200 | 3750 | 1875 | 1250 | 750 | 0 |
| 6 | 600000 | 4000000 | 200000 | 4000 | 1750 | 550 | 500 | 450 | 4250 | 1500 | 1500 | 950 | 400 |
| 7 | 800000 | 4500000 | 500000 | 12000 | 3000 | 750 | 800 | 750 | 5600 | 2800 | 1850 | 1100 | 700 |
| 8 | 1000000 | 8000000 | 800000 | 15000 | 6750 | 4000 | 3000 | 2000 | 7200 | 3600 | 2400 | 1440 | 900 |
| 9 | 1200000 | 14000000 | 550000 | 60000 | 18000 | 2000 | 6750 | 2500 | 9000 | 4500 | 3000 | 1800 | 1125 |
| 10 | 1500000 | 19000000 | 600000 | 400000 | 0 | 0 | 0 | 0 | 11000 | 5500 | 3666 | 2200 | 1375 |
| other | same as level 1 |

After the table is applied: `SetupBuildings()`, `ResetHero()`, `loyalty = (level > 2) ? 90 : 80`, `m_population = IDLE_POPULATIONS[level-1]`.

**As-is bug (DB load path):** `spitfire` calls `AddNpcCity` and then `Initialize()` **before** it sets `m_level = tile.level`. Initialize therefore runs with level 0. The result:
- the default (level-1) table applies;
- `SetupBuildings` places level-0 buildings at shifted positions;
- `IDLE_POPULATIONS[-1]` is read (undefined behaviour).

The level is assigned only afterwards. The fake-map path sets the level first and is correct. **Recommendation:** set the level before initializing.

### 5.3 `SetupBuildings()` (all buildings at level L = m_level)
- Farms (7): positions `1001 .. 1000 + 10 + 3(L−1)` (count `10 + 3(L−1)`).
- Sawmill (4) at `1011 + 3(L−1)`, Stonemine (5) at `1012 + 3(L−1)`, Ironmine (6) at `1013 + 3(L−1)`.
- Inner positions:
  - 0 Academy (25)
  - 1 Forge (22)
  - 2 Embassy (28)
  - 3 Feasting Hall (27)
  - 4 Marketplace (23)
  - 5 Beacon Tower (30)
  - 6 Stable (20)
  - 7 Inn (21)
  - 8 Rally Spot (29)
  - 9 Relief Station (24)
  - 10 Workshop (26)
  - 11 Barracks (2)
  - 12..31 Cottage (1) ×20
  - −1 Town Hall (31)
  - −2 Walls (32)

### 5.4 `ResetHero()` (called on init and on every scout of the NPC)
Reuse or create `m_temphero`, then set:
- `level = rand() % (L*10) + 1`
- `power = 30 + rand()%30`
- `poweradded = level`
- `management = 30 + rand()%30`
- `stratagem = 30 + rand()%30`
- `status = IDLE`
- `name = "TestName" + (rand()%100)`

### 5.5 Regeneration
- **`CalculateStats(resources=true, troops=true)`**, called for every NPC every **6 minutes** (360000 ms):
  - Food, wood, stone and iron each gain `max/80`, capped at max. Gold does **not** regenerate.
  - Each troop type gains `max/10` (int32 integer division), capped at max.
  - Each fort type gains `maxfort/10` (integer division), capped at max.
- **`RecoverFromAttack()`** (currently never called): each of the 5 troop types and 5 forts gains `int(current*18/100)`, capped at max.

---

## 6. `Tile`

### 6.1 Fields
| Field | Type | Default | Meaning |
|---|---|---|---|
| m_city | City* | null | city on the tile (castle or NPC) |
| m_valley | ValleyData* | null | lazily created when a valley is scouted |
| m_castleicon | char | 0 | |
| m_castleid | uint32 | 0 | player castle db id |
| m_id | uint32 | −1 → set to `y*M+x` | tile id |
| m_npc | bool | false | NPC city present |
| m_ownerid | uint32 | 0 | owning accountid (0 = none) |
| m_powerlevel | char | −1 | unused |
| m_state | char | −1 | unused |
| m_type | char | FLAT | tile type §0.1 |
| m_status | char | −1 | unused |
| m_zoneid | char | −1 | state index 0..15 (set in the Map constructor) |
| m_level | char | −1 | valley/NPC level 1..10 (from DB) |

DB table `tiles`: `id, ownerid, type, level` (read ordered by id).

### 6.2 `GetName()`
- 1 → "Forest"
- 2 → "Desert"
- 3 → "Hill"
- 4 → "Swamp"
- 5 → "Grass"
- 6 → "Lake"
- 10 → "Flat"
- 11 → city name (or "Invalid City" if there is no city)
- 12 → "Barbarian's City"
- other → "null"

### 6.3 `ToObject()` (player castle tiles only; casts m_city to PlayerCity)
`{ id, name: city.m_cityname, npc: m_npc, prestige: client.prestige, honor: client.honor, state: client.status, userName: client.playername, flag: client.flag, allianceName: client.alliancename }`.
A captured client field list (comment in Tile.h) shows the full field bean the real server sent:
`canColonize, canDeclaredWar, canLoot, canOccupy, canScout, canSend, canTrans, castleIcon, castleId, colonialRelation, colonialStatus, declaredWarStartTime, declaredWarStatus, freshMan, furlough, honor, id, name, npc, ownerPlayerId, powerLevel, prestige, relation, state, type, zoneName`
(e.g. an NPC example: `{id:323903, name:"Barbarian's city", npc:true, powerLevel:4, state:1, type:12, zoneName:"CARINTHIA", canOccupy:true, canScout:true, canLoot:false…}`).

---

## 7. `ValleyData` (per-valley defenders, generated on demand)
Fields: `m_temphero`, `m_lastUpdated` (ms), `m_troops` (stTroops), `m_tile` (back-pointer, **never assigned by the caller**: as-is crash risk; it must point at the owning tile).

`Reset(force)`:
1. If `!force` and `now − m_lastUpdated < 360000` (6 min), return without changes.
2. Hero:
   - `level = 1 + rand()%20`
   - `power = 30 + rand()%30`
   - `poweradded = level`
   - `management` and `stratagem` = `30 + rand()%30`
   - `status = IDLE`
   - `name = "TestName"+rand()%100`
3. Zero the troops. Then build a list of troop indices (stTroops index), adding each one independently with probability 2/3 (`rand()%3 > 0`):
   - index 1 (warrior): always eligible
   - index 3 (pike): always eligible
   - index 4 (sword): if tile level > 2
   - index 5 (archer): if tile level > 4
   - index 7 (cavalry): if tile level > 6
   - If the list is empty, use [1].
4. `x = 2^(level−1) * 10000`. `totalexp = floor((x + rand()%x) / list.length)`, using integer division.
5. For each index i in the list: `troops[i] = ceil(totalexp / TROOP_EXPS[i])`.
6. Set `m_lastUpdated = now`.

`Utils::TROOP_EXPS` (by stTroops index):
| Index | Troop | Value |
|---|---|---|
| 0 | worker | 225 |
| 1 | warrior | 305 |
| 2 | scout | 695 |
| 3 | pike | 900 |
| 4 | sword | 1350 |
| 5 | archer | 1350 |
| 6 | transporter | 2975 |
| 7 | cavalry | 2850 |
| 8 | cataphract | 8750 |
| 9 | ballista | 10000 |
| 10 | ram | 13750 |
| 11 | catapult | 29000 |

Valley resource or production bonuses for the owner are **not implemented** (`m_resourcevalley = 0`; `castleBean.fields` is always empty).

At every server start (real map data), every unowned tile with `type < 11` gets `level++`, wrapping 10 → 1 ("Incrementing valleys"). This also applies to FLAT tiles.

---

## 8. `Map`

### 8.1 Fields
- `mapsize` (M), `m_tile[M*M]`.
- `states[16]`, in order 0..15: FRIESLAND, SAXONY, NORTH MARCH, BOHEMIA, LOWER LORRAINE, FRANCONIA, THURINGIA, MORAVIA, UPPER LORRAINE, SWABIA, BAVARIA, CARINTHIA, BURGUNDY, LOMBARDY, TUSCANY, ROMAGNA.
- Per-state counters (uint16 ×16): `m_totalflats, m_openflats, m_npcs, m_cities, m_occupiedtiles, m_occupiabletiles`. Per-state `m_stats[i] = { players, numbercities, playerrate }`. Per-state `m_openflatlist[i]` = list of open FLAT tile ids.

### 8.2 Zones / states layout (`GetStateFromXY`)
The map is split into a 4×4 grid of equal quarters: `col = floor(x / (M/4))`, `row = floor(y / (M/4))`, `state = row*4 + col`. The boundaries are compared as `x < M*0.25`, `< M*0.5`, `< M*0.75`, `< M` (floating point). Out-of-range coordinates → −1. For M = 800, each state is 200×200: e.g. state 0 FRIESLAND = x 0..199, y 0..199; state 3 BOHEMIA = x 600..799, y 0..199; state 15 ROMAGNA = x 600..799, y 600..799.
`GetStateFromID(id)` = `GetStateFromXY(id % M, id / M)`.

### 8.3 Map generation / load
- The constructor assigns `m_id = y*M+x` and `m_zoneid = state`. Every tile defaults to FLAT, level −1, owner 0.
- **Real data (default build):** the server reads `tiles (id, ownerid, type, level)`. For `type == NPC` it creates an NpcCity (see the §5.2 bug). There is **no procedural generator** in this build; the `tiles` table must be pre-populated.
- **`DEF_NOMAPDATA` build (fake generator):** for each tile:
  - `type = rand()%8 + 1` and `level = rand()%10 + 1`.
  - type 7 → FLAT (10).
  - type 8 → NPC: set the level first, then `AddNpcCity` and `Initialize`.
  - Types 1..6 stay valleys.
  - Resulting distribution: about 75% valleys (12.5% each), 12.5% flats, 12.5% NPC cities, with uniform levels 1..10.
- Player cities are placed afterwards from `cities.fieldid` (`AddPlayerCity` sets the tile to CASTLE, with owner, city, castleid, npc=false).
- Then `CalculateOpenTiles()` runs.

### 8.4 `CalculateOpenTiles()`
Reset all counters, then for each tile with `type >= FLAT` (in state s):
- `occupiable[s]++`
- if FLAT: `totalflats[s]++`. If `ownerid == 0`: `openflats[s]++` and push to `openflatlist[s]`. Else `occupied[s]++`.
- else (CASTLE or NPC): `occupied[s]++`, and then `cities[s]++` for CASTLE or `npcs[s]++` for NPC.

Then `stats[s] = { numbercities: cities + npcs, playerrate: int(occupied/occupiable*100), players: cities }`.

`GetRandomOpenTile(zone)`: return −1 if `openflats[zone] == 0` or the list is empty. Otherwise pick a uniformly random element of the list, remove it, and return its id.

As-is bug in the callers (`common.createNewPlayer`, `pcity`): they decrement `m_openflats[zone]` **before** calling `GetRandomOpenTile`, so the last flat in a zone yields −1. They also verify that the tile is still FLAT and unowned (error −25 otherwise).

`common.zoneInfo` response: `{ ok:1, packageId:0.0, zones: [ { id: i, rate: playerrate, name: states[i], playerCount: players, castleCount: numbercities } × 16 ] }`.

### 8.5 `GetTileRangeObject(clientId, x1, x2, y1, y2)`: response `data` of `common.mapInfoSimple`
Request: `{ x1, x2, y1, y2, castleId }` (inclusive bounds).
1. `data.x1, x2, y1, y2` echo the **original** request values.
2. If `x1 > x2 || y1 > y2`, return `{ …, ok: -1, errorMsg: "Error retrieving results. x1", packageId: 0.0 }`.
3. Normalize X:
   - If `|x1| >= M && |x2| >= M`: `x1 %= M`, `x2 %= M` (C remainder, sign of dividend).
   - Else if `|x2| >= M`: `x1 -= M`, `x2 %= M`.
   - Apply the same rules to Y.
4. **Negative branch** (`x1 < 0 || y1 < 0`):
   - Compute `xdiff`: if `x1 < 0`, it is `x2 − x1` when x2 < 0, otherwise `|x1| + x2`. If `x1 >= 0`, it is `x2 − x1`. Compute `ydiff` the same way.
   - If `xdiff > 20 || ydiff > 20 || xdiff <= 0 || ydiff <= 0`, return `{ok:-1, errorMsg:"Out of range.", packageId:0.0}`.
   - Iterate `y = y1..y1+ydiff` (outer) and `x = x1..x1+xdiff` (inner). Tile id:
     - both x and y negative: `(y+M)*M + (x+M)`
     - only x negative: `y*M + x+M`
     - only y negative: `(y+M)*M + x`
     - otherwise: `y*M+x`
5. **Positive branch**: if `x2−x1 > 20 || y2−y1 > 20`, return "Out of range.". Otherwise iterate `y = y1..y2`, `x = x1..x2`, with `id = y*M+x`.
6. For each tile, append 2 characters to `mapStr`: `itoh(tile.type)` followed by `itoh(level)`.
   - For city tiles (`type > 10`), the level is `city.m_level`; otherwise it is `tile.m_level`.
   - `itoh` maps 0..15 to `'0'..'9','a'..'f'` and any other value to the NUL character, so level −1 → `"\0"` (as-is).
   - Examples: FLAT = 'a', CASTLE = 'b', NPC = 'c'.
   - The string is row-major (y outer, x inner).
7. For city tiles, also push a castle object to `castles`:
   - Always: `{ id: tile.m_id, name: city.m_cityname, state: city.m_status }`.
   - NPC: add `npc: true`.
   - Player castle, adding:
     - `prestige, honor, userName, flag` (plus `changeface` in the negative branch only), and `allianceName` if `allianceid > 0`.
     - The `can*` flags by relation. `relation` is hard-coded to 0 (= DEF_ALLIANCE). As-is, every player castle therefore shows `canLoot:false, canOccupy:false, canScout:false, canSend:true, canTrans:true`.
     - Intended mapping:
       - SELF/ALLY/ALLIANCE → loot/occupy/scout false, send/trans true
       - ENEMY → all true
       - NEUTRAL/NORELATION/default → loot/occupy/scout true, send/trans false
     - `playerLogoUrl: client.faceurl`, `relation`, `state: client.status` (overrides city status), `userName`, `zoneName: states[stateOf(id)]`, `furlough: client.beginner`, `npc: false`.
8. Return `{ x1, x2, y1, y2, castles: [...], mapStr, ok: 1, packageId: 0.0 }`.

**Recommendation:** implement the window as `for dy in 0..(y2−y1)`, `for dx in 0..(x2−x1)`, with `tx = mod(x1+dx, M)` and `ty = mod(y1+dy, M)`, and enforce `x2−x1 <= 20 && y2−y1 <= 20`. Compute relations from real alliance data. Clamp a level of −1 to 0.

### 8.6 `GetMapCastle(fieldId, clientId)`: `field.getOtherFieldInfo` → `{ bean, ok: 1, packageId: 0.0 }`
- **Owned tile** (`ownerid > 0`):
  - If the owner client is missing: set the tile to FLAT and return `{ allianceName:"", npc:false, canLoot:true, canOccupy:true, canScout:true, canSend:false, canTrans:false, zoneName, id }`.
  - If `type < 11` (owned valley): `{ allianceName, flag, honor, id, prestige, can* (by relation), relation, state: client.status, userName, zoneName, furlough: client.beginner, npc:false }`.
  - Castle: the same fields plus `name: city name` and `playerLogoUrl: faceurl`.
  - Here relation 0 matches no case except default, so you get the neutral flags: loot/occupy/scout true, send/trans false. Note that this switch omits DEF_ALLIANCE (differs from §8.5).
- **NPC:** `{ allianceName:"", npc:true, canLoot:true, canOccupy:true, canScout:true, canSend:false, canTrans:false, zoneName, id, name }`.
- **Unowned non-NPC tile:** the same as NPC but with `npc:false` and no name.

### 8.7 Troop march time (`spitfire::CalcTroopSpeed`, used by `army.newArmy`)
1. `distance = sqrt(dx² + dy²)` in tile coordinates. **No torus wrap.**
2. The slowest mechanised/mounted speed (first match in this order) is the catapult 80, ballista 100, ram 120, transporter 150, cataphract 750, cavalry 1000; if none are present it is 10000. Multiply it by `(1 + 0.05*HBR)`.
3. The slowest foot speed (first match) is the worker 180, warrior 200, archer 250, sword 275, pike 300, scout 3000; if none are present it is 10000. Multiply it by `(1 + 0.10*Compass)`.
4. HBR and Compass are research levels capped at the city's Academy level.
5. `slowest = min(mech, foot)`. `travelSeconds = distance / (slowest/1000/60) = distance * 60000 / slowest`.
6. `reachtime = starttime + travelSeconds*1000 + restTime`. As-is, `restTime` arrives "in seconds" but is added as ms.
7. The return trip lasts the same as the outbound march, i.e. `(reachtime − starttime − resttime)` measured from turnaround.

`army.getTroopParam` → `{ marchSkillParam: Compass*10, loadSkillParam: Logistics*10, driveSkillParam: HBR*5, transportStationParam: GetReliefMultiplier(), ok:1, packageId:0.0 }`. These are raw research levels.

---

## 9. Server timers that drive the models (`spitfire::TimerThread`)
| Period | Work |
|---|---|
| every 100 ms | complete troop/fort queues, army arrivals, building completions, research completions (§3.13, battle spec) |
| 5 s | re-sort rankings; expire buffs |
| 60 s | for each player: `Client::CalculateResources()`; push ResourceUpdate for the focused city |
| 6 min (360000 ms) | NPC `CalculateStats(true,true)` regen (§5.5); player `RecalculateCityStats()` (§3.10) |

On building completion:
- Upgrading the Inn deletes its heroes for hire.
- When the Town Hall reaches level 5, beginner protection ends and the system mail "Beginner's Protection Expired" is sent.
- Prestige is awarded, and the mayor gains the same amount as experience.

Training completion awards `count * prestige(DEF_TRAIN)` and adds the units via SetForts (walls queue) or SetTroops.

---

## 10. `Utils` helpers
| Function | Behaviour |
|---|---|
| `time()` | ms since epoch (uint64) |
| `htoi(ch)` | `'0'..'9'` → 0..9, `'a'..'f'` → 10..15, otherwise 0 (lowercase only) |
| `itoh(n)` | 0..15 → `'0'..'9','a'..'f'`, otherwise `'\0'` |
| `GetBuildingName(id)` | table §0.2 |
| `ci_equal`, `ci_find(a, b)` | case-insensitive char compare / substring search (returns index or npos) |
| `makesafe(s)` | replaces every char not in `[0-9A-Za-z_./:@|]` with a space (used for usernames, castle names, face URLs, flags) |
| `strtolower(s)` | ASCII lowercase in place |
| `TROOP_EXPS[12]` | §7 |
| `generaterandomstring(n)` | n random chars from `0123456789abcdefghijklmnopqrstuvwxyz` (report GUIDs use 28) |
| `ByteSwap5(b, n)` | reverses a byte array in place |
| `my_split(toks, src, delim)` (defines.h) | splits on the **first char** of delim and skips empty tokens |

`calculatecoinsforspeedup(msLeft)` (defines.h) is reproduced as-is, including the bug in the 15-min block. Run these steps in order:
1. coins = 0.
2. If t ≥ 28800000 (8 h): coins += 50·⌊t/8h⌋ and t %= 8h.
3. If t > 21600000 (6 h): return coins + 50.
4. If t ≥ 9000000 (2.5 h): coins += 20·⌊t/2.5h⌋ and t %= 2.5h.
5. If t > 7200000 (2 h): return coins + 20.
6. If t ≥ 3600000 (1 h): coins += 10·⌊t/1h⌋ and t %= 1h.
7. If t > 1800000 (30 min): return coins + 10.
8. If t ≥ 900000 (15 min): coins **=** 5·⌊t/15min⌋ (as-is: this assignment discards the earlier sum) and t %= 15min.
9. If t > 0: coins += 5.
10. Return coins.

---

## 11. Known gaps (not implemented in the C++ source)
- Troop food upkeep (`m_troopconsume` is always 0). Per-troop upkeep, load (carry capacity) and food costs exist only in the `config_troops` DB table (food/wood/stone/iron/gold cost, population, buildtime). There is no upkeep or load column.
- Warehouse capacity or protection, Stockpile, and resource tech or valley production bonuses; `storeRercent`.
- Hero management bonus to production. (Management only affects fort build time; power only affects troop build time.)
- Owned valleys (`fields`), trades and transiting trades, injured troops, and real alliance relations on the map.
- A procedural map generator outside the `DEF_NOMAPDATA` debug path.
