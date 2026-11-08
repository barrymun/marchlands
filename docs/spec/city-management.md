# City Management Spec (castle / city / interior / tech / troop / fortifications)

Paths here are in the original server, [sonya75/evony-private-server](https://github.com/sonya75/evony-private-server) on GitHub.

Source of truth: `evony-private-server/src/packets/{pcastle,pcity,pinterior,ptech,ptroop,pfortifications}.cpp`
plus helpers in `PlayerCity.cpp`, `City.cpp`, `Client.cpp`, `spitfire.cpp` (timer thread + config loading),
`defines.h`, `structs.h`, `spitfire.h`, `Utils.cpp`, and the seed data in `DB/evony (3).sql`.

This document describes **what the original server does**, byte-for-byte where it matters to the Flash
client (field names, typos, codes, message strings). Where the original is buggy, the bug is described
under **Bugs / notes** for that command, along with the most likely intended behaviour. The implementer
must decide per bug whether to replicate or fix; a consolidated list is in §11.

---

## 0. Table of contents

1. Conventions (envelope, ok codes, silent drops, time units, focus city)
2. State model touched by these handlers
3. Shared formulas (build/research/train times, speed-up items, coin cost, prestige)
4. Shared object shapes (conditionBean, buildingBean, castleBean, resource bean, ...)
5. Server push messages emitted
6. `castle.*` commands
7. `city.*` commands
8. `interior.*` commands
9. `tech.*` commands
10. `troop.*` commands
11. `fortifications.*` commands
12. Timer-driven completion (buildings, research, troop/fort queues, 6-minute city recalculation)
13. Helper semantics (CalculateStats, CalculateResources, RecalculateCityStats, AddToBarracksQueue, SetBuilding, ...)
14. Constants & lookup tables (IDs, prestige table, config tables, item names)
15. Consolidated bug / TODO list

---

## 1. Conventions

### 1.1 Envelope
Every client→server message is an AMF3 object `{ cmd: "<module>.<command>", data: {...} }`.
The server splits `cmd` on `.` into `cmdtype` (module: `castle`, `city`, `interior`, `tech`, `troop`,
`fortifications`) and `command`. Responses are `{ cmd: "<module>.<command>", data: {...} }` sent only to
the requesting player. Server pushes use `cmd: "server.<Name>"`.

### 1.2 Success / error shape
* Success responses almost always contain `data.ok = 1` and `data.packageId = 0.0` (a double), plus
  command-specific fields.
* Errors are produced by `CreateError(cmd, code, message)`:
  ```
  { cmd: "<module>.<command>", data: { errorMsg: "<message>", packageId: 0.0, ok: <code> } }
  ```
  Codes used in this subset: `-1` (not enough resources / population), `-25`, `-34` (cooldown),
  `-45` (invalid building status), `-48` (one build at a time), `-50` (bad password), `-77`, `-90`, `-99`
  (generic).

### 1.3 Silent drops (no response at all)
* **VERIFYCASTLEID**: if `data` is not an object or has no `castleId` key → throw, request dropped
  silently (only logged).
* **CHECKCASTLEID**: if `data.castleId` is present and `(int)data.castleId != client.currentcityid`
  (the player's *focused* city) → throw, dropped silently.
* Any C++ exception (e.g. `GetBuilding` with an out-of-range position throws `std::out_of_range`) is
  caught by the dispatcher and the request is dropped silently.
* A null client (not logged in) is dropped (`packet::check()`).

When a command below says "VERIFY+CHECK", both checks run first, in that order.

### 1.4 Focus city
`city` in every handler is `client.citylist[client.currentcityindex]` — the currently focused city.
Even when the request carries a `castleId`, the handlers act on the focused city (CHECKCASTLEID guarantees
they match when present). Exceptions are noted (`castle.getCoinsNeed`, `tech.cancelResearch` look up by
`castleId`).

### 1.5 Time units
* All timestamps (`startTime`, `endTime`, buff end times, `timestamp`) are **milliseconds since Unix epoch**
  (`Utils::time()`), stored as doubles.
* Config `time` / `buildtime` values are **seconds**.
* `timestamp` = server time captured when the packet object was constructed.

### 1.6 Reading request fields
Reading a missing key yields a Null value which converts to `0` / `false` / `""`. Numbers are converted with
C-style casts (`static_cast<int>` of a double, i.e. truncation). Unsigned fields (`uint32_t num`) wrap
negative input into huge numbers.

### 1.7 Persistence
"Persist client" = `Client::SaveToDB()` (buffs, research, items, misc, status, flag, faceurl, cents,
prestige, honor, castlesign, ...; **not** `playername`). "Persist city" = `PlayerCity::SaveToDB()`
(misc, status, logurl, fieldid, troops, troopqueues, name, buildings, fortifications, resources). In the new
backend just persist whatever was mutated; the per-command notes record which saves the original did.

---

## 2. State model touched by these handlers

### 2.1 Building slots (per city)
* Inner slots: `positionId` −2 … 32 (array of 35, index = position + 2). `-1` = Town Hall, `-2` = Walls,
  `0..31` normal inner slots. (`GetBuilding` accepts −2…35 but `SetBuilding` only −2…31; `newBuilding`
  only −2…31.)
* Outer slots: `positionId` 1001 … 1040 (array of 41, index = position − 1000; index 0 / position 1000 is
  unused). `GetBuilding` throws for position − 1000 > 40.
* Each slot (`stBuilding`): `id` (= positionId), `type` (building type id, 0 = empty), `level` (0–10),
  `status`, `starttime`, `endtime` (ms).
* `status`: `0` = idle, `1` = constructing/upgrading (level stays at the *old* level until completion;
  a brand-new building is level 0 + status 1), `2` = destructing (demolishing one level).
* `city.m_level` mirrors the Town Hall level (set whenever `SetBuilding` is called with type 31).

### 2.2 Research (per player, not per city)
`client.research[25]` each `{ level (0–10), castleid (city doing the research, 0 = none), starttime, endtime }`.
`city.m_researching` (bool, per city) = "this city's academy is busy". On server load, any research row with
`castleid > 0` sets that city's `m_researching = true` and recreates a research timed event.

### 2.3 Troop/fortification production queues (per city)
`city.m_troopqueue` = list of `stTroopQueue { positionid, nextqueueid (starts 0), status, queue: list<stTroopTrain> }`.
One queue exists per **Barracks** slot (created when a barracks/walls reaches level ≥ 1 via `SetBuilding`)
and one for **Walls** at position `-2` (fortifications).
`stTroopTrain { troopid, count, queueid, starttime, endtime, costtime }`:
* `queueid` = queue's `nextqueueid++` at enqueue time.
* `costtime` = total ms for the whole batch.
* `starttime` = time the batch was **enqueued** (not when it started).
* `endtime` > 0 only for the head (in-progress) batch; queued batches have `endtime = 0`.

### 2.4 Other city state used
`m_resources {gold, food, wood, stone, iron}` (doubles), `m_maxresources`, `m_production`, `m_workpopulation`,
`m_workrate {gold = tax rate %, food/wood/stone/iron = commence rate %}`, `m_population` (int),
`m_maxpopulation`, `m_availablepopulation` (uint32), `m_loyalty` (int8), `m_grievance` (int8),
`m_lastcomfort`, `m_lastlevy` (ms, **in-memory only — reset to 0 on restart**), `m_troops` (12 counters),
`m_forts {traps, abatis, towers, logs, trebs}`, `m_mayor` (Hero or null), `m_heroes[10]`, `m_innheroes[10]`,
`m_tileid`, `m_cityname`, `m_logurl`, `armymovement`.

### 2.5 Player state used
`cents` (premium currency, shown to client as `medal`), `itemlist` (list of `{id, name, count, mincount, maxcount}`),
`flag`, `playername`, `password`, `status` (e.g. `DEF_TRUCE` = 2), `bufflist`, `castlesignlist`,
`clientdelay` (ms the login took; subtracted from some `endTime`s as a "lag" hack), `prestige`.

### 2.6 Global timed-event lists
`buildinglist` (DEF_TIMEDBUILDING = 2, payload `{city, client, positionid}`) and `researchlist`
(DEF_TIMEDRESEARCH = 3, payload `{city, client, researchid}`). Troop queues are **not** timed events; they are
polled directly (§12). The timer thread polls every 100 ms.

---

## 3. Shared formulas

Notation: `mgmt`, `pow`, `strat` = the city mayor's `GetManagement()`, `GetPower()`, `GetStratagem()`
(base + added + buff-added). If the city has no mayor the hero factor is 1.
`R(t)` = player's research level of tech `t`.

### 3.1 Building construction / upgrade time
```
heroFactor = mayor ? 0.995 ^ mgmt : 1
seconds    = cfg.time * heroFactor * 0.9 ^ R(T_CONSTRUCTION=17)
```
* `castle.newBuilding`:   `endTime = timestamp + floor(1000 * seconds)`  (floor applied to ms)
* `castle.upgradeBuilding`: `endTime = timestamp + floor(seconds) * 1000` (floor applied to seconds)
* `cfg` = `m_buildingconfig[type][currentLevel]` (index 0 = cost/time to reach level 1).

### 3.2 Building destruct (demolish one level) time
```
cfg.destructtime = cfg.buildtime / 2      (set at config load)
ms = floor( m_buildingconfig[type][level-1].destructtime * 1000 * heroFactor(mgmt) * 0.9 ^ R(17) )
endTime = timestamp + ms
```
i.e. half the time it took to build the current level, reduced by management & Construction.

### 3.3 Research time
```
seconds = floor( m_researchconfig[tech][currentLevel].time * (mayor ? 0.995 ^ strat : 1) )
endTime = timestamp + seconds * 1000
```
No tech reduces research time.

### 3.4 Troop training time (`AddToBarracksQueue`, barracks positions)
Displayed (in `troop.getTroopProduceList`):
```
heroFactor = mayor ? 0.995 ^ pow : 1
siege (TR_CATAPULT 13, TR_RAM 12, TR_TRANSPORTER 8, TR_BALLISTA 11):
    perUnit = cfg.time * heroFactor * 0.9 ^ R(T_METALCASTING=5)
others:
    perUnit = cfg.time * heroFactor * 0.9 ^ R(T_MILITARYSCIENCE=8)
time shown = floor(perUnit)   (seconds, per unit)
```
**Actually charged** (`AddToBarracksQueue`) – the C++ `switch` is missing a `break`, so siege units fall through:
```
siege:  perUnit = cfg.time * heroFactor^2 * 0.9^R(5) * 0.9^R(8)
others: perUnit = cfg.time * heroFactor   * 0.9^R(8)
batch costtime (ms) = floor(perUnit) * count * 1000
```
(Bug: siege units get double hero reduction and both techs. Intended: identical to the displayed formula.)

### 3.5 Fortification build time (Walls queue, position −2)
```
perUnit = cfg.time * (mayor ? 0.995 ^ mgmt : 1) * 0.9 ^ R(T_CONSTRUCTION=17)
batch costtime (ms) = floor(perUnit) * count * 1000
```

### 3.6 Speed-up items (shared by `castle.speedUpBuildCommand` and `tech.speedUpResearch`)
`duration = endtime - starttime` (the **total** original duration, not the remaining time).

| itemId | cents if player lacks item | time reduction (ms) |
|---|---|---|
| `free.speed` | — | special: only if `duration <= 300000` (5 min); reduces `endtime` by 300000 |
| `consume.2.a` | 5 | 15 min = 900000 |
| `consume.2.b` | 10 | 60 min = 3600000 |
| `consume.2.b.1` | 20 | 150 min = 9000000 |
| `consume.2.c` | 50 | 8 h = 28800000 |
| `consume.2.c.1` | 80 | random `(rand()%21 + 10)` hours, i.e. 10–30 h |
| `consume.2.d` | 120 | `duration * 0.30` |
| `player.speedup.1` | 175 | `duration * 0.50` (item does not exist in config_items, always paid in cents) |
| `player.destroy.1.a` | 20 | buildings only: instant full demolish (see §6.8) |
| `coins.speed` | `calculatecoinsforspeedup(duration)` | `duration` (finishes immediately) |
| anything else | 0 | 0 (no-op "success") |

Payment rule: if `GetItemCount(itemId) <= 0` → if `cents < price` error `-99 "Not enough cents."`, else
`cents -= price` and push `server.PlayerInfoUpdate`; otherwise consume one item (`AddItem(itemId, -1)` →
push `server.ItemUpdate`).

### 3.7 Coin cost to finish (`calculatecoinsforspeedup(msLeft)`)
Exact original (with bug):
```
coins = 0; t = msLeft
if t >= 28800000: coins += 50 * floor(t / 28800000); t %= 28800000     // 50 per 8h block
if t >  21600000: return coins + 50                                      // >6h remainder → one more 8h block
if t >=  9000000: coins += 20 * floor(t / 9000000);  t %= 9000000       // 20 per 150-min block
if t >   7200000: return coins + 20                                      // >2h remainder
if t >=  3600000: coins += 10 * floor(t / 3600000);  t %= 3600000       // 10 per hour
if t >   1800000: return coins + 10                                      // >30min remainder
if t >=   900000: coins  = 5 * floor(t / 900000);    t %= 900000        // BUG: '=' instead of '+='
if t > 0:         coins += 5
return coins
```
Intended: the 15-minute line should be `coins += ...`. Sample outputs of the original (minutes → coins):
0→0, 1→5, 15→5, 16→10, 30→10, 60→10, 61→15, 89→**10**, 90→10, 91→20, 150→20, 151→25, 180→**10**,
240→**10**, 300→40, 360→50, 480→50, 481→55, 500→**10**, 600→70, 1000→110 (bold = bug-affected; intended
values: 89→20, 180→30, 240→40, 500→70).

### 3.8 Prestige for completed actions (`GetPrestigeOfAction(action, id, level, thlevel)`)
```
prestige = base(action, id)
repeat `level` times:      prestige *= 2
repeat `thlevel - 1` times: prestige /= 2          // thlevel = city Town Hall level (city.m_level)
```
* Building completion: `action=DEF_BUILDING(2)`, `level` = the **new** level.
* Research completion: `action=DEF_RESEARCH(1)`, `level` = the **new** research level.
* Troop/fort batch completion: `count * GetPrestigeOfAction(DEF_TRAIN(3), troopid, 1, thlevel)`.
* Demolish completion: no prestige.
Base values are in §14.4. The gain is added to `client.prestige` (clamped 0…2,100,000,000) and also added to
the mayor's `m_experience` (if a mayor exists) followed by `server.HeroUpdate` (updateType 2).

---

## 4. Shared object shapes

### 4.1 Prerequisite entries
* building prerequisite: `{ level: req.level, curLevel: city.GetBuildingLevel(req.id), successFlag: curLevel >= level, typeId: req.id }`
  (`GetBuildingLevel` = max level among all slots of that type, 0 if none).
* item prerequisite: `{ curNum, num: req.level, successFlag: curNum >= num, id: m_items[req.id].name }` (item
  name string, e.g. `"consume.blueprint.1"`).
* tech prerequisite: `{ level, curLevel: R(req.id), successFlag, id: req.id }` (key `id`, not `typeId`) — except in
  the castle building lists, see notes.
Entries with `req.id <= 0` are skipped (config uses `"0,0"` as "none").

### 4.2 conditionBean
```
{ time, destructTime, wood, food, iron, gold, stone,
  buildings: [building prereq...], items: [item prereq...], techs: [tech prereq...],
  population }
```
Exact per-command differences are documented with each command.

### 4.3 buildingBean (`stBuilding::ToObject`)
```
{ startTime: double ms, endTime: double ms, level, status, typeId, positionId, name: Utils::GetBuildingName(type) }
```
`name` table in §14.1; unknown types (incl. 0) → `"Failed"`.

### 4.4 resource bean (`PlayerCity::Resources()`)
```
{
  maxPopulation, taxIncome: production.gold, support: loyalty,
  wood:  { amount, storeRercent: (int)storepercent.wood,  workPeople: (int)workpopulation.wood,  max: (int)maxresources.wood,  increaseRate },
  stone: { ...same... }, iron: { ...same... }, food: { ...same... },
  buildPeople: 0,
  workPeople: int(Σ workpopulation.X * workrate.X / 100 for food,wood,stone,iron),
  curPopulation: population,
  herosSalary: Σ hero.level * 20 (over m_heroes),
  troopCostFood: m_troopconsume,
  gold: resources.gold,
  texRate: (int)workrate.gold,
  complaint: grievance,
  populationDirection: -1 | 0 | 1
}
```
(`storeRercent`, `texRate` typos are required.) `increaseRate = production.X * (efficiency/100) * (1 + mgmtPct/100) + 100`;
for food additionally `- troopconsume` (i.e. `... - m_troopconsume + 100`). `mgmtPct` (`m_resourcemanagement`) is
always 0 in the original. `populationDirection`: target = `int(maxPopulation * min(100, loyalty+grievance) / 100)`;
`-1` if population > target, `1` if <, else `0`.

### 4.5 castleBean (`PlayerCity::ToObject`)
```
{ buildingQueues: [], heros: [hero beans], status, allowAlliance: false, resource: <4.4>, logUrl, fieldId: tileid,
  usePACIFY_SUCCOUR_OR_PACIFY_PRAY: 1, transingTrades: [], troop: <4.6>, id: castleId, name, buildings: [buildingBean...],
  fortification: <4.7>, trades: [], fields: [], goOutForBattle: false, hasEnemy: false }
```
`buildings` lists all inner then outer slots with `type > 0` (same keys as buildingBean).

### 4.6 troop bean
`{ peasants: worker, archer, catapult, ballista, scouter: scout, carriage: transporter, heavyCavalry: cataphract,
militia: warrior, lightCavalry: cavalry, swordsmen: sword, pikemen: pike, batteringRam: ram }`

### 4.7 fortification bean
`{ trap: traps, rollingLogs: logs, rockfall: trebs, arrowTower: towers, abatis }`

### 4.8 playerInfo (`Client::PlayerInfo`)
`{ [alliance: "", allianceLevel: 0, levelId: alliancerank]  (only if allianceid > 0),
createrTime, office, sex, honor, bdenyotherplayer, id: accountid, accountName: email, prestige, faceUrl, flag,
userId: masteraccountid, userName: playername, castleCount, medal: cents, ranking: prestigerank, titleId: title,
lastLoginTime, population: Σ city.population }`

---

## 5. Server push messages emitted by this subset

All pushes are skipped if the client is not connected.

| cmd | data | emitted by |
|---|---|---|
| `server.BuildComplate` (sic) | `{ buildingBean, castleId }` — when re-using the response object it **also** contains `ok: 1, packageId: 0.0` | new/upgrade/destruct building, speed-ups, cancel, timer completion |
| `server.ResourceUpdate` | `{ castleId, resource: <4.4> }` | many |
| `server.CastleUpdate` | `{ updateType: 2, castleBean: <4.5> }` | troop.produceTroop, city.moveCastle, city.advMoveCastle |
| `server.TroopUpdate` | `{ caslteId (sic, typo), troop: <4.6> }` | troop.disbandTroop, troop completion (via SetTroops) |
| `server.FortificationsUpdate` | `{ castleId, fortification: <4.7> }` | fortifications.destructWallProtect, fort completion (via SetForts) |
| `server.PlayerInfoUpdate` | `{ playerInfo: <4.8> }` | cents spent, flag/name change, prestige gain, interior actions |
| `server.ItemUpdate` | `{ items: [ { id, count, minCount, maxCount } ] }` (empty array if the player has no row for that item) | every `AddItem` call |
| `server.PlayerBuffUpdate` | `{ buffBean: { descName, endTime, typeId }, updateType: 0 }` | setStopWarState, advMoveCastle |
| `server.ResearchCompleteUpdate` | `{ castleId }` | research completion |
| `server.HeroUpdate` | `{ castleId, hero: <hero bean>, updateType: 2 }` | mayor exp gain on completion |
| `server.EnemyArmysUpdate` | `{}` (bug: army list never attached) | moveCastle / advMoveCastle |
| `server.FriendArmysUpdate` | `{}` (bug: army list never attached) | moveCastle / advMoveCastle |
| `server.SelfArmysUpdate` | `{ armys: [armyBean...] }` | moveCastle / advMoveCastle |
| `castle.castleSignInfoArr` | `{ castleSignInfoArr: [ { id, name, y, x } ] }` | saveCastleSignList / deleteCastleSignList |

---

## 6. `castle.*` commands

### 6.1 `castle.getAvailableBuildingBean`
Lists buildable "inside == 2" building types (in the seed data only **Walls, type 32**).

Request: `{ castleId }` — VERIFY+CHECK.

Logic, for `i` in 0..34 using `cfg = m_buildingconfig[i][0]` (level-1 config):
1. skip unless `cfg.inside == 2`;
2. skip if `cfg.limit > 0 && limit <= city.GetBuildingCount(i)` (count of slots of that type, any level, incl. under construction);
3. skip unless `cfg.time > 0`;
4. emit `{ conditionBean, typeId: i }` with
   * `time = floor(cfg.time * 1000 * heroFactor(mgmt) * 0.9^R(17))` — **milliseconds** (inconsistent with `Inside` list which is seconds)
   * `destructTime = cfg.destructtime` (seconds, unmodified)
   * `wood/food/iron/gold/stone = (uint32) cfg.X`
   * `buildings` = building prereqs of level-1 config **plus tech prereqs (bug: tech prereqs are appended to `buildings` with key `typeId`)**
   * `items` = item prereqs; `curNum` uses `client.itemlist[req.id].count` (bug, see 15)
   * `techs = []` always
   * `population = cfg.population` (never loaded from DB → 0)

Response: `{ ok: 1, packageId: 0.0, builingList (sic): [ ... ] }`.

### 6.2 `castle.getAvailableBuildingListInside`
Same as 6.1 but filter `cfg.inside == 1`, and:
* `time = floor(cfg.time * heroFactor(mgmt) * 0.9^R(17))` — **seconds** (the `*1000` is commented out);
* resource fields are raw doubles, `gold` is hard-coded `0`;
* tech prereqs again appended to `buildings` (bug); `techs = []`.

Response: `{ ok: 1, packageId: 0.0, builingList: [...] }`.
Seed data: inside==1 types = 1,2,3,20,21,22,23,24,25,26,27,28,29,30,31 (and 32 only at level 10, not
relevant since only `[i][0]` is checked). Building "types" 14–18 in config_building have inside = 3 (fort
rows) and are never listed.

### 6.3 `castle.getAvailableBuildingListOutside`
Fixed order `[7, 4, 5, 6]` (Farm, Sawmill, Stonemine (Quarry), Ironmine); **no `inside` check**.
* skip if limit reached (limit is 0 for these → never), skip unless `time > 0`.
* `time` in **milliseconds** like 6.1; resource fields `(uint32)`.
* `successFlag` for building, item and tech prereqs is computed as `req.level ? true : false` (bug: always
  true; should compare current vs required). Tech prereqs appended to `buildings` (bug).

Response: `{ ok: 1, packageId: 0.0, builingList: [...] }`.

### 6.4 `castle.newBuilding`
Request: `{ castleId, buildingType: int, positionId: int }` — VERIFY+CHECK.

Steps:
1. `city.CalculateResources()`, `city.CalculateStats()` (§13).
2. Position range: error `-99 "Position invalid."` unless `-2 <= positionId <= 31` or `1001 <= positionId <= 1040`.
3. Error `-99 "Can't build building."` if `buildingType > 34 || buildingType <= 0` or the slot is occupied
   (`slot.type != 0`) or `limit > 0 && limit <= GetBuildingCount(buildingType)`.
4. "Out of bounds" check (buggy): if the position is **not** outer (`< 1001 || > 1040`) and
   `positionId - 1000 > TownHallLevel*3 + 10` → error `-99 "Out of bounds."`. Because it applies to inner
   positions (`positionId - 1000` is negative) it never fires. Intended: for **outer** positions,
   `positionId - 1000 <= TownHallLevel * 3 + 10` (Town Hall unlocks 3 field slots per level, base 10).
5. Error `-48 "One building allowed to be built at a time."` if any inner or outer slot of the city has
   `status != 0` (construct, upgrade or destruct). (TODO in source: hammer/queue items not supported.)
6. `CheckBuildingPrereqs(buildingType, 0)` false → error `-99 "Building Prerequisites not met."` (§13.6).
7. Resources: if any of food/wood/stone/iron/gold of `m_buildingconfig[type][0]` exceeds the city's → error
   `-1 "Not enough resources."`.
8. Send `castle.newBuilding` `{ ok: 1, packageId: 0.0 }`.
9. Deduct the 5 resources. Item prerequisites are **not** consumed here (only on upgrade).
10. `SetBuilding(type, level 0, positionId, status 1, startTime = timestamp, endTime = timestamp + floor(1000*seconds))` (§3.1).
11. Push `server.BuildComplate` `{ ok: 1, packageId: 0.0, buildingBean, castleId: client.currentcityid }`.
12. Push `server.ResourceUpdate`. Persist client + city.
13. Create timed event DEF_TIMEDBUILDING `{ city, client, positionId }` (also tagged accountid/castleid).

Notes: no check that inner-only types go to inner slots and field types to outer slots; the five "fort"
pseudo-buildings 14–18 present in config_building can be built as buildings (bug). No hammer queue.

### 6.5 `castle.destructBuilding`
Demolish one level of a building.

Request: `{ castleId, buildingType (ignored), positionId }` — VERIFY+CHECK.

1. `bldg = GetBuilding(positionId)` (throws → silent drop on invalid position).
2. `CalculateResources`, `CalculateStats`.
3. Error `-99 "Can't destroy building."` if `bldg.type > 34 || bldg.type <= 0 || bldg.level == 0`.
4. Error `-48 "One building allowed to be built at a time."` if any slot has `status != 0`.
5. Send `castle.destructBuilding` `{ ok: 1, packageId: 0.0 }`.
6. Create DEF_TIMEDBUILDING event `{ city, client, positionId }`.
7. `SetBuilding(type, level, pos, status 2, timestamp, timestamp + floor(destructMs))` (§3.2, uses
   `m_buildingconfig[type][level-1].destructtime`).
8. Push `server.BuildComplate` `{ ok, packageId, buildingBean, castleId }`; push `server.ResourceUpdate`;
   persist client + city.

No resource cost and no item requirement. On completion (§12.1) the level drops by 1 and 1/3 of that level's
build cost is refunded.

### 6.6 `castle.upgradeBuilding`
Request: `{ castleId, positionId }` — VERIFY+CHECK.

1. `CalculateResources`, `CalculateStats`.
2. `bldg = GetBuilding(positionId)`; `type = bldg.type`, `L = bldg.level`.
3. If `bldg.status != 0` → error `-45 "Invalid building status: Your network connection might have experienced delay or congestion. If this error message persists, please refresh or reload this page to login to the game again."`
4. Any slot with `status != 0` → `-48 "One building allowed to be built at a time."`
5. `CheckBuildingPrereqs(type, L)` false → `-99 "Building Prerequisites not met."` (empty slot → type 0 → false).
6. Any resource of `m_buildingconfig[type][L]` > city's → `-1 "Not enough resources."`
7. Consume item prerequisites of `m_buildingconfig[type][L]`: for each item prereq with id > 0,
   `AddItem(m_items[id].name, -count)` (push `server.ItemUpdate`). (Level-10 upgrades require 1 ×
   `consume.blueprint.1`.)
8. Send `castle.upgradeBuilding` `{ ok: 1, packageId: 0.0 }`.
9. Deduct resources; create DEF_TIMEDBUILDING event.
10. `seconds` per §3.1; push `server.ResourceUpdate`.
11. `SetBuilding(type, L, pos, status 1, timestamp, timestamp + floor(seconds)*1000)`.
12. Push `server.BuildComplate` `{ ok, packageId, buildingBean, castleId }`; persist client + city.

Notes: no max-level check — upgrading a level-10 building reads `m_buildingconfig[type][10]` (out of bounds,
effectively the next type's level-1 row). Intended: reject when `L >= 10`.

### 6.7 `castle.checkOutUpgrade`
Returns the cost of the next level of the building in a slot.

Request: `{ castleId, positionId }` — VERIFY+CHECK.
`L = slot.level`, `id = slot.type`.

* If `L >= 10`: response
  `{ ok: 1, packageId: 0.0, conditionBean: { time: 31536000, destructTime: m_buildingconfig[id][10].destructtime (OOB bug; intended probably cfg[id][9].destructtime or 0), wood: 50000000, food: 50000000, iron: 50000000, gold: 0, stone: 50000000 } }`
  (no buildings/items/techs/population keys).
* Else: `cfg = m_buildingconfig[id][L]`,
  * `time = floor(cfg.time * heroFactor(mgmt) * 0.9^R(17))` (seconds),
  * `destructTime = cfg.destructtime * heroFactor(mgmt) * 0.9^R(17)` (seconds, **not floored**; note it uses the
    next level's row whereas `destructBuilding` uses `[L-1]`),
  * resources `(uint32)` from `cfg`,
  * `buildings` (typeId key), `items` (correct item count via `GetItemCount(id)`), `techs` (key `id`),
  * `population = cfg.population` (0).
  Response `{ conditionBean, ok: 1, packageId: 0.0 }`.
Empty slot (type 0) yields an all-zero bean.

### 6.8 `castle.speedUpBuildCommand`
Request: `{ castleId, positionId, itemId: string }` — VERIFY+CHECK. `building = GetBuilding(positionId)`.
`duration = building.endtime - building.starttime`. No check that the building is actually under construction.

* `itemId == "free.speed"`:
  * if `duration <= 300000` → send `castle.speedUpBuildCommand` `{ packageId: 0.0, ok: 1 }`, then
    `building.endtime -= 300000`, persist client + city. (No BuildComplate push.)
  * else error `-99 "Invalid speed up."` (TODO: real error text unknown).
* otherwise:
  1. **Send success first**: `castle.speedUpBuildCommand` `{ packageId: 0.0, ok: 1 }`.
  2. Determine `cents` / `reducetime` from the table in §3.6.
  3. `player.destroy.1.a` (Dynamite – instant demolish): pay 20 cents or 1 item (error `-99 "Not enough cents."`
     possible — sent *after* the success); `building.endtime = building.starttime`;
     `SetBuilding(type, level **1**, id, status, starttime, endtime)` — forces level to 1 so that the next timer
     tick (if status is 2) removes the building entirely (refund = 1/3 of level-1 cost). Push
     `server.BuildComplate` `{ ok, packageId, buildingBean, castleId }`; persist; return.
     (If used on a status-1 building it instead sets level to 1 and completes the "upgrade" → level 2. Bug.)
  4. `coins.speed`: `reducetime = duration`, `cents = calculatecoinsforspeedup(duration)` (bug: uses total
     duration instead of remaining time; `castle.getCoinsNeed` uses remaining).
  5. Payment per §3.6 (error `-99 "Not enough cents."` after the success was already sent).
  6. `building.endtime -= reducetime`; `SetBuilding(type, level, id, status, starttime, endtime)`.
  7. Push `server.BuildComplate` `{ ok, packageId, buildingBean, castleId }`; persist client + city.
Completion itself happens in the timer (§12.1) when `endtime < now`.

### 6.9 `castle.getCoinsNeed`
Request: `{ castleId, positionId }` — VERIFY+CHECK.
`city = client.GetCity(castleId)` (null → crash in original), `building = city.GetBuilding(positionId)`.
If `building.endtime < now` → error `-99 "Invalid position id."`.
Response: `{ packageId: 0.0, ok: 1, coinsNeed: calculatecoinsforspeedup(endtime - now) }`.

### 6.10 `castle.cancleBuildCommand` (sic)
Request: `{ castleId, positionId }` — VERIFY+CHECK.

Original behaviour:
1. Iterate the **global** `buildinglist` and take the first event whose `positionid == positionId`
   (bug: does not check the city/player — may hit another player's event).
2. `bldg = event.city.GetBuilding(positionId)`.
3. If `bldg.status != 0`:
   * sets `bldg.status = 0`, then tests `status == 1` for refund → never true → **no refund ever** (bug).
     Intended: if the slot was status 1 (construct/upgrade), refund 100% of `m_buildingconfig[type][level]`
     food/wood/stone/iron/gold (that is what the dead code computes). Destruct cancel refunds nothing.
   * remove the event;
   * `level == 0` → `SetBuilding(0,0,pos,0,0,0)` (slot emptied); else `SetBuilding(type, level, pos, 0, 0, 0)`.
   * `client.CalculateResources()` (all cities), `city.CalculateStats()`.
   * Push `server.BuildComplate` `{ ok: 1, packageId: 0.0, buildingBean, castleId: client.currentcityid }`.
     **The `castle.cancleBuildCommand` response itself is never sent** (the code overwrites `cmd` before sending);
     the client only sees the BuildComplate push. Recommend sending `castle.cancleBuildCommand {ok:1,packageId:0}`
     then the push.
   * Persist client + city.
4. Else error `-99 "Not being constructed."` (sent to the event's owner).
5. If no event matches → no response at all.

### 6.11 `castle.saveCastleSignList`
Bookmark a castle on the map. No castleId verification.
Request: `{ x: int, y: int, id: tileId }`.
1. `tile = map.GetTileFromID(id)` (no bounds check).
2. If `tile.type != CASTLE (11)` → builds error `castle.saveCastleSignList -99 "Invalid coordinates"` but **never
   sends it** (bug) and returns.
3. Append `{ x, y }` to `client.castlesignlist` (bug: `tileid`, `id` (castle id), `name` are left uninitialised;
   intended: `tileid = id`, `id = tile.castleid`, `name = tile.GetName()`).
4. Push `castle.castleSignInfoArr` `{ castleSignInfoArr: [ { id: castleId, name, y, x } ... ] }`.
No direct response, no persistence call (persisted on later client save as comma-separated tile ids).

### 6.12 `castle.deleteCastleSignList`
Request: `{ id }` (tile id per comment, but compared against the stored castle id `stCastleSign.id`).
Removes the first matching entry and pushes `castle.castleSignInfoArr`. If none matches, builds but **never sends**
`castle.saveCastleSignList -99 "Invalid castle"`. No other response.

---

## 7. `city.*` commands

### 7.1 `city.advMoveCastle` (Advanced City Teleporter) — effectively unimplemented
Request: `{ castleId, targetId: int32 }` — VERIFY+CHECK. `targetId` is ignored.
Original sequence (all executed unconditionally):
1. Send error `city.advMoveCastle -90 "Adv City Teleporter is in cooldown."` (always — placeholder).
2. Push `server.CastleUpdate` (focus city), `server.EnemyArmysUpdate`, `server.FriendArmysUpdate`, `server.SelfArmysUpdate`.
3. `AddItem("player.more.castle.1.a", -1)` (push ItemUpdate; can drive an existing count negative), then an extra
   `ItemUpdate("player.more.castle.1.a")`.
4. Push `server.PlayerBuffUpdate` `{ buffBean: { descName: "Adv City Teleporter in cooldown.", endTime: now + 43200000, typeId: "MoveCastleCoolDownBuff" }, updateType: 0 }` — push only, buff is **not** stored.
5. Send `city.advMoveCastle` `{ packageId: 0.0, ok: 1 }`.
No city is moved. Intended (per comments): if a `MoveCastleCoolDownBuff` is active (12 h) → `-90` error; else move
the city to `targetId` (like 7.2 but to a chosen flat), consume the item, add a 12 h `MoveCastleCoolDownBuff`.

### 7.2 `city.moveCastle` (random City Teleporter into a state/zone)
Request: `{ castleId, zoneId: int8 (0–15), ... }` — VERIFY+CHECK.
1. `GetItemCount("consume.move.1") == 0` → `-90 "No City Teleporter."`.
2. `zoneId < 0 || zoneId > 15` → **consume one `consume.move.1`** then `-90 "Trying to teleport to an invalid zone."`.
3. `city` = focus city.
4. If `map.m_openflats[zoneId] > 0`:
   1. `m_openflats[zoneId]--`; `randomid = map.GetRandomOpenTile(zoneId)` (random entry removed from that zone's
      open-flat list; returns −1 if list empty — not handled).
   2. If `tile[randomid].type != FLAT (10)` or `tile.ownerid != 0` → `-25 "No open flats exist."`.
   3. If `city.armymovement` non-empty → `-77 "You must recall all of your troops before you teleport your city."`
   4. If any `client.friendarmymovement` entry has `targetfieldid == city.tileid && direction == DIRECTION_STAY (3)`
      → same `-77` error.
   5. Old tile: `type = FLAT` (bug: `m_city`, `m_castleid`, `m_ownerid` not cleared). `city.tileid = randomid`.
      New tile: `type = CASTLE`, `m_city = city`, `m_castleid = city.castleid` (bug: `m_ownerid` not set).
   6. Push `server.CastleUpdate`, `server.EnemyArmysUpdate`, `server.FriendArmysUpdate`, `server.SelfArmysUpdate`.
   7. `AddItem("consume.move.1", -1)` (push ItemUpdate). `map.CalculateOpenTiles()` (recount).
   8. Send `city.moveCastle` `{ packageId: 0.0, ok: 1 }`.
5. Else `-25 "No open flats exist."`.
No explicit persistence (city `fieldid` saved on next city save). Enemy armies already marching keep targeting the
old tile; allied armies fail on arrival (comments). Zones = the 16 states (§14.6); `zoneId` = state index.

### 7.3 `city.modifyCastleName`
Request: `{ castleId, logUrl: string, name: string }` — VERIFY+CHECK.
Sets `city.m_cityname = name`, `city.m_logurl = logUrl` with no validation (TODO in source).
Response `{ packageId: 0.0, ok: 1 }`; persist city. No push.

### 7.4 `city.modifyFlag`
Request: `{ newFlag: string }` (no castle checks).
`GetItemCount("consume.changeflag.1") <= 0` → `-99 "Not enough item."`. Else consume 1 (ItemUpdate push),
`client.flag = newFlag` (no validation, TODO), push `server.PlayerInfoUpdate`, response `{ packageId: 0.0, ok: 1 }`,
persist client.

### 7.5 `city.setStopWarState` (Truce Agreement)
Request: `{ passWord: string, ItemId: string }` (note capital `I` in `ItemId`).
1. `client.password != passWord` → `-50 "Incorrect account or password."`.
2. If player owns `ItemId` (`count > 0`): consume 1, set `client.status = DEF_TRUCE (2)`.
   Else: `cost = GetItem(ItemId).cost` (null → crash for unknown ids); `cents < cost` → `-99 "Not enough cents."`;
   else `cents -= cost` (bug: `status` not set to truce on this path; no PlayerInfoUpdate).
3. If `ItemId == "player.peace.1"`: `SetBuff("PlayerPeaceBuff", "Truce Agreement activated", timestamp + 43200000)`
   (pushes `server.PlayerBuffUpdate` updateType 0). Else → `-99 "Invalid state."` (bug: item/cents already consumed;
   intended: validate first).
4. Response `{ packageId: 0.0, ok: 1 }`; persist client.
Not checked: an active `PlayerPeaceCoolDownBuff`. (Timer: when `PlayerPeaceBuff` expires, a 12 h
`PlayerPeaceCoolDownBuff` "Truce Agreement in cooldown." is set — handled by the buff system.)

### 7.6 `city.modifyUserName`
Request: `{ userName: string, itemId: string }`.
1. `itemId != "player.name.1.a"` → `-99 "No item exists."`.
2. `GetItemCount("player.name.1.a") <= 0` → `-99 "Not enough item."`.
3. Consume 1 (ItemUpdate), `client.playername = userName` (no validation/uniqueness — TODO), push
   `server.PlayerInfoUpdate`, response `{ packageId: 0.0, ok: 1 }`, persist client.
Bug: `Client::SaveToDB` does not include the player name, so the rename is lost on restart.

---

## 8. `interior.*` commands

### 8.1 `interior.modifyTaxRate`
Request: `{ castleId, tax: int }` — VERIFY+CHECK.
`city.workrate.gold = (0 <= tax <= 100) ? tax : 0` (out-of-range silently → 0; TODO error).
Response `{ packageId: 0.0, ok: 1 }`. Then `CalculateStats()`, `CalculateResources()` (note: accrues the elapsed
period at the **new** rate), push `server.ResourceUpdate`, persist client + city.

### 8.2 `interior.modifyCommenceRate`
Request: `{ castleId, foodrate, woodrate, ironrate, stonerate }` (ints, %) — VERIFY+CHECK.
1. `CalculateStats()`, `CalculateResources()` (accrue at old rates).
2. For each: value in 0..100 → set `workrate.X`; else set 0 (TODO error).
3. Response `{ packageId: 0.0, ok: 1 }`; `CalculateStats()`; push `server.ResourceUpdate`; persist client + city.

### 8.3 `interior.pacifyPeople` (Comfort)
Request: `{ castleId, typeId: int }` — VERIFY+CHECK.
1. Cooldown 15 min: if `timestamp - city.lastcomfort < 900000` → error `-34` with message
   `"{min}m {sec}s interval needed for next comforting."` where `diff = lastcomfort + 900000 - timestamp`,
   `min = int(diff/1000/60)`, `sec = int((diff/1000/60 - min) * 60)`.
2. `city.lastcomfort = timestamp` (set **before** validation — a failed attempt still consumes the cooldown).
3. Switch on `typeId` (`maxpop` = `city.m_maxpopulation`):
   | typeId | name | cost | effect |
   |---|---|---|---|
   | 1 | Disaster Relief | food ≥ maxpop else `-99 "Not enough food."`; food −= maxpop | loyalty += 5 (cap 100), grievance −= 15 (floor 0) |
   | 2 | Praying | same food cost | loyalty += 25 (cap 100), grievance −= 5 (floor 0) |
   | 3 | Blessing | gold ≥ maxpop/10 (integer division) else `-99 "Not enough gold."`; gold −= maxpop/10 | food += maxpop; with probability `rand()%10 == 1` (10%) food += maxpop again, send `interior.pacifyPeople -99 "Free blessing!"` (error-shaped!), push ResourceUpdate + PlayerInfoUpdate, persist, **return without the success response** |
   | 4 | Population Raising | food ≥ maxpop*5 else `-99 "Not enough food."`; food −= maxpop*5 | population += maxpop/20 (5%), capped at maxpop |
   | other | — | — | nothing (still succeeds) |
   Each successful branch pushes `server.ResourceUpdate` and `server.PlayerInfoUpdate`.
4. Response `{ packageId: 0.0, ok: 1 }`; persist client + city.
(Resources are not re-accrued (`CalculateResources`) before checks.)

### 8.4 `interior.taxation` (Levy)
Request: `{ castleId, typeId: int }` — VERIFY+CHECK.
1. Cooldown 15 min on `city.lastlevy`, error `-34` `"{min}m {sec}s interval needed for next levy."` (same math).
2. `city.lastlevy = timestamp` (before further checks).
3. If `loyalty <= 20` → `-99 "Loyalty too low. Please comfort first."` (cooldown already consumed).
4. `loyalty -= 20` (regardless of typeId validity).
5. `pop = city.m_population`:
   | typeId | gain |
   |---|---|
   | 1 | gold += pop/10 (integer division) |
   | 2 | food += pop |
   | 3 | wood += pop |
   | 4 | stone += pop/2 (integer division) |
   | 5 | iron += pop * 0.40 |
   | other | nothing |
   Not capped by storage.
6. Push `server.ResourceUpdate`, `server.PlayerInfoUpdate`; response `{ packageId: 0.0, ok: 1 }`; persist client + city.

### 8.5 `interior.getResourceProduceData`
Request: `{ castleId }` — VERIFY+CHECK.
Response `{ packageId: 0.0, ok: 1, resourceProduceDataBean: [food, wood, stone, iron] }`, each element:
```
{ technologicalPercentage: m_resourcetech (0), totalOutput: 0,
  heroPercentage: production.X * (efficiency/100) * (m_resourcemanagement/100)  (always 0),
  maxLabour: workpopulation.X, commenceDemands: 0, fieldPercentage: m_resourcevalley (0),
  naturalPercentage: m_resourcebaseproduction (100), armyPercentage: troopconsume (food only, else 0),
  productionCapacity: production.X, typeid: 1|2|3|4 (food, wood, stone, iron), commenceRate: workrate.X,
  cimeliaPercentage: 0, basicOutput: 0 }
```
No recalculation is done before building the bean.

---

## 9. `tech.*` commands

Tech ids with config rows: 1–5, 7–20 (6 and 0 have no config → `time == 0` → invalid). Research is per player;
"busy" is tracked per city (`m_researching`).

### 9.1 `tech.getResearchList`
Request: `{ castleId }` — VERIFY only (no CHECK).
For `i` in 0..24 where `m_researchconfig[i][0].time > 0`:
* `level = R(i)`; `cfg = m_researchconfig[i][level]` (level 10 → out-of-bounds read of next tech's L1 row; bug —
  intended: show max level / no further cost).
* conditionBean: `time = floor(cfg.time * (mayor ? 0.995^strat : 1))`, `destructTime: 0`, `wood/food/iron/gold/stone` from
  `cfg`, `population: cfg.population` (0). Prerequisites are taken from **`m_researchconfig[i][0]`** (level-1 row)
  — bug: higher levels have different prereqs (e.g. Agriculture L(n) needs Farm L(n)); intended: use `cfg`.
  buildings (key `typeId`), items (itemlist-index bug), techs (key `id`).
* Bean:
  ```
  { startTime: research[i].starttime, castleId: research[i].castleid,
    level, upgradeing (sic), endTime, avalevel?, permition (sic), conditionBean, typeId: i }
  ```
  - If `research[i].endtime != 0 && endtime < timestamp` (finished but timer hasn't processed it yet):
    `level = level + 1`, `upgradeing = false`, `endTime = 0`, `avalevel = min(academyLevel, level+1)` **only if
    academy level != 0 (otherwise the key is omitted)**, `permition = true`.
  - Else: `level`, `upgradeing = (endtime != 0 && endtime > timestamp)`,
    `endTime = endtime > 0 ? endtime - client.clientdelay : endtime`,
    `avalevel = GetEffectiveTechLevel(i)` (= `min(academyLevel, R(i))`, or 0 if no academy),
    `permition = !city.m_researching`.
Response `{ ok: 1, packageId: 0.0, acailableResearchBeans (sic): [...] }`.

### 9.2 `tech.research`
Request: `{ castleId, techId: int }` — VERIFY+CHECK.
1. `techId < 0 || techId > 25 || research[techId].level >= 10 || m_researchconfig[techId][level].time == 0`
   → `-99 "Invalid technology."` (bug: 25 is out of bounds; should be `>= 25`).
2. If `city.m_researching` → `-99 "Research already in progress."`.
3. `cfg = m_researchconfig[techId][level]`; if any of food/wood/stone/iron/gold > city's → `-99 "Not enough resources."`
   (note `-99`, not `-1`). Resources are **not** re-accrued first.
4. **No prerequisite check** (Academy level, buildings, techs) — bug; intended: verify `cfg.buildings/techs/items` like
   `CheckBuildingPrereqs`. Also not checked: the same tech already being researched in another city
   (`research[techId].castleid != 0`).
5. Deduct resources; `research.castleid = castleId` (from request);
   `research.endtime = timestamp + floor(cfg.time * heroFactor(strat)) * 1000`; `research.starttime = timestamp`.
6. Timed event DEF_TIMEDRESEARCH `{ city, client, researchid: techId }`; `city.m_researching = true`.
7. Response:
   ```
   { ok: 1, packageId: 0.0, tech: {
       startTime, castleId, level: R(techId) (old level), conditionBean, avalevel: GetEffectiveTechLevel(techId),
       upgradeing: (starttime != 0) → true, endTime: endtime - clientdelay, typeId: techId, permition: false } }
   ```
   conditionBean here uses the **current-level** `cfg` for time (floored seconds), `destructTime: 0.0`, resources,
   buildings/items/techs prereqs, population.
8. Push `server.ResourceUpdate`; persist client (city resources not explicitly saved).

### 9.3 `tech.cancelResearch`
Request: `{ castleId }` — VERIFY+CHECK.
1. `city = client.GetCity(castleId)`; `techId` = first `i` in 0..24 with `research[i].castleid == castleId`, else 0.
2. `!city || !city.m_researching || techId == 0` → `-99 "Invalid city."`.
3. Refund **one third** of `m_researchconfig[techId][level]` for each of food/wood/stone/iron/gold (as doubles,
   e.g. 1000/3 = 333.33…).
4. Mark the first `researchlist` event for that city as cancelled (`researchid = 0`; the timer then discards it).
5. `research[techId] = { level unchanged, castleid 0, endtime 0, starttime 0 }`; `city.m_researching = false`.
6. Response `{ ok: 1, packageId: 0.0 }`; push `server.ResourceUpdate`; persist client.

### 9.4 `tech.speedUpResearch`
Request: `{ castleId, itemId }` — VERIFY+CHECK.
1. `research` = first `research[i]` with `castleid == city.castleid` (focus city), else `-99 "Invalid tech."`.
2. `duration = research.endtime - research.starttime`.
3. `free.speed`: if `duration <= 300000` → response `{ packageId: 0.0, ok: 1 }`, `endtime -= 300000`, persist client;
   else `-99 "Invalid speed up."`.
4. Otherwise: **send success first** `{ packageId: 0.0, ok: 1 }`; items per §3.6 (no `player.destroy.1.a` case);
   `coins.speed` costs `calculatecoinsforspeedup(duration)` (total, not remaining — bug); payment (error
   `-99 "Not enough cents."` possibly after success); `research.endtime -= reducetime`; persist client.
   **No push** of the new end time (client must re-query `tech.getResearchList`); completion via timer (§12.2).

### 9.5 `tech.getCoinsNeed`
Request: `{ castleId, positionId (unused) }` — VERIFY+CHECK.
Find research for the focus city as in 9.4 else `-99 "Invalid tech."`.
`left = max(0, endtime - now)`; response `{ packageId: 0.0, ok: 1, coinsNeed: calculatecoinsforspeedup(left) }`.

---

## 10. `troop.*` commands

Troop type ids: 2 worker, 3 warrior, 4 scout, 5 pike, 6 sword, 7 archer, 8 transporter, 9 cavalry,
10 cataphract, 11 ballista, 12 ram, 13 catapult (fortifications 14–18, see §11).

### 10.1 `troop.getProduceQueue`
Request: `{ castleId }` — VERIFY+CHECK.
For inner positions `i = 0..32` whose slot type is Barracks (2):
* `queue = GetBarracksQueue(i)`; if missing → log "Crash!" and return **with no response**.
* entry: `{ allProduceQueue: [ { num: count, queueId, endTime: endtime > 0 ? endtime - clientdelay : endtime, type: troopid, costTime: costtime/1000 (seconds, whole batch) } ... ], positionId: slot.id }`.
Response `{ packageId: 0.0, ok: 1, allProduceQueue: [entry...] }`.

### 10.2 `troop.accTroopProduce` (Napoleon's Diary: −30% on one batch)
Request: `{ castleId, positionId, queueId, itemId }` — VERIFY+CHECK.
1. `itemId != "player.troop.1.b"` → `-99 "Invalid speedup."`.
2. **Send success first**: `{ packageId: 0.0, ok: 1 }`.
3. In `GetBarracksQueue(positionId)` (null → crash), for every batch with matching `queueId`:
   * pay: no item → `cents < 30` → `-99 "Not enough cents."` (after success) else `cents -= 30` + PlayerInfoUpdate;
     has item → consume 1 (ItemUpdate).
   * if batch in progress (`endtime > 0`): `endtime -= (endtime - starttime) * 0.3`; `costtime *= 0.7`.
     else: `costtime *= 0.7`.
     (Note: `starttime` is the enqueue time, so for batches that waited in the queue the reduction exceeds 30% of the
     real duration. Intended: `endtime -= (endtime - now)*0.3` or 30% of costtime.)
4. Persist client + city. No push (client re-queries the queue). If no batch matches nothing happens (success already sent).

### 10.3 `troop.getTroopProduceList`
Request: `{ castleId }` — VERIFY+CHECK.
For `i` in 0..19 with `m_troopconfig[i].inside == 1` and `time > 0` (types 2–13):
`{ conditionBean: { time: floor(perUnit) (§3.4 displayed formula, seconds per unit), destructTime: 0, wood, food, iron, gold, stone, buildings (typeId), items (itemlist-index bug), techs (id), population: cfg.population }, permition: false, typeId: i }`.
Response `{ troopList: [...], ok: 1, packageId: 0.0 }`.

### 10.4 `troop.disbandTroop`
Request: `{ num: uint32, typeId: uint32 }` — **no** castle verification (acts on focus city).
1. For the type, if `city.<troop> < num` → `-99 "You do not have that many <plural>."` with plurals:
   workers, warriors, scouts, pikemen, swordsmen, archers, transporters, cavalry, cataphracts, ballistae, rams, catapults.
   Bug for `TR_WORKER (2)`: the check compares against `city.m_forts.traps` instead of `m_troops.worker`.
   Unknown type → `-99 "Invalid troops"`.
2. Refund: `city.resources += { gold, food, wood, stone, iron }` of **one unit's** training cost (not multiplied by
   `num`, and a full refund — bug; intended unclear, real Evony refunds nothing / a fraction × num).
3. `city.<troop> -= num`. Population is not returned.
4. Push `server.TroopUpdate`, `server.ResourceUpdate`.
5. Response `{ cmd: "troop.disbandTroop", data: null }` — the data object is empty (Null): **no `ok`/`packageId`**.
   No persistence call.

### 10.5 `troop.produceTroop`
Request: `{ castleId, troopType: int, isShare: bool, toIdle: bool, positionId: int, num: int }` — VERIFY+CHECK.
1. `res = cfg(troopType).{food,wood,stone,iron,gold} * num`.
2. `city.m_availablepopulation < num` → `-1 "Not enough population."` (uses the value from the last
   `CalculateStats`; not recalculated here).
3. any `res.X > city.X` → `-1 "Not enough resources."`.
4. `isShare || toIdle` → `-99 "Not supported action."`.
5. `resources -= res`; `population -= num` (1 per unit regardless of `cfg.population`); push `server.ResourceUpdate`,
   `server.CastleUpdate`.
6. `AddToBarracksQueue(positionId, troopType, num, isShare, toIdle)` (§13.4): fails (−1) when the barracks queue already
   holds `>= barracks.level` batches → `-99 "Troops could not be trained."` — **resources and population are not
   refunded** (bug; intended: check capacity before deducting).
7. Response `{ packageId: 0.0, ok: 1 }`; persist client + city.
Not validated (bugs): `troopType` range / that it is trainable in barracks (`inside == 1`), `num > 0` (negative num
yields resources!), that `positionId` is a barracks of this city (null queue → crash), troop prerequisites
(barracks level, techs). Intended: validate all of these using `m_troopconfig[type]` prereqs and `num >= 1`.

### 10.6 `troop.cancelTroopProduce`
Request: `{ castleId, positionId, queueId }` — VERIFY+CHECK.
Find the batch with `queueId` in `GetBarracksQueue(positionId)`:
* in progress (`endtime > 0`): refund `cfg.X * count / 3` for each resource (double), push ResourceUpdate, remove
  it, and start the next batch: `next.endtime = now + next.costtime`.
* queued (`endtime == 0`): refund 100% `cfg.X * count`, remove, push ResourceUpdate.
Then response `{ packageId: 0.0, ok: 1 }`, persist client + city. Population is **not** refunded (bug). If no batch
matches → no response.

---

## 11. `fortifications.*` commands

Fortification type ids: 14 trap, 15 abatis, 16 archer tower, 17 rolling log, 18 trebuchet (rockfall). Queue lives at
Walls position `-2`; capacity = Walls level. **For every `fortifications.*` command VERIFY+CHECK runs first**, and the
response data is pre-filled with `{ packageId: 0.0, ok: 1 }`.

### 11.1 `fortifications.getProduceQueue`
Request: `{ castleId }`.
`queue = GetBarracksQueue(-2)` (null if Walls not built → crash). Response:
`{ packageId: 0.0, ok: 1, allProduceQueue: [ { allProduceQueue: [ { num, queueId, endTime (minus clientdelay if > 0), type, costTime: costtime/1000 } ... ], positionId: -2 } ] }`.
Bug: a single inner object is reused for every entry, and objects are reference-typed, so **every element shows the
last batch's values**. Intended: one object per batch.

### 11.2 `fortifications.destructWallProtect`
Request: `{ castleId, num: uint32, typeId: uint32 }`.
For type 14/15/16/17/18 check `forts.traps/abatis/towers/logs/trebs < num` → `-99 "You do not have that many traps."` /
`"... abatis."` / `"... archer towers."` / `"... rolling logs."` / `"... trebuchets."`; unknown → `-99 "Invalid trap"`.
Refund one unit's full cost (not × num — same bug as 10.4); `forts.X -= num`. Push `server.FortificationsUpdate`,
`server.ResourceUpdate`. Response `{ packageId: 0.0, ok: 1 }`. No persistence call.

### 11.3 `fortifications.getFortificationsProduceList`
For `i` in 0..19 with `m_troopconfig[i].inside == 2` and `time > 0` (14–18):
`{ conditionBean: { time: floor(cfg.time * heroFactor(mgmt) * 0.9^R(17)), destructTime: 0, wood, food, iron, gold, stone, buildings, items, techs, population: 0 }, permition: false, typeId: i }`.
Response `{ packageId: 0.0, ok: 1, fortList: [...] }`.

### 11.4 `fortifications.accTroopProduce` (Archimedes' Note: −30%)
Request: `{ castleId, queueId, itemId }`.
1. `itemId != "player.fort.1.c"` → `-99 "Invalid speedup."`.
2. Send success `{ packageId: 0.0, ok: 1 }`.
3. For matching batches in the −2 queue: price 35 cents. Bug: the owned-item count is read for an **empty** item id, so
   it is always 0 → always charged 35 cents (`-99 "Not enough cents."` if insufficient), the item is never consumed.
   Intended: consume `player.fort.1.c` if owned, else 35 cents. Time effect identical to 10.2.
4. Persist client + city.

### 11.5 `fortifications.produceWallProtect`
Request: `{ castleId, wallProtectType: int, num: int }`.
1. `res = cfg.X * num`; any > city → `-1 "Not enough resources."`.
2. Deduct; push `server.ResourceUpdate`.
3. `AddToBarracksQueue(-2, type, num, false, false)`; `-1` (queue full) → `-99 "Troops could not be trained."` (no refund — bug).
4. Response `{ packageId: 0.0, ok: 1 }`; persist client + city.
Not validated: type range (14–18), `num > 0`, prerequisites (walls level/techs), wall space (fortifications occupy wall
capacity in real Evony), population (`cfg.population` ignored).

### 11.6 `fortifications.cancelFortificationProduce`
Request: `{ castleId, positionId (ignored), queueId }`. Same algorithm as 10.6 on the −2 queue. Response
`{ packageId: 0.0, ok: 1 }`; no response if not found.

---

## 12. Timer-driven completion (every 100 ms)

### 12.1 Building events (`buildinglist`)
For each event: `bldg = event.city.GetBuilding(positionid)`. Only if `bldg.endtime < now`:
* **status 1 (construct/upgrade)**:
  1. `level++`; `SetBuilding(type, level, pos, 0, 0.0, 0.0)` (creates a troop queue when a Barracks/Walls reaches level ≥ 1;
     updates `city.m_level` for the Town Hall).
  2. If type is Inn (21): delete all `m_innheroes` (tavern refresh).
  3. If Town Hall reaches level 5: `client.Beginner(false)` (push PlayerInfoUpdate) and system mail
     "Beginner's Protection Expired" (MAIL_SYSTEM) to the player.
  4. Remove event; prestige `GetPrestigeOfAction(DEF_BUILDING, type, newLevel, city.m_level)` → `client.Prestige(+gain)`.
  5. `client.CalculateResources()` (all cities: stats + accrue), `city.CalculateStats()`.
  6. Mayor: `experience += gain`, push `server.HeroUpdate` (updateType 2).
  7. Push `server.PlayerInfoUpdate`, `server.ResourceUpdate`, then `server.BuildComplate { buildingBean, castleId }`.
* **status 2 (destruct)**:
  1. `level--`; refund `m_buildingconfig[type][newLevel].X / 3` for food/wood/stone/iron/gold (1/3 of the cost of the
     level just removed).
  2. `newLevel == 0` → `SetBuilding(0, 0, pos, 0, 0, 0)` (slot emptied; bug: the troop queue of a destroyed Barracks is
     **not** removed because SetBuilding is called with type 0); else `SetBuilding(type, newLevel, pos, 0, 0, 0)`.
  3. `client.CalculateResources()`, `city.CalculateStats()`, push `server.BuildComplate { buildingBean (the slot as now), castleId }`,
     remove event, recalc again, push `server.ResourceUpdate`. No prestige.
* status 0 with `endtime < now` (e.g. stale/cancelled): event is left in the list forever (leak; harmless). Recommend removing.

### 12.2 Research events (`researchlist`)
* `researchid == 0` (cancelled) → remove event.
* else if `research[id].endtime < now`: `city.m_researching = false`; `level++`; clear endtime/starttime/castleid;
  remove event; prestige `GetPrestigeOfAction(DEF_RESEARCH, id, newLevel, city.m_level)`; `client.CalculateResources()`,
  `city.CalculateStats()`; mayor exp + HeroUpdate; push `server.PlayerInfoUpdate`, `server.ResourceUpdate`,
  `server.ResearchCompleteUpdate { castleId }`.

### 12.3 Troop / fortification queues (all online players, all cities)
For each queue, look at the head batch only: if it exists and `endtime <= now` (note: a head with `endtime == 0`
counts as done):
1. `gain = count * GetPrestigeOfAction(DEF_TRAIN, troopid, 1, city.m_level)`; `Prestige(+gain)`; push PlayerInfoUpdate;
   mayor exp + HeroUpdate.
2. Queue −2 → `SetForts(troopid, count)` (push FortificationsUpdate); else `SetTroops(troopid, count)` (push TroopUpdate).
3. Remove head; next batch: `endtime = now + costtime`.
At most one batch per queue completes per tick. No queue-update push (client polls `getProduceQueue`).

### 12.4 Every 6 minutes (360000 ms): `RecalculateCityStats()` for every player city (§13.3).

---

## 13. Helper semantics

### 13.1 `CalculateStats()`
```
maxresources.{food,wood,stone,iron} = 10000; maxpopulation = 50
for each inner slot with type 1 (Cottage): maxpopulation += COTTAGE_POP[level]
for each outer slot with type 7 Farm / 4 Sawmill / 5 Stonemine / 6 Ironmine (resource food/wood/stone/iron):
    max[res]     += 10000 * F[level]
    production[res] += 100 * F[level]
    workpopulation[res] += 10 * F[level]
production.{food,wood,stone,iron} *= workrate.X / 100
workpop = int( Σ workrate.X * workpopulation.X / 100 )   (food, stone, wood, iron)
availablepopulation = population - workpop      (uint32: wraps to a huge number if negative — bug)
productionefficiency = population >= workpop ? 100 : population / workpop * 100
production.gold = population * workrate.gold / 100
```
`COTTAGE_POP` (level 1..10) = 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500.
`F` (level 1..10) = 1, 3, 6, 10, 15, 21, 28, 36, 45, 55.
Warehouses, gold storage, techs (Agriculture etc.), valleys and heroes do **not** affect these values in the original
(TODO). Level 0 (under construction) contributes nothing.

### 13.2 `CalculateResources()` (accrual)
```
diff = now - timers.updateresources (ms); timers.updateresources = now
for res in food, wood, stone, iron:
    add = ((production[res] + 100) * (efficiency/100) / 3600000) * (1 + resourcemanagement/100) * diff
    food only: add -= troopconsume       (bug: flat subtraction per call, not time-scaled)
    if max[res] > current: current = min(max[res], current + add)   (never reduces an over-cap stock)
herosalary = Σ hero.level * 20
gold += (production.gold - herosalary) * diff / 3600000; gold = max(gold, 0)
```
`resourcemanagement` = 0 always (`CalculateResourceStats` is an empty TODO). 100 = `m_resourcebaseproduction`.

### 13.3 `RecalculateCityStats()` (6-minute tick)
```
target = int(maxpopulation * min(100, loyalty + grievance) / 100)
step   = int(maxpopulation * 0.05)
if population > target: population = (population - step < target) ? target : population - step
elif population < target: population = (population + step > target) ? target : min(maxpopulation, population + step)
targetLoyalty = 100 - min(100, taxrate + grievance)
if loyalty > 1: loyalty += sign(targetLoyalty - loyalty)   (±1 per tick)
production.gold = population * taxrate / 100
push server.ResourceUpdate
```

### 13.4 `AddToBarracksQueue(position, troopid, count, isShare, isIdle)`
```
queue = GetBarracksQueue(position); bldg = GetBuilding(position)
if queue.size >= bldg.level: return -1
compute perUnit (§3.4 charged formula for barracks, §3.5 for position -2)
batch = { troopid, count, costtime: floor(perUnit) * count * 1000, starttime: now,
          queueid: queue.nextqueueid++, endtime: queue empty ? now + costtime : 0 }
append; return 1
```
`isShare`/`isIdle` unused.

### 13.5 `SetBuilding(type, level, position, status, start, end)`
Writes the slot (position validated: −2..31 inner, outer ≤ 1040). For player cities, if `type` is Barracks (2) or Walls
(32): `level > 0` and no queue at `position` → create `{positionid, nextqueueid 0, status 0, []}`; `level == 0` and a
queue exists → delete it. If `type == 31` → `city.m_level = level`.

### 13.6 `CheckBuildingPrereqs(type, level)`
False if `type <= 0 || type > 35`. With `cfg = m_buildingconfig[type][level]`: every building prereq
(`GetBuildingLevel(id) >= lvl`), every item prereq (`GetItemCount(itemId) >= count`) and every tech prereq
(`R(id) >= lvl`) with `id != 0` must hold.

### 13.7 Misc
* `GetBuildingLevel(type)` = max level among slots of that type; `GetBuildingCount(type)` = number of slots with that type.
* `GetEffectiveTechLevel(tech)` = Academy (25) level ? `min(academyLevel, R(tech))` : 0.
* `AddItem(name, delta)`: if the player has a row for `name`, `count += delta` (can go negative) and push ItemUpdate;
  else if `delta < 0` do nothing; else create the row and push.
* `Client.Prestige(x)`: `prestige = clamp(prestige + x, 0, 2100000000)`.
* `client.GetResearchLevel(id)` = `research[id].level`.

---

## 14. Constants & lookup tables

### 14.1 Building type ids & names (`Utils::GetBuildingName`)
| id | name | id | name |
|---|---|---|---|
| 1 | Cottage | 22 | Forge |
| 2 | Barracks | 23 | Marketplace |
| 3 | Warehouse | 24 | Relief Station |
| 4 | Sawmill | 25 | Academy |
| 5 | Stonemine | 26 | Workshop |
| 6 | Ironmine | 27 | Feasting Hall |
| 7 | Farm | 28 | Embassy |
| 20 | Stable | 29 | Rally Spot |
| 21 | Inn | 30 | Beacon Tower |
| 31 | Town Hall | 32 | Walls |
Any other id → `"Failed"`. Fixed slots: Town Hall = −1, Walls = −2.

### 14.2 Research ids
1 Agriculture, 2 Lumbering, 3 Masonry, 4 Mining, 5 Metal Casting, 7 Informatics, 8 Military Science,
9 Military Tradition, 10 Iron Working, 11 Logistics, 12 Compass, 13 Horseback Riding, 14 Archery, 15 Stockpile,
16 Medicine, 17 Construction, 18 Engineering, 19 Machinery, 20 Privateering. (6 unused.)

### 14.3 Troop / fort ids and DB serialisation
TR_WORKER 2, TR_WARRIOR 3, TR_SCOUT 4, TR_PIKE 5, TR_SWORDS 6, TR_ARCHER 7, TR_TRANSPORTER 8, TR_CAVALRY 9,
TR_CATAPHRACT 10, TR_BALLISTA 11, TR_RAM 12, TR_CATAPULT 13, TR_TRAP 14, TR_ABATIS 15, TR_ARCHERTOWER 16,
TR_ROLLINGLOG 17, TR_TREBUCHET 18. (A second, unused set `WORKER 1 … CATAPULT 11` exists in defines.h — ignore.)

### 14.4 Prestige base values (`GetPrestigeOfAction`)
Research (DEF_RESEARCH=1): Agriculture 52, Lumbering 62, Masonry 82, Mining 110, Metal Casting 114*, Informatics 118*,
Military Science 122, Military Tradition 156, all others (10–20) 52* (*"not final" in source).
Building (DEF_BUILDING=2): Cottage 4, Barracks 28, Warehouse 21, Sawmill 7, Stonemine 9, Ironmine 11, Farm 5,
Stable 36, Inn 26, Forge 26, Marketplace 32, Relief Station 26*, Academy 30, Workshop 38, Feasting Hall 35, Embassy 18,
Rally Spot 25, Beacon Tower 39, Town Hall 112, Walls 128.
Train (DEF_TRAIN=3): Worker 0.5, Warrior 0.5, Scout 1.0*, Pike 2.0, Swords 3*, Archer 4*, Transporter 5*, Cavalry 6*,
Cataphract 7*, Ballista 8*, Ram 9*, Catapult 10*, Trap 1*, Abatis 2*, Archer Tower 3*, Rolling Log 4*, Trebuchet 5*.
Unlisted ids → 0. Formula in §3.8.

### 14.5 Item ids referenced (name → config cost in cents, description)
`consume.2.a` 5 Beginner Guidelines · `consume.2.b` 10 Primary Guidelines · `consume.2.b.1` 20 Intermediate Guidelines ·
`consume.2.c` 50 Senior Guidelines · `consume.2.c.1` 80 Master Guidelines · `consume.2.d` 120 Ultimate Guidelines ·
`consume.blueprint.1` (config item id 19) 50 Michelangelo's Script · `consume.changeflag.1` 6 National Flag ·
`consume.move.1` 30 City Teleporter · `player.destroy.1.a` 20 Dynamite · `player.fort.1.c` 35 Archimedes' Note ·
`player.more.castle.1.a` 90 Adv City Teleporter · `player.name.1.a` 200 New ID · `player.peace.1` 30 Truce Agreement ·
`player.troop.1.b` 30 Napoleon's Diary. (`player.speedup.1` and `free.speed`, `coins.speed` are not items.)
Note the handler prices (§3.6, 30/35 cents) are hard-coded, not read from config, except `setStopWarState` which uses
config `cost`.

### 14.6 Zones (states) for `city.moveCastle`
0 FRIESLAND, 1 SAXONY, 2 NORTH MARCH, 3 BOHEMIA, 4 LOWER LORRAINE, 5 FRANCONIA, 6 THURINGIA, 7 MORAVIA,
8 UPPER LORRAINE, 9 SWABIA, 10 BAVARIA, 11 CARINTHIA, 12 BURGUNDY, 13 LOMBARDY, 14 TUSCANY, 15 ROMAGNA
(map split into a 4×4 grid of quarters of `mapsize`).

### 14.7 Timing constants
Comfort/levy cooldown 900000 ms (15 min); free speed-up threshold & amount 300000 ms (5 min); truce & adv-teleport
cooldown 43200000 ms (12 h); timer tick 100 ms; city recalc 360000 ms (6 min); hero factor base 0.995; tech factor 0.9;
refunds: cancelled research 1/3, cancelled in-progress troop batch 1/3, queued batch 1/1, demolish 1/3 of removed level.

### 14.8 Config tables (seed: `DB/evony (3).sql`)
Loading rules: `config_building` row `(buildingid, level)` → `m_buildingconfig[buildingid][level-1]`;
`time = buildtime` (s), `destructtime = buildtime / 2`, `food, wood, stone, iron, gold`, `prestige = gold` (unused, bug),
`limit = blimit`, `inside`. Prereq strings: `"id,level|id,level"`; `"0,0"`/`""` = none. `population` is never loaded
(treat as 0). `config_research` → `m_researchconfig[researchid][level-1]` (same fields; time read as int).
`config_troops` → `m_troopconfig[troopid]` (time, food, wood, stone, iron, gold, inside, population, prereqs; destructtime 0).

**config_building** — every resource and time doubles per level: `value(L) = value(1) * 2^(L-1)` (verified for all rows).
Level-1 values (time s, wood, food, stone, iron, gold), inside, limit, prereqs:

| type | L1 time | wood | food | stone | iron | gold | inside | limit | building prereq (by level) | item prereq |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 Cottage | 75 | 500 | 100 | 100 | 50 | 0 | 1 | 0 | L1–2 none; L3..L10: Town Hall ≥ L−1 | L10: item 19 ×1 |
| 2 Barracks | 300 | 1200 | 250 | 1500 | 500 | 0 | 1 | 0 | Rally Spot (29) ≥ 1 | L10: 19 ×1 |
| 3 Warehouse | 600 | 1500 | 100 | 1000 | 300 | 0 | 1 | 0 | none | L10: 19 ×1 |
| 4 Sawmill | 45 | 100 | 100 | 250 | 300 | 0 | 0 | 0 | none | L10: 19 ×1 |
| 5 Stonemine | 60 | 500 | 180 | 150 | 400 | 0 | 0 | 0 | none | L10: 19 ×1 |
| 6 Ironmine | 90 | 600 | 210 | 500 | 200 | 0 | 0 | 0 | none | L10: 19 ×1 |
| 7 Farm | 30 | 300 | 50 | 200 | 150 | 0 | 0 | 0 | none | L10: 19 ×1 |
| 20 Stable | 270 | 2000 | 1200 | 800 | 1000 | 0 | 1 | 1 | Farm (7) ≥ 5 | L10: 19 ×1 |
| 21 Inn | 240 | 2000 | 300 | 1000 | 400 | 0 | 1 | 1 | Cottage (1) ≥ 2 | L10: 19 ×1 |
| 22 Forge | 180 | 1000 | 125 | 600 | 1200 | 0 | 1 | 1 | Ironmine (6) ≥ 3 | L10: 19 ×1 |
| 23 Marketplace | 750 | 1000 | 1000 | 1000 | 1000 | 0 | 1 | 1 | none | L10: 19 ×1 |
| 24 Relief Station | 3600 | 5000 | 1500 | 4500 | 500 | 0 | 1 | 1 | Stable (20) ≥ 1 | L10: 19 ×1 |
| 25 Academy | 480 | 2500 | 120 | 1500 | 200 | 0 | 1 | 1 | Town Hall (31) ≥ 2 | L10: 19 ×1 |
| 26 Workshop | 540 | 1500 | 150 | 500 | 1500 | 0 | 1 | 1 | Forge (22) ≥ 2 | L10: 19 ×1 |
| 27 Feasting Hall | 300 | 2500 | 400 | 1200 | 700 | 0 | 1 | 1 | Inn (21) ≥ 1 | L10: 19 ×1 |
| 28 Embassy | 720 | 2000 | 200 | 500 | 300 | 0 | 1 | 1 | Town Hall (31) ≥ 2 | L10: 19 ×1 |
| 29 Rally Spot | 150 | 600 | 100 | 2000 | 150 | 0 | 1 | 1 | none | L10: 19 ×1 |
| 30 Beacon Tower | 450 | 1000 | 150 | 3000 | 300 | 0 | 1 | 1 | Barracks (2) ≥ 1 | L10: 19 ×1 |
| 31 Town Hall | 1800 | 3000 | 200 | 2500 | 200 | 0 | 1 | 1 | L1–2 none; L3..L10: Walls ≥ L−2 | L10: 19 ×1 |
| 32 Walls | 1800 | 1500 | 3000 | 10000 | 500 | 0 | 2 (L10 row: 1) | 1 | L1–2: Stonemine ≥ 2 and Workshop ≥ 1; L3..L10: Town Hall ≥ L−2 | L10: 19 ×1 |

Plus single-level pseudo rows (inside = 3, never listed; duplicates of the fort config): 14 (60, 500, 50, 100, 50, 0; Walls ≥1),
15 (120, 1200, 100, 0, 150, 0; Walls ≥2, tech 5 ≥1), 16 (180, 2000, 200, 1000, 500, 0; Walls ≥3, tech 14 ≥3),
17 (360, 6000, 300, 0, 0, 0; Walls ≥5, tech 5 ≥4), 18 (600, 0, 600, 8000, 0, 0; Walls ≥7, tech 5 ≥6).
"Level L requires X ≥ n" refers to the row for level L, i.e. used when going from L−1 to L
(`m_buildingconfig[type][L-1]`). No building has tech prereqs.

**config_research** — doubling per level holds for all rows. L1 values (time s, wood, food, stone, iron, gold), prereqs:

| tech | L1 time | wood | food | stone | iron | gold | building prereq | tech prereq |
|---|---|---|---|---|---|---|---|---|
| 1 Agriculture | 400 | 0 | 500 | 0 | 0 | 1000 | Academy ≥1, Farm ≥ L | — |
| 2 Lumbering | 500 | 500 | 0 | 0 | 100 | 1200 | Academy ≥1, Sawmill ≥ L | — |
| 3 Masonry | 600 | 0 | 0 | 500 | 200 | 1500 | Academy ≥2, Stonemine ≥ L | Lumbering ≥1 |
| 4 Mining | 700 | 0 | 0 | 0 | 800 | 2000 | Academy ≥2, Ironmine ≥ L | Masonry ≥1 |
| 5 Metal Casting | 900 | 500 | 0 | 0 | 500 | 5000 | Academy ≥3 (L1–5) / ≥1 (L6–10), Workshop ≥1 | Mining ≥2 |
| 7 Informatics | 300 | 0 | 300 | 0 | 0 | 2000 | Academy ≥3 | — |
| 8 Military Science | 900 | 100 | 600 | 100 | 150 | 2500 | Academy ≥1, Forge ≥ L | — |
| 9 Military Tradition | 1200 | 120 | 800 | 0 | 200 | 3000 | Academy ≥1 | Military Science ≥1 |
| 10 Iron Working | 1500 | 150 | 700 | 0 | 300 | 3500 | Academy ≥3 | — |
| 11 Logistics | 1600 | 0 | 500 | 200 | 0 | 3000 | Academy ≥4 | Military Science ≥2 |
| 12 Compass | 1800 | 0 | 600 | 0 | 0 | 3000 | Academy ≥4 | Military Science ≥3 |
| 13 Horseback Riding | 2000 | 0 | 1000 | 0 | 0 | 6000 | Academy ≥5, Stable ≥1 | Military Science ≥5 |
| 14 Archery | 2400 | 800 | 0 | 500 | 600 | 5000 | Academy ≥4 | Military Science ≥4 |
| 15 Stockpile | 900 | 1200 | 0 | 1000 | 800 | 2000 | Academy ≥6, Warehouse ≥ L | Lumbering ≥3 |
| 16 Medicine | 1800 | 0 | 1500 | 0 | 0 | 3600 | Academy ≥6 | Logistics ≥3 |
| 17 Construction | 1800 | 2000 | 0 | 2000 | 2000 | 5000 | Academy ≥5 | Lumbering ≥5, Metal Casting ≥2 |
| 18 Engineering | 2100 | 2500 | 0 | 3000 | 1500 | 6000 | Academy ≥8 | Construction ≥3 |
| 19 Machinery | 2400 | 600 | 0 | 700 | 800 | 5500 | Academy ≥9 | Metal Casting ≥4 |
| 20 Privateering | 3600 | 0 | 5000 | 0 | 2000 | 10000 | Academy ≥10 | Informatics ≥5, Military Science ≥8 |

(L = the level being researched. Research prereqs are only *displayed* — `tech.research` doesn't enforce them.)

**config_troops** (complete; per unit; time in seconds):

| id | type | time | pop | wood | food | stone | iron | gold | inside | building prereq | tech prereq |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Worker | 50 | 1 | 150 | 50 | 0 | 10 | 0 | 1 | Barracks ≥1 | — |
| 3 | Warrior | 25 | 1 | 100 | 80 | 0 | 50 | 0 | 1 | Barracks ≥1 | — |
| 4 | Scout | 100 | 1 | 200 | 120 | 0 | 150 | 0 | 1 | Barracks ≥2 | Informatics(7) ≥1 |
| 5 | Pikeman | 150 | 1 | 500 | 150 | 0 | 100 | 0 | 1 | Barracks ≥2 | Military Tradition(9) ≥1 |
| 6 | Swordsman | 225 | 1 | 150 | 200 | 0 | 400 | 0 | 1 | Barracks ≥3 | Iron Working(10) ≥1 |
| 7 | Archer | 350 | 2 | 350 | 300 | 0 | 300 | 0 | 1 | Barracks ≥4 | Archery(14) ≥1 |
| 8 | Transporter | 1000 | 3 | 1500 | 600 | 0 | 350 | 0 | 1 | Barracks ≥6 | Logistics(11) ≥1, Metal Casting(5) ≥3 |
| 9 | Cavalry | 500 | 6 | 600 | 1000 | 0 | 500 | 0 | 1 | Barracks ≥5 | Horseback Riding(13) ≥1 |
| 10 | Cataphract | 1500 | 4 | 500 | 2000 | 0 | 2500 | 0 | 1 | Barracks ≥7 | Iron Working ≥5, Horseback Riding ≥5 |
| 11 | Ballista | 3000 | 5 | 3000 | 2500 | 0 | 1800 | 0 | 1 | Barracks ≥9 | Metal Casting ≥5, Archery ≥6 |
| 12 | Battering Ram | 4500 | 10 | 6000 | 4000 | 0 | 1500 | 0 | 1 | Barracks ≥9 | Iron Working ≥8, Metal Casting ≥7 |
| 13 | Catapult | 6000 | 8 | 5000 | 5000 | 8000 | 1200 | 0 | 1 | Barracks ≥10 | Metal Casting ≥10, Archery ≥10 |
| 14 | Trap | 60 | 1 | 500 | 50 | 100 | 50 | 0 | 2 | Walls ≥1 | — |
| 15 | Abatis | 120 | 2 | 1200 | 100 | 0 | 150 | 0 | 2 | Walls ≥2 | Metal Casting ≥1 |
| 16 | Archer Tower | 180 | 0 | 2000 | 200 | 1000 | 500 | 0 | 2 | Walls ≥3 | Archery ≥3 |
| 17 | Rolling Log | 360 | 5 | 6000 | 300 | 0 | 0 | 0 | 2 | Walls ≥5 | Metal Casting ≥4 |
| 18 | Trebuchet (rockfall) | 600 | 4 | 0 | 600 | 8000 | 0 | 0 | 2 | Walls ≥7 | Metal Casting ≥6 |

(The table also carries combat stats life/attack/defense/load/movecost/speed/range — out of scope here.)

---

## 15. Consolidated bug / TODO list (decide: replicate or fix)

Validation gaps / exploits
1. `troop.produceTroop`, `fortifications.produceWallProtect`: no `num > 0` check (negative num creates resources), no type
   range check, no prerequisite check, no barracks-position ownership check; resources/population consumed before the
   queue-capacity check and never refunded on failure.
2. `tech.research`: no prerequisite check; `techId > 25` should be `>= 25`; same tech can be started in two cities.
3. `castle.newBuilding`: outer-slot "Out of bounds" check is applied to inner slots (never fires); no inside/outside
   placement check; pseudo-types 14–18 buildable; item prereqs not consumed.
4. `castle.upgradeBuilding`: no max-level (10) check → out-of-bounds config read.
5. `troop.disbandTroop` / `fortifications.destructWallProtect`: refund = one unit's full cost regardless of `num`; worker
   check uses `forts.traps`; disband response has no `ok`/`packageId`; no castle checks on disband.
6. `m_availablepopulation` is unsigned and goes huge when workers > population, bypassing the population check.

Wrong / missing effects
7. `castle.cancleBuildCommand`: never refunds (status cleared before the refund test); searches the global event list by
   position only (cross-player); the command response is never sent (only the BuildComplate push).
8. `calculatecoinsforspeedup`: `=` instead of `+=` on the 15-minute tier (non-monotonic prices).
9. `coins.speed` charges for the total duration, not the remaining time.
10. Speed-ups send success before payment validation; `-99 "Not enough cents."` can follow a success.
11. `fortifications.accTroopProduce`: reads count of an empty item id → item never consumed, always 35 cents.
12. `accTroopProduce` (both): −30% computed from enqueue time, not start time.
13. Troop queue head with `endtime == 0` would complete instantly; troop cancel doesn't refund population.
14. Demolishing a Barracks to level 0 leaves its troop queue alive.
15. `fortifications.getProduceQueue`: every entry aliases the same object (all show last batch).
16. `CalculateResources`: troop food upkeep subtracted as a flat amount per call; `resourcemanagement` always 0 (hero
    management/techs/valleys don't boost production).
17. `interior.pacifyPeople` / `taxation`: cooldown consumed even on failure; invalid typeId still "succeeds"; Free blessing
    replies with an error-shaped message and no success response. Cooldowns are not persisted.
18. `city.advMoveCastle`: placeholder — always errors and then still consumes the item and "succeeds" without moving.
19. `city.moveCastle`: old tile's owner/city refs not cleared, new tile owner not set; invalid zone consumes the item;
    `GetRandomOpenTile` −1 not handled; not persisted.
20. `city.setStopWarState`: cents path doesn't set truce status; validation of `ItemId` after consumption; unknown item → crash.
21. `city.modifyUserName`: name not persisted; no validation anywhere for names/flags/logos.
22. `castle.saveCastleSignList`/`deleteCastleSignList`: errors built but never sent; sign entries saved without tile id /
    castle id / name; delete compares tile id against castle id.
23. Building list commands: tech prereqs pushed into `buildings`; `techs` empty; Outside list `successFlag` always true;
    item `curNum` reads `itemlist[configItemId]` (index into the player's item vector — undefined); `time` units
    differ (Bean/Outside ms, Inside seconds); Inside list forces `gold: 0`.
24. `tech.getResearchList`: prerequisites shown from level-1 row; level-10 techs read out of bounds; `avalevel` omitted when
    no academy in the "just finished" branch.
25. `castle.checkOutUpgrade`: level ≥ 10 reads destructtime out of bounds; `destructTime` not floored and uses next level.
26. `castle.speedUpBuildCommand` with `player.destroy.1.a` on an upgrading building sets level 1 and completes it.
27. Building timer: events with status 0 never removed.
28. Missing pushes: research speed-up, troop/fort queue changes.
29. `EnemyArmysUpdate` / `FriendArmysUpdate` pushes never include the army list.
30. Null-pointer crashes in original for: missing barracks/walls queue, `GetCity` null, unknown item in setStopWarState —
    the new backend should return `-99` errors instead.

TODOs present in source: hammer (second build queue) item support; real error texts for 5-minute free speed-up and
"not enough cents"; name/flag validation; tax/commence rate error reporting; `pacifyPeople`/`taxation` "finish";
advMoveCastle cooldown + real teleport; verifying research with multiple academies.
