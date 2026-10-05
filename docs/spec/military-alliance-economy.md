# Spec: Military, Heroes, Alliances, Shop and Market

Source: `evony-private-server/src` (C++). Files covered completely:
`packets/palliance.cpp`, `packets/parmy.cpp`, `packets/phero.cpp`, `packets/pfield.cpp`, `packets/pshop.cpp`, `packets/ptrade.cpp` (and their `.h`), `Alliance.cpp/.h`, `AllianceMgr.cpp/.h`, `Hero.cpp/.h`, `Market.cpp/.h`.
Supporting code consulted: `spitfire.cpp` (CalcTroopSpeed, CreateRandomHero, RandomStat, AddTimedEvent, army timer processing, item/alliance/army/hero loading and saving), `structs.h`, `defines.h`, `Client.cpp/.h`, `PlayerCity.cpp`, `Map.cpp` (GetMapCastle), `Tile.cpp`, `request_handler.cpp`, `packets/packet.cpp`, `packets/punknown.cpp`, DB dumps in `DB/`.

This document describes **what the C++ actually does** (including its bugs), so that behaviour can be reproduced. Where the C++ is clearly broken, a **Bug** / **Note** callout says so and, where it is obvious, what the intended behaviour was. The implementer must decide per-bug whether to replicate or fix; the recommended default is "fix", because most bugs are crashes or duplication exploits.

---

## 0. Conventions

### 0.1 Envelope

Every client request is an AMF3 object `{ cmd: "<type>.<command>", data: {...} }`. Every response is `{ cmd: "<type>.<command>", data: {...} }`. In the new backend, `cmd` maps to a REST route or a WebSocket message type; `data` is the JSON body.

Dispatch (`request_handler.cpp`): `cmd` is split on `.`; first token selects the handler (`alliance`, `army`, `hero`, `field`, `shop`, `trade`, ...). Every handler here except `login`/`gameClient` first runs `check()`: if the connection has no logged-in client the request is silently dropped.

- An **unknown command within a known type** (e.g. `alliance.getAllianceList`) gets **no response at all**: the handler's `if` chain just falls through.
- An **unknown type** (e.g. `stratagem.useStratagem`) goes to `punknown`, which sends:
  `server.SystemInfoMsg { alliance:false, tV:false, noSenderSystemInfo:false, msg:"Unknown object - <full cmd>" }`.

### 0.2 Standard success / error shape

Success responses almost always contain `data.ok = 1` and `data.packageId = 0.0` (a double). Fields are listed per command.

Errors are built by `CreateError(cmd, code, message)`:

```
{ cmd: <cmd>, data: { errorMsg: <string>, packageId: 0.0, ok: <negative int code> } }
```

The client shows `errorMsg`; the `ok` code is mostly `-99` (generic). Other codes seen: `-12` (name taken), `-13`, `-24`, `-28`, `-29`, `-41` (player does not exist), `-42` (not entitled), `-51`, `-61`, `-69`, `-70`, `-71`, `-80`, `-88`. A commented note mentions `-301` "Can not join the same Alliance again in 23 hours." (not implemented) and `-132` for date-limited items (not implemented).

### 0.3 castleId checks

Two helpers are invoked at the top of many handlers:

- `VERIFYCASTLEID()`: if `data` is not an object or has no `castleId` key, the request is **silently dropped** (exception swallowed, no response).
- `CHECKCASTLEID()`: if `data.castleId` exists and `!= client.currentcityid` (the client's focused city), the request is **silently dropped**.

"Requires castleId" below means both checks run. "Current city" (`city`) always means the client's focused city (`client.citylist[client.currentcityindex]`), not the city named by castleId (they are equal after the checks).

### 0.4 Time and ids

- `Utils::time()` = Unix epoch **milliseconds**. All `*time` fields are ms unless noted.
- `armyid` comes from an in-memory counter `armycounter` starting at 0 each boot (armies loaded from DB are renumbered).
- Hero ids come from `m_heroid`, initialised to 1000 and bumped to `max(loaded hero id)+1`.
- Alliance ids come from `m_allianceid`, initialised to 100 and bumped to `max(loaded alliance id)+1`.
- Timed events get `te.id = tecounter++` in `AddTimedEvent`.

### 0.5 Player "no alliance" sentinel (important inconsistency)

`client.allianceid` is `-1` for a fresh account, `-1` after `alliance.sayByetoAlliance`, but `0` after `AllianceMgr::RemoveFromAlliance` (kick / resign). `HasAlliance()` is `allianceid > 0`. Several checks use `< 0` or `== 0` instead and therefore misbehave (noted per command). **Recommendation:** use `NULL` / no-membership row; treat "no alliance" uniformly.

### 0.6 Common server push messages used in this domain

| cmd | data | emitted by |
|---|---|---|
| `server.SystemInfoMsg` | `{ alliance: bool, tV: bool, noSenderSystemInfo: bool, msg: string }` (+ `sender: "Alliance Msg"` when sent via alliance) | `SendMessage` (one player), `MassMessage` (all players in memory), `Alliance::SendAllianceMessage` (all members) |
| `server.PlayerInfoUpdate` | `{ playerInfo: PlayerInfo }` (see 0.7) | `Client::PlayerInfoUpdate` |
| `server.ResourceUpdate` | `{ castleId, resource: <city resource object> }` | `PlayerCity::ResourceUpdate` |
| `server.TroopUpdate` | `{ caslteId (sic, misspelled), troop: TroopsObject }` | `PlayerCity::TroopUpdate` |
| `server.HeroUpdate` | `{ castleId, hero: HeroObject, updateType: 0=hired/added, 1=fired/removed, 2=updated }` | `PlayerCity::HeroUpdate` |
| `server.ItemUpdate` | `{ items: [ { id, count, minCount, maxCount } ] }` (only the one changed item) | `Client::ItemUpdate`, called by every `AddItem` |
| `server.SelfArmysUpdate` | `{ armys: [ArmyObject...] }` (all of the player's own armies) | `Client::SelfArmyUpdate` |
| `server.EnemyArmysUpdate` | `{}` — **Bug:** array is built but never assigned; payload is empty. Intended `{ armys: [...] }` of incoming hostile armies | `Client::EnemyArmyUpdate` |
| `server.FriendArmysUpdate` | `{}` — same bug; intended `{ armys: [...] }` | `Client::FriendArmyUpdate` |
| `server.CastleUpdate` | `{ updateType: 2, castleBean: CastleObject }` | `PlayerCity::CastleUpdate` |
| `server.InjuredTroopUpdate` | `{ castleId, troop: TroopsObject }` | `army.getInjuredTroop` |

Push helpers do nothing if the target client is not connected.

### 0.7 PlayerInfo object (as sent in `server.PlayerInfoUpdate`)

```
{ alliance: "" (only if allianceid>0; Bug: name intentionally blanked),
  allianceLevel: 0 (only if allianceid>0; Bug: rank name blanked),
  levelId: alliancerank (only if allianceid>0),
  createrTime, office, sex, honor, bdenyotherplayer, id: accountid, accountName: email,
  prestige, faceUrl, flag, userId: masteraccountid, userName: playername,
  castleCount, medal: cents, ranking: prestigerank, titleId: title, lastLoginTime,
  population: sum of all cities' population }
```

### 0.8 Troops object (wire format)

Wire keys and their internal names; used in requests (`newArmyBean.troops`) and responses:

| wire key | internal | troop type id (reports) | speed group | base speed |
|---|---|---|---|---|
| `peasants` | worker | 2 | foot | 180 |
| `militia` | warrior | 3 | foot | 200 |
| `scouter` | scout | 4 | foot | 3000 |
| `pikemen` | pike | 5 | foot | 300 |
| `swordsmen` | sword | 6 | foot | 275 |
| `archer` | archer | 7 | foot | 250 |
| `carriage` | transporter | 8 | mech | 150 |
| `lightCavalry` | cavalry | 9 | mech | 1000 |
| `heavyCavalry` | cataphract | 10 | mech | 750 |
| `ballista` | ballista | 11 | mech | 100 |
| `batteringRam` | ram | 12 | mech | 120 |
| `catapult` | catapult | 13 | mech | 80 |

Internal storage order (used for DB strings and report type ids = index+2): worker, warrior, scout, pike, sword, archer, transporter, cavalry, cataphract, ballista, ram, catapult.

### 0.9 Resources object

`{ gold, food, wood, stone, iron }` (doubles). Request order for the C++ constructor is (gold, food, wood, stone, iron).

---

## 1. Constants

### 1.1 Alliance ranks (`client.alliancerank`, `stMember.rank`) — lower number = more power

| value | name (`AllianceMgr::GetAllianceRank`) |
|---|---|
| 0 | (no alliance) — `GetAllianceRank` returns `"No Rank"` for anything not listed |
| 4 | `Host` (DEF_ALLIANCEHOST) |
| 5 | `Vice Host` |
| 6 | `Presbyter` |
| 7 | `Officer` |
| 8 | `Member` (default on join) |

### 1.2 Alliance relations (`AllianceMgr::GetRelation`, also used by map/army)

| value | meaning |
|---|---|
| 0 | DEF_ALLIANCE — same alliance |
| 1 | DEF_ALLY |
| 2 | DEF_NEUTRAL |
| 3 | DEF_ENEMY |
| 4 | DEF_NORELATION |
| 5 | DEF_SELFRELATION — same player |

`alliance.setAllianceFriendship` uses a different encoding for `type`: 1 = friendly/ally, 2 = neutral, 3 (anything else) = enemy.

### 1.3 Hero status (`Hero.m_status`)

| value | meaning |
|---|---|
| 0 | idle (DEF_HEROIDLE) |
| 1 | mayor / castellan (DEF_HEROMAYOR) |
| 2 | (reinforce — not defined in C++) |
| 3 | marching / attacking (DEF_HEROATTACK) — set for every outgoing army with a hero |
| 4 | seized/captured (DEF_HEROSEIZED) |
| 5 | returning (DEF_HERORETURN) |

### 1.4 Mission types (`missionType`)

1 = transport, 2 = reinforce, 3 = scout, 4 = build city, 5 = attack.

### 1.5 Army direction

1 = forward (outgoing), 2 = backward (returning), 3 = stay (camped/reinforcing).

### 1.6 Tile types

1 forest, 2 desert, 3 hill, 4 swamp, 5 grass, 6 lake, 10 flat, 11 castle (player city), 12 NPC city. Types < 11 are "valleys/fields". `Tile::GetName()`: Forest, Desert, Hill, Swamp, Grass, Lake, Flat, castle → city name (or `"Invalid City"`), NPC → `"Barbarian's City"`, else `"null"`.

### 1.7 Building / research ids used here

Buildings: 21 Inn, 23 Marketplace, 24 Relief Station, 25 Academy, 27 Feasting Hall, 28 Embassy, 29 Rally Spot, 31 Town Hall. `GetBuildingLevel(id)` = max level among all buildings of that type in the city (0 if none).
Research: 11 Logistics, 12 Compass, 13 Horseback Riding (+ others used by combat: 9 Military Tradition, 10 Iron Working, 14 Archery, 16 Medicine, 19 Machinery).

### 1.8 Beginner protection

`client.beginner` flag. Cleared (with a `PlayerInfoUpdate`) when 7 days have passed since account creation or any city's Town Hall reaches level 5 (`CheckBeginner`).

---

## 2. Models

### 2.1 Hero

Fields (C++ name → meaning):

| field | type | notes |
|---|---|---|
| `m_id` | uint64 | 0 for tavern (inn) heroes until hired |
| `m_ownerid` | uint64 | account id |
| `m_castleid` | uint64 | city id |
| `m_name` | string | |
| `m_logourl` | string | DB column is `logurl` |
| `m_level` | uint32 | |
| `m_experience` | double | |
| `m_upgradeexp` | double | exp required for next level |
| `m_loyalty` | uint8 | 0..100 |
| `m_status` | int8 | see 1.3 |
| `m_basepower`, `m_basemanagement`, `m_basestratagem` | uint32 | innate base stats |
| `m_power`, `m_management`, `m_stratagem` | uint32 | base + allocated points |
| `m_poweradded`, `m_managementadded`, `m_stratagemadded` | uint32 | equipment/other bonus (never changed in this code) |
| `m_powerbuffadded`, ... | uint32 | buff bonus (only zeroed on capture) |
| `m_remainpoint` | uint32 | unallocated attribute points |
| `m_itemid`, `m_itemamount` | uint32 | unknown purpose (persisted only) |
| `movement` | pointer | the army the hero is leading |

Derived stats: `GetPower() = power + poweradded + powerbuffadded`; same for management and stratagem (results truncated to int16).

Invariant (enforced by `hero.addPoint`): `power + management + stratagem + remainpoint == basepower + basemanagement + basestratagem + level` (ignoring the CreateRandomHero bug in 2.1.2).

**HeroObject** (`Hero::ToObject`), exact keys:

```
{ experience, id, itemAmount, level, logoUrl, loyalty,
  management, managementAdded, managementBuffAdded,
  name, power, powerAdded, powerBuffAdded, remainPoint, status,
  stratagem, stratagemAdded, stratagemBuffAdded, upgradeExp }
```
(`itemId` is commented out; base stats are not sent.)

#### 2.1.1 Hero slots

Each city has `m_heroes[10]` (hired heroes) and `m_innheroes[10]` (tavern offers, **in-memory only, never persisted**), and `m_mayor` (pointer to one of `m_heroes`). Hired heroes allowed = Feasting Hall level (`hero.hireHero` refuses when `FeastingHallLevel <= HeroCount`). Tavern offers shown = Inn level (max 10). When an Inn upgrade completes, all 10 inn slots are cleared (regenerated lazily on next `getHerosListFromTavern`).

On load, if two heroes have status 1 (mayor) in one city, the extra ones are reset to idle; the first one found becomes `m_mayor`. Loyalty loaded > 100 is clamped to 100.

#### 2.1.2 Random hero generation (`CreateRandomHero(innLevel)`)

```
maxherolevel = innLevel * 5
level = rand(0..maxherolevel-1) + 1                     // 1..5*innLevel
basemanagement = RandomStat(); basestratagem = RandomStat(); basepower = RandomStat()
remain = level
power = rand(0..remain-1);       remain -= power;      power += basepower
if remain > 0: management = rand(0..remain-1); remain -= management; management += basemanagement
if remain > 0: stratagem = remain; remain = 0;          stratagem += basestratagem
loyalty = 70; experience = 0; upgradeexp = level*level*100; id = 0; remainpoint = 0
name = "Test Name" + power + management + stratagem   (decimal concatenation, e.g. "Test Name453160")
logourl = "images/icon/player/faceA20.jpg"
```
Note `rand(0..n-1)` means C `rand() % n`.

**Bugs:**
- If `power + management` already used all `level` points, `stratagem` stays **0** (base stratagem is never added). Should be `stratagem = basestratagem`. Same latent issue for management (cannot actually happen because power < level).
- Names are placeholders and may collide; `hireHero` matches heroes by name.

`RandomStat()` distribution (r = rand()%10000):

| r range | probability | value |
|---|---|---|
| 0–6499 | 65% | 15 + rand()%21 (15–35) |
| 6500–8499 | 20% | 30 + rand()%21 (30–50) |
| 8500–9499 | 10% | 45 + rand()%16 (45–60) |
| 9500–9899 | 4% | 60 + rand()%11 (60–70) |
| 9900–9949 | 0.5% | 70 + rand()%6 (70–75) |
| 9950–9974 | 0.25% | 75 + rand()%5 (75–79) |
| 9975–9999 | 0.25% | 10 |

#### 2.1.3 Hero economy formulas

- **Hire cost**: `level * 1000` gold (from current city).
- **Salary**: each hired hero costs `level * 20` gold per hour; subtracted from city gold production (`PlayerCity::CalculateResources`, reported as `herosSalary` in the resource object).
- **Experience to level**: `upgradeexp = level² × 100` (exp required to go from `level` to `level+1`). Level up is manual (`hero.levelUp`), consumes `upgradeexp` experience, grants +1 `remainpoint`.
- **Experience sources** (outside these files): when troops/fortifications finish training, buildings finish, or research finishes, the city's **mayor** gains experience equal to the prestige gained (`city.m_mayor.m_experience += gain`, with a `server.HeroUpdate` type 2). Items `player.experience.1.*` (see `hero.useItem`).
- **Mayor effects** (outside these files): troop training time × `0.995^power(mayor)`; fortification build time × `0.995^management(mayor)` (uses `GetPower()`/`GetManagement()` totals).
- **Loyalty**: starts at 70 for tavern heroes. +5 per `hero.awardGold` (cost `level*100` gold), +5..+60 per medal item, capped at 100. −5 (min 0) when the hero's scouting army is wiped out. Capture chance in that case: hero is captured if `rand()%100 > loyalty` and the defender city has a free Feasting Hall slot.

#### 2.1.4 Persistence (`heroes` table)

Columns: `id, ownerid, castleid, name, status, itemid, itemamount, basestratagem, stratagem, stratagemadded, stratagembuffadded, basepower, power, poweradded, powerbuffadded, basemanagement, management, managementadded, managementbuffadded, logurl, remainpoint, level, upgradeexp, experience, loyalty, troop (always written as ""), hbuffs, troops`. `InsertToDB` on hire, `SaveToDB` (UPDATE by id) on change, `DeleteFromDB` on fire.

### 2.2 Alliance

Fields:

| field | type | notes |
|---|---|---|
| `m_allianceid` | int64 | |
| `m_name` | string | unique, case-sensitive exact match lookups |
| `m_founder` | string | creator player name |
| `m_owner`, `m_ownerid` | string, int64 | current Host name/account |
| `m_note` | string | alliance note (set via setAllInfoForAlliance) |
| `m_intro` | string | alliance info/introduction |
| `m_motd` | string | never set by any command |
| `m_members` | list of `{ clientid: uint64, rank: int8 }` | |
| `m_currentmembers` | int16 | count kept in sync with `m_members` by Add/RemoveMember |
| `m_maxmembers` | int16 | constant **500** |
| `m_allies`, `m_neutral`, `m_enemies` | list<int64> | other alliance ids; **relations are per-alliance (one-sided)** except war (see below) |
| `m_invites` | list of `{ client: Client*, inviteperson: string, invitetime: double }` | in-memory only. `inviteperson == ""` ⇒ **application** by the player; non-empty ⇒ **invitation** sent by that alliance officer |
| `enemyactioncooldown` | uint64 ms | in-memory only, 0 initially |
| `m_prestige`, `m_honor` | int64 | sums of members' prestige/honor (recomputed by SortAlliances) |
| `m_prestigerank`, `m_honorrank`, `m_membersrank` | int16 | 1-based rank among all alliances |
| `m_allicitycount` | int32 | sum of members' city counts |
| `m_alliancereports`, `m_allianceevents` | vectors | unused |

`AllianceMgr` holds up to `DEF_MAXALLIANCES = 1000` alliances in a fixed array; `CreateAlliance` returns null when full.

**indexAllianceInfoBean** (used by `alliance.isHasAlliance`):
```
{ prestige: m_prestige, rank: m_prestigerank, creatorName: m_founder, allianceNote: m_note,
  allianceInfo: m_intro, allianceName: m_name, memberCount: m_currentmembers,
  memberLimit: m_maxmembers, leaderName: m_owner }
```

**Relation summary object** (used in `isHasAlliance` / `getAllianceFriendshipList` lists):
```
{ rank: m_prestigerank, honor: m_honor, allianceName: m_name, memberCount: m_currentmembers, aPrestigeCount: m_prestige }
```

`Alliance::ToObject()` returns an empty object (unused).

#### 2.2.1 Membership operations

- `AddMember(clientid, rank)`: if already a member → return true (no-op). If `m_currentmembers >= m_maxmembers` (500) → false. Else append and increment count.
- `RemoveMember(clientid)`: remove first match, decrement count; always returns true.
- `HasMember(name)`: looks up the client by exact player name among all loaded players, then `HasMember(accountid)`.
- `RequestJoin(client, ts)`: append `{client, inviteperson:"", invitetime: ts}` (no duplicate check).
- `UnRequestJoin(client | name)`: remove **all** invite entries (applications and invitations) whose `client.playername` equals the given name.
- `AllianceMgr::JoinAlliance(allianceid, client)`: fails if `client.allianceid > 0` or alliance not found or `AddMember(..., 8)` fails. On success: `client.allianceid = id; alliancename = name; alliancerank = 8;` push `server.PlayerInfoUpdate`.
- `AllianceMgr::RemoveFromAlliance(allianceid, client)`: fails if `client.allianceid <= 0` or alliance not found. Removes member; sets `client.allianceid = 0` (note: 0, not -1), `alliancename = ""`, `alliancerank = 0`; pushes `PlayerInfoUpdate`. Does **not** delete empty alliances.
- `AllianceMgr::SetRank(allianceid, client, rank)`: fails if `client.allianceid <= 0`, alliance not found, or client not in member list. Sets both `client.alliancerank` and `member.rank`. Does **not** update `m_owner`.
- `AllianceMgr::CheckAlliance(any)`: scans **all** alliances and deletes every one with zero members.
- `AllianceMgr::DeleteAlliance(a)`: for every other alliance remove `a.id` from its allies/neutral/enemies; for every loaded player with `allianceapply == a.name`, clear `allianceapply`/`allianceapplytime`; clear `a.m_invites`; `DELETE FROM alliances WHERE id`; free the slot; `SortAlliances()`. Does **not** reset remaining members' `allianceid`.
- `AllianceMgr::CheckName(name)`: lower-cases name; rejects if it contains any of: `penis, cock, dick, asshole, fuck, shit, bitch, tits, cunt, testicle, queer, fag, gay, homo, whore, nigger` (substring match).

#### 2.2.2 Diplomacy

- `Ally(id)`: no-op if already ally; remove from neutral/enemy; push to `m_allies`. Sends to the **target** alliance's members: `"Alliance [<TARGET name>] recognizes Diplomatic Relationship with us as Ally."` (tv=false, nosender=false). **Bug:** uses the target's own name; intended the acting alliance's name. One-sided: the target's lists are not changed.
- `Neutral(id)`: same pattern with `m_neutral`, message `"... as Neutral."` (same name bug).
- `Enemy(id, skip=false)`: no-op if already enemy. Sets `enemyactioncooldown = now + 24h` (on this alliance), removes from neutral/ally, pushes to `m_enemies`. If not `skip`: `MassMessage("Alliance <this> declares war against alliance <target>. Diplomatic Relationship between each other alters to Hostile automatically.")` to **all players**, then `target.Enemy(this.id, skip=true)` (target also becomes enemy and also gets a 24h cooldown), then sends to target members `"Alliance [<this name>] recognizes Diplomatic Relationship with us as Enemy."`. So war is mutual, friendship/neutral are one-sided.
- `IsAlly/IsNeutral/IsEnemy(id)`: false for id <= 0.

#### 2.2.3 GetRelation(accountA, accountB)

```
if A == B: return 5 (self)
cA, cB = loaded clients; if either missing or either allianceid < 0: return 4 (no relation)
if cA.allianceid == cB.allianceid: return 0 (same alliance)
if either allianceid <= 0: return 4
alliances aA, aB; if either missing: return 4
if aA.IsEnemy(cB.allianceid): 3
elif aA.IsAlly(cB.allianceid): 1
elif aA.IsNeutral(cB.allianceid): 2
else 4
```
**Bug:** two alliance-less players whose `allianceid` is 0 (both were kicked/resigned) are reported as **same alliance (0)** and therefore cannot attack each other. Relation is computed from A's point of view only.

`spitfire::GetRelation` (a different function) is a stub returning 0 and is unused here. `Map::GetMapCastle` hard-codes relation 0 (see `field.getOtherFieldInfo`).

#### 2.2.4 Ranking (`SortAlliances`) — runs every 5 s in the timer thread and after create/delete

For each alliance: `members = m_members.size()`, `prestige = Σ member.prestige`, `honor = Σ member.honor`, `m_allicitycount = Σ member city count` (only members whose client is loaded). Three lists sorted descending by members (prestige as secondary via stable sort), prestige, honor. Assign 1-based `m_membersrank`, `m_prestigerank`, `m_honorrank`, and write back `m_prestige`, `m_honor`.

#### 2.2.5 Persistence (`alliances` table)

Columns: `id, name, founder, leader, note, intro, motd, allies, neutrals, enemies, members, created`.
Encoding: relation lists `"id|id|"`; members `"accountid,rank|accountid,rank|"`.

**Bugs:**
- `SaveToDB` builds the strings with a single cumulative format buffer, so `neutrals` contains allies+neutrals, `enemies` contains allies+neutrals+enemies, and `members` is prefixed with all relation ids (those single-number tokens are skipped on load because they have no comma). After a reload, allies also appear as neutral and enemy. Write each list independently.
- `alliance.createAlliance` calls `CreateAlliance(name, founder)` with `savetodb=false`, so the row is **never INSERTed**; subsequent `SaveToDB` is an UPDATE that matches no row. **Alliances created at runtime are lost on restart.**
- On load only `name, founder, note, members, enemies, allies, neutrals` are read: `intro` and `motd` are not loaded. Owner is the first member with rank 4.
- Load-time "validation" compares `GetAlliance() == (Alliance*)-1`, which never matches (lookup returns null), so orphaned `allianceid`s are never cleaned.

#### 2.2.6 Pervasive null-check bug

`AllianceById`/`AllianceByName` return **null** when not found, but `palliance.cpp` compares against `(Alliance*)-1` everywhere except `agreeComeinAllianceByUser`. So every "Alliance does not exist." / "Alliance no longer exists." / "Invalid Alliance." branch is dead code and the following line dereferences null (server crash). The intended behaviour is the error response; implement that.

### 2.3 Army movement (`stArmyMovement`)

Fields: `hero` (pointer, may be null), `heroname`, `herolevel`, `direction`, `resources`, `startposname` (source city name), `king` (owner player name), `troops`, `starttime`, `armyid`, `reachtime`, `resttime`, `missiontype`, `startfieldid`, `targetfieldid`, `targetposname`, `city` (source city), `client` (owner).

**ArmyObject** (`ToObject`), exact keys:
```
{ hero: heroname, direction, resource: ResourcesObject, startPosName, king, troop: TroopsObject,
  startTime (double), armyId, reachTime (double), heroLevel, restTime (double), missionType,
  startFieldId, targetFieldId, targetPosName }
```

A player has three lists: `armymovement` (own), `friendarmymovement` (allied armies camped at the player's tiles), `enemyarmymovement` (hostile armies heading to the player). Global `armylist` holds the timed events.

Persistence (`armies` table, rewritten wholesale on save: TRUNCATE + INSERT each): `heroid` (−1 if none), `direction`, `resource` = `"food,wood,stone,iron,gold"` (int64), `troops` = 12 comma-separated counts in internal order (0.8), `starttime, reachtime, resttime, missiontype, startfieldid, targetfieldid, cityid, clientid`. On load, heroname/level are re-read from the hero; armies targeting a tile owned by an ally/alliance-mate are added to that owner's `friendarmymovement`. **Bug:** loaded armies are pushed into `armylist` directly without `AddTimedEvent`, so their event `id` is 0; `armylist.remove(event)` compares by id, so the first loaded army that finishes removes **all** loaded armies from the timer list.

### 2.4 Market (order book)

Data structures (all in memory; nothing persisted — `Market::init()` is empty, `PlayerCity::DBTrades()` returns "").

`stMarketEntry { amount: double, price: double, client, city, time: uint64 ms, tradeid: uint64 }`

`stTrade { amount, price, id: int64, tradetype: 0=buy/1=sell, tradeTypeName: "Bid"|"Offer", dealedtotal: double, resourcename: string, restype: int8, client, city, entry }` — appended to `city.m_trades` for the order owner.

Market holds three sets of 8 lists (food/wood/stone/iron × buy/sell):
- `queue_` — newly added orders.
- `live` — the real book; queue entries are moved here (push_front) on cache recalculation. Never purged.
- `cache` — aggregated top-of-book price levels returned to clients, plus `buytime`/`selltime`.

**Adding orders** (`addFoodBuy/addFoodSell`): set `entry.time = now`; fail (false, logged) if client or city null; `tradeid = ++tradeid`; create `stTrade { amount, price, id, tradetype (0 buy/1 sell), "Bid"/"Offer", dealedtotal 0, "Food", restype 1, client, city }`; append entry to `queue_.foodbuy/foodsell`; append trade to `city.m_trades`.
**Bug / unimplemented:** `addWood*`, `addStone*`, `addIron*` only stamp the time and return true — **those orders are discarded**. Note restype in stTrade is 1 for food while the request uses 0 for food.

**Reading** (`getXBuy/getXSell`): if `now > cache.buytime (or selltime) + 5000 ms`, call `recalculateCache()`; return the cache list.

**recalculateCache()**:
1. Clear all cache lists.
2. Move all `queue_` entries into `live` (push_front), clear `queue_`.
3. Sort buy lists with `compareprice` (intended: price descending) and sell lists with `rcompareprice` (intended: price ascending). **Bug:** comparators return true only when price is strictly better **and** time strictly earlier/later — not a strict weak ordering; ordering is effectively unreliable. Intended: buys by price desc then time asc; sells by price asc then time asc.
4. For each live entry in order, aggregate into price levels: if a cache level with equal price exists, add amount; else append a new level `{amount, price}`; stop once more than 5 new levels have been added (so up to 6 levels).
   **Bugs:** the `test` ("merged") flag is set when merging and never reset, so after the first merge no new price levels are created for the rest of that list; it is not reset between the wood/stone/iron lists either. Wood-buy and stone-buy new levels are pushed into `cache.foodbuy` (copy/paste error).
5. `cache.buytime = cache.selltime = now`.

**Matching** (`Process()`): exists but its only call site is commented out (`//market.Process();` in the 5-second timer), so **no trade ever executes**. Its algorithm (food only):
```
for sell in live.foodsell:
  for buy in live.foodbuy:
    if buy.price >= sell.price:
      if buy.amount >= sell.amount:
         buy.amount -= sell.amount
         sell.city.gold += sell.amount * sell.price ; sell.city.ResourceUpdate()
         sell.amount = 0
         remove the seller's stTrade with id == sell.tradeid from sell.city.m_trades
         (buyer never receives the resource — TODO in code)
      else:
         sell.amount -= buy.amount ; buy.amount = 0   (no payment/delivery at all)
```
Executes at the **seller's** price; does not stop once a sell is filled; never removes empty entries; no fees, no transport time (`stTransingTrade` / `server.TransingTradeUpdate` exist only as unused structs and a commented test), no escrow (see `trade.newTrade`).

**Recommended reimplementation (intended semantics):** Postgres table of orders `(id, account, city, resType, side, price, amount, remaining, createdAt)`; on new order, escrow (buy: `amount*price` gold; sell: `amount` resource); match against the opposite side with price-time priority; settle at the resting order's price; deliver goods via a transit record (`server.TransingTradeUpdate`) and push `server.TradesUpdate`. No fee is implemented in C++ (the original game had a marketplace fee affected by the Merchant Fleet item `consume.transaction.1`; values not present in this source).

`server.TradesUpdate` payload (helper exists, never called): `{ castleId, tradeBean: { amount, id, tradeType, price, tradeTypeName, dealedTotal, resourceName, resType }, updateType }`.

### 2.5 Item config & gamble buckets

`config_items` rows (id, name, cost (cents), description, buyable, cangamble, itemtype, daylimit, rarity) are loaded into `m_items[id]` (max 400). Items with `cangamble=1` are placed into gamble buckets by `rarity`:

| rarity | bucket | `kind` sent to client |
|---|---|---|
| 5 or any unlisted value (e.g. 0) | common | rarity−1 (4; −1 for rarity 0) |
| 4 | special | 3 |
| 3 | rare | 2 |
| 2 | superrare | 1 |
| 1 | ultrarare | rarity (=1) — **note:** uses `rarity`, not `rarity-1` |

(The comment in GenerateGamble claims 5 = ultra rare, 1 = common — the opposite of the loader; the loader mapping above is authoritative.)

Gamble-eligible items in the shipped dump (`DB/evony (3).sql`), name — cost — rarity:
- rarity 5 (common): consume.1.a 3, consume.1.b 27, consume.2.a 5, consume.2.b 10, consume.move.1 30, consume.refreshtavern.1 5, consume.transaction.1 5, hero.loyalty.1–7 0, hero.reset.1 20, player.attackinc.1 10, player.box.gambling.food/gold/iron/stone/wood 0, player.box.hero.a 0, player.box.troop.a/b 0, player.defendinc.1 10, player.experience.1.a 8, player.resinc.1/2/3/4 8.
- rarity 4 (special): consume.2.b.1 20, consume.2.c 50, consume.changeflag.1 6, player.box.gambling.medal.10 0, player.box.hero.b 0, player.destroy.1.a 20, player.experience.1.b 30, player.gold.1.a 45, player.peace.1 30, player.pop.1.a 50, player.resinc.1.b/2.b/3.b/4.b 50, player.troop.1.a 30.
- rarity 3 (rare): consume.1.c 240, consume.2.c.1 80, consume.2.d 120, hero.loyalty.8/9 0, hero.reset.1.a 90, player.attackinc.1.b 60, player.box.hero.c 0, player.box.special.1 80, player.box.troop.c 0, player.defendinc.1.b 60, player.experience.1.c 100, player.heart.1.a 100.
- rarity 2 (superrare): player.box.hero.d 0, player.box.special.2 140, player.box.special.3 240, player.box.troop.d 0, player.gold.1.b 280, player.more.castle.1.a 90, player.name.1.a 200, player.relive.1 120.
- rarity 1 (ultrarare): consume.hegemony.1 500.

The Amulet itself is `player.box.gambling.3` (cost 5, not gambleable).

---

## 3. Formulas

### 3.1 Troop travel time (`CalcTroopSpeed(city, troops, startTile, endTile)`) — returns **seconds** (int, truncated)

```
x = tile % mapsize ; y = floor(tile / mapsize)        (for both tiles)
distance = sqrt((fx-tx)² + (fy-ty)²)                   // Euclidean, in tiles, no map wrap

mech  = first present of [catapult 80, ballista 100, ram 120, carriage 150, heavyCavalry 750, lightCavalry 1000], else 10000
foot  = first present of [peasants 180, militia 200, archer 250, swordsmen 275, pikemen 300, scouter 3000], else 10000
     (lists are ordered slowest-first, so this is the slowest unit of each group)

academy = city Academy level
hbr     = min(research HorsebackRiding, academy)
compass = min(research Compass, academy)
mech *= 1 + 0.05 * hbr
foot *= 1 + 0.10 * compass
speed = min(mech, foot) / 1000 / 60
seconds = floor(distance / speed)          // = distance * 60000 / min(mech, foot)
```
Interpretation: base speed S means `S/1000` tiles per minute (cavalry 1000 = 1 tile/min). Code comments say "compass 1.5x max, hbr 2x max", which is the reverse of the coefficients actually used (compass ×2.0 at level 10, HBR ×1.5 at level 10). With no troops the speed is 10000 (6 s per tile).

Arrival: `reachtime = now_ms + seconds*1000 + restTime` (see bug in `army.newArmy` about restTime units).

### 3.2 army.getTroopParam values

`marchSkillParam = Compass × 10`, `loadSkillParam = Logistics × 10`, `driveSkillParam = HorsebackRiding × 5` (raw research levels, not capped by academy), `transportStationParam = GetReliefMultiplier()`:

| Relief Station level | multiplier |
|---|---|
| 0 / other | 1 |
| 1–3 | 2 |
| 4 | 3 |
| 5–7 | 4 |
| 8–9 | 5 |
| 10 | 6 |

### 3.3 Amulet (`GenerateGamble`)

Builds 24 candidate slots `gamblingItemsBeans[0..23]`, each `{ id, count, kind }`:
- slots 0–15: random item from **common** bucket (uniform, with replacement)
- slots 16–19: random **special**
- slots 20–22: random **rare**
- slot 23: with 95% (`rand()%100 < 95`) a random **superrare** (kind = rarity−1), else a random **ultrarare** (kind = rarity)
- `count = GetGambleCount(id)` (table below)

Winning slot: `v = rand()%100000`:

| v | chance | slot |
|---|---|---|
| 0–59999 | 60% | rand()%16 (0–15) |
| 60000–84999 | 25% | 16 + rand()%4 |
| 85000–94999 | 10% | 20 + rand()%3 |
| 95000–99999 | 5% | 23 |

Result object: `{ itemBeans: [ <the winning slot object> ], gamblingItemsBeans: [24 slot objects], packageId: 0.0, ok: 1 }`.
If any bucket is empty, `rand() % 0` → crash; guard this.

`GetGambleCount(id)` (with `p = rand()%5 == 1`, i.e. 20%; `q = rand()%2 == 1`, i.e. 50%):

| item | count |
|---|---|
| consume.1.a, consume.2.a, consume.2.b, consume.2.b.1, consume.blueprint.1 | p ? 5 : 1 |
| consume.refreshtavern.1, consume.transaction.1 | p ? 10 : 5 |
| hero.loyalty.1 … hero.loyalty.6 | p ? 5 : 1 |
| hero.loyalty.7 | p ? 4 : 1 |
| hero.loyalty.8 | p ? 3 : 1 |
| hero.loyalty.9 | p ? 2 : 1 |
| player.box.gambling.food, .wood | q ? 250000 : 500000 |
| player.box.gambling.stone, .gold | q ? 150000 : 300000 |
| player.box.gambling.iron | q ? 100000 : 200000 |
| player.heart.1.a, player.queue.building, player.gold.1.a, player.gold.1.b | p ? 10 : 5 |
| anything else (incl. player.box.gambling.medal.10) | 1 |

Award logic is in `shop.useGoods` (5.5.4).

---

## 4. alliance.* commands

None of the alliance commands require castleId unless stated. "Alliance message" = `server.SystemInfoMsg` to every member `{ alliance:true, sender:"Alliance Msg", tV, msg, noSenderSystemInfo }`.

### 4.1 alliance.isHasAlliance
Request: `{}`.
- If `HasAlliance()` (allianceid > 0): response
  ```
  { ok:1, packageId:0.0, serialVersionUID:1.0,
    middleList: [RelationSummary for each id in m_neutral],
    enemyList:  [RelationSummary for each id in m_enemies],
    friendlyList:[RelationSummary for each id in m_allies],
    indexAllianceInfoBean: indexAllianceInfoBean }
  ```
  (RelationSummary see 2.2. Missing alliances are meant to be skipped; due to 2.2.6 a missing id would crash.)
  **Bug:** `GetAlliance()` may be null if allianceid is dangling → crash.
- Else: `{ ok:-99, packageId:0.0, serialVersionUID:0.0, errorMsg:"You are not in any alliance." }` with cmd `alliance.isHasAlliance`.

### 4.2 alliance.getAllianceFriendshipList
Request `{}`. Not in alliance → `-99 "Not a member of an alliance."`. Otherwise `{ ok:1, packageId, middleList, enemyList, friendlyList }` exactly as 4.1 (no `indexAllianceInfoBean`, no `serialVersionUID`).

### 4.3 alliance.leaderWantUserInAllianceList (invitations received by me)
Request `{}`. Response `{ ok:1, packageId, allianceAddPlayerByLeaderInfoBeanList: [...] }` where for every alliance and every invite in it with `invite.client.accountid == me` and `inviteperson != ""`:
`{ prestige: alliance.m_prestige, rank: alliance.m_prestigerank, allianceName, memberCount: m_currentmembers }`.

### 4.4 alliance.rejectComeinAlliance (reject an invitation)
Request `{ allianceName: string }`.
1. Alliance by name; not found → `-99 "Alliance no longer exists."` (crashes in C++, 2.2.6).
2. If the alliance's invite list is empty → `-99 "Invite no longer exists."`.
3. Remove the first invite entry whose client is me (either kind) → `{ ok:1, packageId }`.
4. None matched → `-99 "An unknown error occurred."`.
No persistence (invites are memory-only).

### 4.5 alliance.agreeComeinAllianceList (pending applications, for officers)
Request `{}`.
1. If `client.allianceid == 0` or `alliancerank > 6` (below Presbyter) → `-99 "Not enough rank."`. **Bug:** allianceid −1 passes this check and then crashes; check `HasAlliance()`.
2. Alliance lookup; not found → `-99 "Alliance does not exist."`.
3. Response `{ ok:1, packageId, allianceAddPlayerByUserInfoBeanList: [...] }` with one entry per invite where `inviteperson == ""` (applications):
   `{ prestige: applicant.Prestige(), rank: applicant.prestigerank, userName, inviteTime, castleCount: applicant.citycount }`.

### 4.6 alliance.addUsertoAllianceList (invitations sent by my alliance)
Request `{}`. Not in alliance → `-99 "Not a member of an alliance."`. Response `{ ok:1, packageId, allianceAddPlayerInfoBeanList: [...] }` per invite with `inviteperson != ""`:
`{ prestige: invitee.prestige, rank: invitee.prestigerank, invitePerson, userName: invitee.playername, inviteTime }`.

### 4.7 alliance.addUsertoAlliance (invite a player)
Request `{ userName: string }`.
1. Not in alliance → `-99 "Not a member of an alliance."`.
2. `alliancerank > 6` → `-99 "Not enough rank."` (Host, Vice Host, Presbyter may invite).
3. Invitee by exact player name; not found → `-41 "Player <userName> doesn't exist."`.
4. Invitee `HasAlliance()` → `-99 "<userName>is already a member of other alliance."` (note: no space before "is").
5. Append invite `{ client: invitee, inviteperson: my playername, invitetime: now }` (no duplicate check).
6. `SendMessage(invitee, "You have been invited to the alliance <alliance name>")` (alliance:false, tV:false, noSender:false).
7. Response `{ ok:1, packageId }`; `alliance.SaveToDB()`.
TODO in code: 24-hour rejoin cooldown (`-301 "Can not join the same Alliance again in 23 hours."`).

### 4.8 alliance.canceladdUsertoAlliance (withdraw an invitation)
Request `{ userName }`. Not in alliance → `-99 "Not a member of an alliance."`. `UnRequestJoin(userName)` (removes **all** entries for that player — invitations and applications). Response `{ ok:1, packageId }`; SaveToDB. **No permission check** (TODO in code); should require rank ≤ 6.

### 4.9 alliance.cancelagreeComeinAlliance (decline an application)
Request `{ userName }`. Identical behaviour to 4.8 (same lack of permission check). Response cmd `alliance.cancelagreeComeinAlliance`.

### 4.10 alliance.userWantInAlliance (apply to an alliance)
Request `{ allianceName }`.
1. Current city Embassy level < 1 → `-99 "You need to build an embassy first."`.
2. Alliance not found → `-99 "Alliance does not exist."`.
3. If `client.allianceapply` non-empty, `UnRequestJoin(me)` on that previous alliance (crash if it no longer exists).
4. `alliance.RequestJoin(me, now)`; `client.allianceapply = allianceName; client.allianceapplytime = now`.
5. Alliance message `"<playername> has applied to join your alliance"` (tV:false, noSender:false).
6. Response `{ ok:1, packageId }`; `client.SaveToDB()`.
Does not check that the player is already in an alliance.

### 4.11 alliance.cancelUserWantInAlliance
Request `{ allianceName }`.
1. `client.allianceapply == ""` → `-99 "Not applied."`.
2. Alliance (by the **request's** name, not the stored one) not found → `-99 "Alliance does not exist."`.
3. `UnRequestJoin(me)`; clear `allianceapply`, `allianceapplytime = 0`; SaveToDB; `{ ok:1, packageId }`.

### 4.12 alliance.getAllianceWanted
Request `{}`. Response `{ ok:1, packageId, allianceName? }` — `allianceName` present only if `client.allianceapply` is non-empty.

### 4.13 alliance.getAllianceInfo
Request `{ allianceName }`. Not found → `-99 "Alliance does not exist."`. Response:
```
{ ok:1, packageId, leader: m_owner, prestigeCount: m_prestige, ranking: m_prestigerank,
  memberCount: m_currentmembers, allinaceInfo (sic): m_intro, creator: m_founder }
```

### 4.14 alliance.getAllianceMembers
Request `{}`.
1. `client.allianceid < 0` → `-99 "Not a member of an alliance."`. (allianceid 0 falls through and crashes; use HasAlliance.)
2. Alliance not found → `-99 "Invalid Alliance."`.
3. `members`: for each member whose client is loaded:
```
{ createrTime: 0, alliance: alliance name, office, allianceLevel: GetAllianceRank(rank) (string),
  sex, levelId: alliancerank (int), honor, bdenyotherplayer, id: accountid, accountName: "",
  prestige: Prestige(), faceUrl, flag, userId: masteraccountid, userName: playername,
  castleCount: citycount, titleId: title, medal: 0, ranking: prestigerank,
  lastLoginTime: lastlogin, population }
```
Response `{ ok:1, packageId, members }`.

### 4.15 alliance.getMilitarySituationList (stub)
Request `{ pageSize, pageNo }` (read, unused). Response `{ ok:1, packageId }`. TODO: alliance war reports.

### 4.16 alliance.createAlliance
Requires castleId. Request `{ castleId, allianceName }`.
1. Current city gold < 10000 → `-99 "Not enough gold."`.
2. `CheckName` fails or name length < 2 → `-99 "Illegal naming, please choose another name."`.
3. Name exists → `-12 "Alliance already existed: <name>."`.
4. `CreateAlliance(name, founder = playername)` (new id from counter, not inserted — see 2.2.5). Array full → `-99 "Cannot create alliance. Please contact support."`.
5. Set owner = me; `city.gold -= 10000`.
6. `JoinAlliance` fails → push PlayerInfoUpdate + ResourceUpdate, `-99 "Alliance created but cannot join. Please contact support."` (alliance and gold are **not** rolled back). This happens if the player is already in an alliance — **no pre-check exists**; add "already in alliance" validation before charging.
7. `SetRank(..., 4 Host)` fails → same pushes, `-99 "Alliance created but cannot set rank to host. Please contact support."`.
8. Push PlayerInfoUpdate, ResourceUpdate. Response `{ ok:1, packageId, msg: "Establish alliance <name> successfully." }`. Save client & alliance; `SortAlliances()`.
No embassy requirement in C++. Member limit is always 500.

### 4.17 alliance.setAllInfoForAlliance
Request `{ noteText, infoText, allianceName }`.
1. Not in alliance → `-99 "Not a member of an alliance."`.
2. `alliance.m_name != allianceName` → `-99 "Error."`.
3. `m_note = makesafe(noteText)`, `m_intro = makesafe(infoText)`. `makesafe` replaces every character not in `[0-9A-Za-z_./:@|]` with a space (so spaces survive as spaces, all other punctuation/unicode becomes spaces).
4. `{ ok:1, packageId }`; SaveToDB.
**No permission check** (TODO). Should require Host/Vice Host.

### 4.18 alliance.getPowerFromAlliance
Request `{}`. Not in alliance → `-99 "Not a member of an alliance."`. Response `{ ok:1, packageId, level: alliancerank }`.

### 4.19 alliance.setPowerForUserByAlliance (promote/demote)
Request `{ typeId: int8 (new rank 4..8), userName }`.
1. Not in alliance → `-99 "Not a member of an alliance."`.
2. Target not found or not a member of my alliance → `-99 "Member does not exist."`.
3. `SetRank(myAllianceId, target, typeId)` (result ignored).
4. Response `{ ok:1, packageId }`.
5. Alliance message `"<me> promotes <target> to <GetAllianceRank(typeId)>."` (tV:false, noSender:false) — wording is "promotes" even for demotions.
6. SaveToDB alliance and **me** (target client not saved — bug).
**Missing validation (TODO in code):** any member can set any rank on anyone, including Host (making two Hosts, `m_owner` not updated) and on themselves. Intended: actor rank must be strictly higher than both the target's current and new rank; Host transfer only via 4.20; rank-count limits.

### 4.20 alliance.resetTopPowerForAlliance (transfer Host)
Request `{ userName }`.
1. Not in alliance → `-99 "Not a member of an alliance."`.
2. My rank != 4 → `-42 "You are not entitled to operate."`.
3. Target not a member → `-41 "Player <userName> doesn't exist."`.
4. Target rank != 5 (Vice Host) → `-88 "The Host title of the Alliance can only be transferred to Vice Host. You need to promote this player first."`.
5. target.rank = 4, me.rank = 5 (**Bug:** only `client.alliancerank` is changed; `stMember.rank` in `m_members` is not, so the saved members string keeps the old ranks). Push PlayerInfoUpdate to both. `m_ownerid/m_owner = target`.
6. `{ ok:1, packageId }`; save alliance, me, target.

### 4.21 alliance.agreeComeinAllianceByUser (player accepts an invitation)
Requires castleId. Request `{ castleId, allianceName }`.
1. Current city Embassy level == 0 → `-99 "You do not have an embassy."`.
2. Already in alliance → `-99 "Already a member of an alliance."`.
3. Alliance not found → `-99 "Alliance no longer exists."` (this one null-checks correctly).
4. If the alliance has an **application** from me (`inviteperson == ""`) → `-99 "You cannot accept your own application."`.
5. `UnRequestJoin(me)`; `JoinAlliance` (rank 8; result ignored).
6. Response `{ ok:1, packageId }`; PlayerInfoUpdate; save alliance and me.
**Bug:** there is no check that an invitation actually exists — any player with an embassy can join any non-full alliance directly. Also `allianceapply` is not cleared. Intended: require an invitation entry for me.

### 4.22 alliance.agreeComeinAllianceByLeader (officer accepts an application)
Request `{ userName }`.
1. Not in alliance → `-99 "Not a member of an alliance."`.
2. `alliancerank < 3` → `-99 "You do not have the proper permissions."` — **Bug:** ranks are 4..8 so this never fires; anyone can accept. Intended `rank > 6`.
3. Player not found → `-41 "Player <userName> doesn't exist."`.
4. Player in an alliance → `-99 "<userName> is already a member of other alliance."`.
5. `UnRequestJoin(userName)`; `JoinAlliance(myAlliance, player)` (rank 8; result ignored; player gets PlayerInfoUpdate).
6. `{ ok:1, packageId }`; save alliance and the new member.
**Bug:** does not verify the player applied; does not clear the player's `allianceapply`.

### 4.23 alliance.kickOutMemberfromAlliance
Request `{ userName }`.
1. Not in alliance → `-99 "Not a member of an alliance."`.
2. Target not found or not a member → `-99 "Member does not exist."`.
3. Target is me → `-99 "Cannot kick yourself."`.
4. `myRank >= targetRank` → `-99 "Cannot kick someone higher ranking than you."` (must outrank strictly; members cannot kick members).
5. `RemoveFromAlliance(myAlliance, target)` fails → `-99 "Could not kick out member."`. (Target's allianceid becomes 0; target gets PlayerInfoUpdate.)
6. `{ ok:1, packageId }`; save alliance and target. No alliance message, no notification to the kicked player beyond PlayerInfoUpdate.

### 4.24 alliance.resignForAlliance
Request `{}`.
1. Not in alliance → `-99 "You are not in an alliance."`.
2. If I am Host and members > 1 → `-99 "Resignation refused. Please transfer your host title to other before you resign."`.
3. Else: `RemoveFromAlliance` (fail → `-99 "Unable to leave alliance. Please contact support."`), then **`DeleteAlliance(alliance)` unconditionally**, and **no response** is sent.
**Major bug:** a regular member resigning deletes the whole alliance, leaving other members with dangling allianceids. The code after this branch (send `{ok:1}`, save) is unreachable. Intended: remove me; if I was the last member (Host alone), delete the alliance; respond `{ ok:1, packageId }`; save.

### 4.25 alliance.sayByetoAlliance (leave alliance)
Request `{}`. If not in alliance: **no response**. Otherwise:
1. `alliance.RemoveMember(me)`.
2. Alliance message to remaining members: `"<playername> has left the alliance"` (tV:false, **noSender:true**).
3. Client: `allianceid = -1, alliancename = "", alliancerank = 0, allianceapply = "", allianceapplytime = 0`.
4. Response `{ ok:1, packageId }`.
5. `CheckAlliance` → deletes every empty alliance.
**Bugs:** no Host check (Host can leave a non-empty alliance, leaving it host-less); no PlayerInfoUpdate; nothing saved to DB (client nor alliance).

### 4.26 alliance.setAllianceFriendship
Request `{ type: 1|2|3, targetAllianceName }`.
1. Not in alliance → `-99 "Not a member of an alliance."`.
2. Target not found → `-99 "Alliance does not exist."`.
3. type 1: already ally → `-99 "Alliance is already an ally."`; else `Ally(target)`.
   type 2: already neutral → `-99 "Alliance is already neutral."`; else `Neutral(target)`.
   other: already enemy → `-99 "Alliance is already an enemy."`; `now < enemyactioncooldown` → `-99 "You have already declared war recently."`; else `Enemy(target)` (mutual, global announcement, 24h cooldown on both — 2.2.2).
4. `{ ok:1, packageId }`; save **my** alliance (the target's changed lists from `Enemy` are not saved).
**No permission check** (TODO) and no check that target != own alliance. Intended: Host/Vice Host only.

### 4.27 Alliance commands the client knows but the server ignores (no response)
`alliance.dropAllianceFriendshipRelation`, `alliance.getAllianceArmyReport`, `alliance.getAllianceEventList`, `alliance.getAllianceList`, `alliance.messagesForAllianceMember`.

---

## 5. army.* commands

### 5.1 army.setArmyGoOut
Requires castleId. Request `{ castleId, isArmyGoOut: bool }`. Sets `city.m_gooutforbattle` (whether city troops sortie to defend; used in scout battles). Response `{ packageId, ok:1 }`. Persisted with the next city save (`gooutforbattle` column). Note `CastleObject.goOutForBattle` is hard-coded false.

### 5.2 army.IsDropItemInCastle (stub)
No castleId check. Response `{ ok:1, packageId }`.

### 5.3 army.callBackArmy (unimplemented)
Requires castleId. Reads `armyId`. **Sends no response, does nothing.** Intended: recall an outgoing/stationed army (direction→2, reachtime = now + elapsed travel time).

### 5.4 army.getInjuredTroop
Requires castleId. Sends two messages:
1. `server.InjuredTroopUpdate { castleId: data.castleId, troop: city.InjuredTroops() (TroopsObject of m_injuredtroops) }`
2. `army.getInjuredTroop { packageId, ok:1 }`

### 5.5 army.getTroopParam
Requires castleId. Response `{ marchSkillParam, loadSkillParam, packageId, ok:1, driveSkillParam, transportStationParam }` (values in 3.2).

### 5.6 army.getStayAllianceArmys (stub)
Requires castleId. Response `{ packageId, ok:1 }` — no list (intended: reinforcements stationed in my city/embassy).

### 5.7 army.newArmy
Requires castleId. Request:
```
{ castleId,
  newArmyBean: {
    targetPoint: int (tile id = y*mapsize + x),
    troops: TroopsObject (12 keys, 0.8),
    resource: { gold, food, wood, stone, iron },
    useFlag: bool (unused), backAfterConstruct: bool (unused),
    heroId: int64 (negative = no hero),
    restTime: int (stay time; client sends seconds — see bug),
    missionType: 1..5 } }
```
Validation and logic:
1. `rally = city RallySpot level`; if `rally < city.armymovement.size()` → `-51 "No more troops are allowed to sent at current level of Rally Spot. Please upgrade the Rally Spot first."`. **Bug:** armies are tracked in `client.armymovement`, not `city.armymovement` (always empty), so this never fires. Intended: count this city's active outgoing armies; reject if `count >= rallyLevel`.
2. If `missionType` is 5 (attack) or 3 (scout):
   a. `client.beginner && tile.type > 10` (castle or NPC) → `-69 "Beginner's Protection will automatically expired 7 days after registration or Town Hall reaches level 5."`. (Beginners can still attack/scout valleys.)
   b. If tile has an owner (`tile.m_ownerid > 0`):
      - owner client not found → `-13 "Problem with internal mapdata. Please report this bug."`
      - `GetRelation(me, owner)` ∈ {self 5, same alliance 0, ally 1} → `-13 "You can't perform this operation against this target."`
      - owner beginner and tile.type == 11 (castle) → `-70 "Operation denied. This player is under Beginner's Protection."`
   c. `!city.HasTroops(troops)` (any type requested > available) → `-29 "You have insufficient troops."`. **Bug:** negative counts are not rejected and would add troops; validate all counts ≥ 0 and total > 0.
   d. scout mission with `troops.scouter == 0` → `-61 "Scouts are required for this mission."`.
   e. `heroId < 0`: attack → `-71 "You must appoint a hero to lead the attack."`; scout → allowed without hero.
      `heroId >= 0`: hero not among this city's heroes → `-80 "Hero does not exist."`; hero status != 0 → `-80 "Status of this hero is not Idle."`.
   f. Create movement: `direction=1, resources=request resources, startposname=city name, king=playername, troops, starttime=now, armyid=armycounter++, reachtime = now + CalcTroopSpeed(city, troops, city.tile, target)*1000 + restTime, resttime=restTime, missiontype, startfieldid=city tile, targetfieldid, targetposname = target tile GetName(), heroname/herolevel if hero, city, client`.
   g. `AddTimedEvent({type: ARMY, data: movement})`; `client.armymovement.push(movement)`.
   h. `city.troops -= troops`. **Bug:** resources carried are **not** deducted from the city, but are added back when the army returns → resource duplication. Intended: validate and deduct `resource` (and probably a carry-capacity check, which is absent).
   i. If hero: `hero.movement = movement; hero.status = 3;` push `server.HeroUpdate` (type 2).
   j. Push `server.TroopUpdate`, `server.ResourceUpdate`, `server.SelfArmysUpdate`.
   k. If attack: append movement to target owner's `enemyarmymovement` and push `server.EnemyArmysUpdate` to the owner. **Crash bug:** in the "unowned tile (NPC/valley)" branch the same code runs with a null owner → attacking an NPC city or unowned valley crashes the server. Only notify when the tile has an owner.
   l. Response `army.newArmy { packageId, ok:1 }`. Save city, hero.
   The owned-tile and unowned-tile branches are otherwise identical (the unowned branch skips 2b).
3. `missionType == 2` (reinforce): empty branch — **no response**, nothing happens.
4. Other mission types (1 transport, 4 build city): **no response**, nothing happens.

**restTime bug:** the comment says restTime is in seconds but it is added raw to a millisecond timestamp (so 3600 s of camping adds 3.6 s). Multiply by 1000.

### 5.8 Army timed-event processing (timer thread, every 100 ms)

This is the consumer of `army.newArmy`. Iterate a copy of `armylist`:

1. If `movement.client` is null → delete, erase (C++ erases using the copy's iterator — UB).
2. Skip `direction == 3` (stay).
3. If `reachtime < now`:
   - **Forward (1):** re-validate the target (same rules as 5.7 2a/2b; null-owner deref bug here too). 
     - Invalid → turn back: `direction=2; reachtime = now + (reachtime − starttime − resttime)` (same travel time back); `resttime=0; starttime=now`; hero status 5; push SelfArmysUpdate.
     - Valid, **scout**:
       - Valley (`tile.type < 11`): regenerate valley defenders (`ValleyData.Reset`), write a scout report (`title "Scout Report"`, type_id 1, armytype 3, XML `reportData > scoutReport[isFound=false,isSuccess=true,isAttack=true] > scoutInfo[heroLevel,heroName,heroUrl] > troops > troopStrType[typeId,count]*` + `battleInfo[isAttack=true]`), add to reports (push_front), turn army back (as above), push SelfArmysUpdate + ReportUpdate.
       - Player castle: scout-vs-scout battle via `CombatSimulator::fight` (attacker: scouts + hero power/stratagem + attacker research levels; defender: scouts of all `direction==3` armies at that tile in owner's own/friend lists + city scouts if `m_gooutforbattle`; defender hero = highest-power hero among campers and city heroes). Defender losses distributed proportionally (`ceil(campScouts*damage/totalDefScouts)`); emptied camper armies are removed (code then dereferences the nulled client — crash bug). If defender wins and all attacking scouts die: hero loyalty −5 (min 0); if the defender city has a free Feasting Hall slot and `rand()%100 > loyalty`, the hero is **captured** (removed from attacker city, put into defender city — **bug:** loop has no `break`, so the pointer is written into every empty slot —, owner changed, loyalty 0, buff bonuses zeroed, status 4, HeroUpdate type 0 to defender and type 1 to attacker); otherwise hero status is also set to 4 (bug — comment says "return hero to city immediately"). The army is deleted (troops lost). If no hero, army deleted. If attacking scouts survive: survivors kept, army turns back (`am->hero->m_status = 5` without null check — crash if no hero). **No scout report is generated for castle scouting (TODO).**
       - NPC city: write a scout report with NPC info (XML `scoutReport[isFound=true]`, `scoutInfo[support=loyalty,population,gold,heroLevel,heroName,heroUrl]`, `resource>food/wood/iron/stone`, `fortifications>fortificationsType[typeId 14..18,count]` if any, `troops>troopStrType[typeId,count]` for militia/pike/sword/archer/cavalry if any, `buildings>buildingType[type,levels="l1,l2,..."]`, `battleInfo[isAttack=true, unNomal="No defending troops found."]>backTroop>troops[hero attrs, isHeroBeSeized=false]>troopInfo[typeId,remain]*`), turn back, push SelfArmysUpdate + ReportUpdate.
     - Valid, **attack**: `// TODO` — **nothing happens**; the army sits forever past its reachtime. Combat/plunder/occupation are unimplemented here.
     - Other missions: nothing happens.
   - **Backward (2):** hero status 0; `city.resources += movement.resources`; `city.troops += movement.troops`; remove from client's armymovement; HeroUpdate(type 2); push SelfArmysUpdate, PlayerInfoUpdate, TroopUpdate, ResourceUpdate; create report: title `"Scout Returned"` (mission 3) / `"Attack Returned"` (5) / `"Returned"`, `back=true, attack=false, armytype=mission, type_id=1`, XML `reportData > troopMovement[isBack=true, type=mission, heroLevel?, heroName?, heroUrl?] > troops[typeId,count]*`; push ReportUpdate; remove event, delete movement. (The target's `enemyarmymovement` entry is never removed — dangling pointer bug.)

Report positions are formatted `"<name> (<x>,<y>)"` with x = tile % mapsize, y = tile / mapsize; report XML is written to `reportbasepath/<guid>.xml` (guid = 28 random chars) and referenced by URL `reportbaseurl/<guid>.xml`.

### 5.9 Army commands the client knows but the server ignores
`army.cureInjuredTroop`, `army.disbandInjuredTroop`, `army.exerciseArmy`, `army.setAllowAllianceArmy` → no response.

---

## 6. hero.* commands

**All hero commands require castleId** (checked once at the top of the handler; missing/mismatched → silently dropped). `city` = current city. Hero lookup is always within the current city's `m_heroes` only.

### 6.1 hero.getHerosListFromTavern
Request `{ castleId }`.
- `inn = Inn level`. If `inn > 0`: for slots `0..inn-1`, generate `CreateRandomHero(inn)` into any empty slot; response
  `{ ok:1, packageId, posCount: FeastingHallLevel − (number of hired heroes), heros: [HeroObject × inn] }`.
  (posCount can be negative.) Generated heroes are memory-only and persist until hired, refreshed, or the Inn is upgraded.
- Else: `{ ok:-1, packageId }` (no errorMsg; TODO in code for proper error).

### 6.2 hero.refreshHerosListFromTavern
Request `{ castleId }`.
- If Inn level == 0 → `-99 "Not enough cents."` (mismatched message; TODO).
- If item `consume.refreshtavern.1` (Hero Hunting) count ≤ 0 → `-99 " 0 Refresh items"` (leading space is in the original).
- Consume 1 Hero Hunting (`server.ItemUpdate` is pushed twice: once by AddItem, once explicitly).
- Regenerate **all** slots `0..inn-1` with new random heroes.
- Response cmd is **`hero.getHerosListFromTavern`** (not refresh): `{ ok:1, packageId, posCount, heros }` (same as 6.1).
- Client is not saved.

### 6.3 hero.hireHero
Request `{ castleId, heroName }`.
1. `FeastingHallLevel <= HeroCount()` → `-99 "Insufficient vacancies in Feasting Hall."`.
2. Find inn slot `i` (0..9) whose hero name equals `heroName`. **Crash bug:** the loop dereferences every slot without a null check; empty slots (beyond Inn level, or a slot emptied by an earlier hire) crash the server. Skip null slots.
3. `cost = level * 1000`; `cost > city.gold` → `-99 "Not enough gold!"`.
4. Find the first empty `m_heroes[x]`. If found: `gold -= cost`; recalc city stats; assign `id = m_heroid++`; push `server.HeroUpdate` (type 0, hired) **before** setting castleId (castleId in the push is the city's, fine); move hero from inn slot to `m_heroes[x]`, clear inn slot; push ResourceUpdate; set `m_client`, `m_ownerid`, `m_castleid`; `InsertToDB()`. (If no empty slot is found — only possible with Feasting Hall > 10 — nothing happens but the response is still ok.)
5. Response `{ ok:1, packageId }`; save client and city.
6. Not found → `-99 "Hero does not exist!"`.
Hired hero keeps loyalty 70, status 0.

### 6.4 hero.fireHero
Request `{ castleId, heroId: int }`.
1. Find hero in current city by id; not found → `-99 "Hero does not exist!"`.
2. `status != 0` → `-80 "Status of this hero is not Idle!"` (so mayors and marching heroes cannot be fired).
3. Recalc stats, push ResourceUpdate, push `server.HeroUpdate` type 1 (fired), add id to `m_deletedhero`, `DeleteFromDB`, free slot.
4. Response `{ ok:1, packageId }`. No refund.

### 6.5 hero.promoteToChief (appoint mayor/castellan)
Request `{ castleId, heroId: int }`.
1. Find hero; not found → `-99 "TODO error message - hero.promoteToChief"` (literal placeholder text).
2. If a mayor exists: old mayor status → 0, push HeroUpdate(type 2).
3. `m_mayor = hero; hero.status = 1`; push HeroUpdate(type 2); recalc; push ResourceUpdate.
4. Response `{ ok:1, packageId }`; save old mayor, new mayor, city.
**Missing validation:** does not require the hero to be idle (a marching hero, status 3, can be made mayor). Comment in code: "BUG : Correct hero not being promoted" (cause not evident in this function).

### 6.6 hero.dischargeChief
Request `{ castleId }`.
1. No mayor → `-99 "Castellan is not appointed yet."`.
2. mayor.status = 0; push HeroUpdate(type 2); `m_mayor = null`; recalc; push ResourceUpdate.
3. `{ ok:1, packageId }`; save hero and city.

### 6.7 hero.resetPoint
Request `{ castleId, heroId: int }`.
1. Hero not found → `-99 "Hero does not exist!"`.
2. `status > 1` → `-80 "Status of this hero is not Idle!"` (idle and mayor allowed).
3. `power = basepower; management = basemanagement; stratagem = basestratagem; remainpoint = level`.
4. Push ResourceUpdate (before the change) and HeroUpdate (type 2). Response `{ ok:1, packageId }`; save hero.
TODO in code: should consume Holy Water (`hero.reset.1`). Currently free.

### 6.8 hero.addPoint
Request `{ castleId, heroId: int, stratagem: int, power: int, management: int }` — the **new absolute totals** (not deltas).
1. Hero not found → `-99 "Hero does not exist!"`.
2. Let `cap = basemanagement + basepower + basestratagem + level`. If `stratagem + power + management > cap`, or any new value is lower than the current value → `-99 "Invalid action."`.
3. Set the three stats; `remainpoint = cap − (stratagem + power + management)`.
4. Push ResourceUpdate ×2, HeroUpdate (type 2). Response cmd is **`hero.resetPoint`** (copy/paste bug; intended `hero.addPoint`): `{ ok:1, packageId }`. Save hero.
No status check.

### 6.9 hero.levelUp
Request `{ castleId, heroId: int }`.
1. Hero not found → `-99 "Hero does not exist!"`.
2. `experience < upgradeexp` → `-99 "Not enough experience."`.
3. `level += 1; remainpoint += 1; experience -= upgradeexp; upgradeexp = level² × 100` (new level).
4. Push HeroUpdate (type 2). Response `{ ok:1, packageId }`. Save hero.
One level per call.

### 6.10 hero.awardGold (reward)
Request `{ castleId, heroId }`.
1. Hero not found → `{ ok:-99, errorMsg:"Invalid hero", packageId }` (cmd hero.awardGold).
2. `cost = level * 100`; `gold < cost` → `{ ok:-99, errorMsg:"Not enough gold", packageId }`.
3. `loyalty = min(100, loyalty + 5)`; `gold -= cost`.
4. Push ResourceUpdate, HeroUpdate (type 2). Response `{ ok:1, packageId }`. Save client, city, hero.
No cooldown, no check for loyalty already 100 (gold is still charged).

### 6.11 hero.useItem
Request `{ castleId, heroId, itemId: string }`.
1. Hero not found → `{ ok:-99, errorMsg:"Invalid hero", packageId }`.
2. `prefix = itemId without its last 2 characters`.
3. **Experience items** (`prefix == "player.experience.1"`):

   | itemId | name | exp granted | cents if no item |
   |---|---|---|---|
   | player.experience.1.a | Anabasis | max(1000, 8% of upgradeexp) | 8 |
   | player.experience.1.b | Epitome of Military Science | max(10000, 30% of upgradeexp) | 30 |
   | player.experience.1.c | On War | max(100000, 100% of upgradeexp) | 100 |
   | other suffix | — | 0 | 0 |

   If the player has none of the item: if `cents < price` → `-99 "Not enough cents."`; else `cents -= price` and push PlayerInfoUpdate (auto-buy). Else consume 1 item (ItemUpdate).
   `experience += exp` (no auto level-up). Push HeroUpdate(2). Response `{ ok:1, packageId }`. Save client, city, hero.
4. **Loyalty medals** (`prefix == "hero.loyalty"`, i.e. ids `hero.loyalty.1` … `.9`):

   | id | name | +loyalty |
   |---|---|---|
   | hero.loyalty.1 | Cross Medal | 5 |
   | hero.loyalty.2 | Rose Medal | 10 |
   | hero.loyalty.3 | Lion Medal | 15 |
   | hero.loyalty.4 | Honor Medal | 20 |
   | hero.loyalty.5 | Courage Medal | 25 |
   | hero.loyalty.6 | Wisdom Medal | 30 |
   | hero.loyalty.7 | Freedom Medal | 40 |
   | hero.loyalty.8 | Justice Medal | 50 |
   | hero.loyalty.9 | Nation Medal | 60 |

   No item → `-99 "No Item."` (no cents fallback). Consume 1, `loyalty = min(100, loyalty + n)`, push HeroUpdate(2), `{ ok:1, packageId }`, save.
5. Anything else → `-99 "Invalid Item."`.
Not handled here although the client has them: `hero.power.1`, `hero.management.1`, `hero.intelligence.1`, `hero.reset.1`.

### 6.12 hero.changeName
Request `{ castleId, heroId: int64, newName: string }`. Hero not found → `-99 "Hero not found."`. Sets name (no length/profanity/uniqueness validation, no cost). Push HeroUpdate(2). Response `{ ok:1, packageId }`. Save hero.

### 6.13 Hero commands the client knows but the server ignores
`hero.callBackHero`, `hero.releaseHero`, `hero.tryGetSeizedHero` → no response.

---

## 7. field.* commands

### 7.1 field.getOtherFieldInfo
Request `{ fieldId: int }` (no castleId check, no bounds check — validate `0 <= fieldId < mapsize²`).
Response `{ bean: FieldBean, ok:1, packageId }`.

FieldBean (`Map::GetMapCastle(fieldId, myAccountId)`), `zoneName` = state name from a 4×4 grid of the map (`states[GetStateFromID]`, names FRIESLAND, SAXONY, NORTH MARCH, BOHEMIA, LOWER LORRAINE, FRANCONIA, THURINGIA, MORAVIA, UPPER LORRAINE, SWABIA, BAVARIA, CARINTHIA, BURGUNDY, LOMBARDY, TUSCANY, ROMAGNA):

- Tile owned (`m_ownerid > 0`) but owner not loaded: **mutates the tile type to FLAT (10)** and returns `{ allianceName:"", npc:false, canLoot:true, canOccupy:true, canScout:true, canSend:false, canTrans:false, zoneName, id }`.
- Tile owned, type < 11 (valley owned by a player):
  `{ allianceName: owner.alliancename, flag, honor, id, prestige, canLoot, canOccupy, canScout, canSend, canTrans, relation, state: owner.status, userName, zoneName, furlough: owner.beginner, npc:false }` (`name` commented out).
- Tile owned, type ≥ 11 (castle): same plus `name: city name, playerLogoUrl: owner.faceurl`.
- Relation is **hard-coded 0** (call to GetRelation commented out). The switch maps: self(5)/ally(1) → canLoot/canOccupy/canScout false, canSend/canTrans true; enemy(3) → all true; neutral/no-relation/default (including the hard-coded 0) → canLoot/canOccupy/canScout true, canSend/canTrans false. So every player tile is shown as hostile-ish with `relation: 0`. Intended: use real `GetRelation(me, owner)`; same-alliance (0) should behave like ally.
- NPC tile: `{ allianceName:"", npc:true, canLoot:true, canOccupy:true, canScout:true, canSend:false, canTrans:false, zoneName, id, name: npc city name }`.
- Empty tile: `{ allianceName:"", npc:false, canLoot:true, canOccupy:true, canScout:true, canSend:false, canTrans:false, zoneName, id }`.

### 7.2 Field commands the client knows but the server ignores
`field.getCastleFieldInfo`, `field.giveUpField` → no response.

---

## 8. shop.* commands

### 8.1 shop.buy
Request `{ itemId: string, amount: int64 }` (no castleId).
1. `amount <= 0` → `-28 "Not going to happen."`.
2. Find item config by exact name (`m_items[0..399]`); not found → `-99 "Item does not exist."`.
3. `cents < cost * amount` → `-28 "Insufficient game coins."`.
4. `cents -= cost * amount`; `AddItem(itemId, amount)` (pushes ItemUpdate); push PlayerInfoUpdate.
5. Response `{ packageId, ok:1 }`; save client.
Not enforced: `buyable` flag, `daylimit`.

### 8.2 shop.getBuyResourceInfo
Requires castleId. Request `{ castleId, amount }` (amount unused). Response (static):
```
{ packageId, ok:1, buyResourceBean: { woodRemain:10000000, forWood:100000, stoneRemain:10000000, forStone:50000,
                                      ironRemain:10000000, forIron:40000, foodRemain:10000000, forFood:100000 } }
```
`forX` = units of resource per 1 cent. `xRemain` is never decremented.

### 8.3 shop.buyResource
Requires castleId. Request `{ castleId, foodUse, woodUse, stoneUse, ironUse }` (ints, cents to spend per resource).
1. `foodUse + woodUse + stoneUse + ironUse > cents` → `-24 "Insufficient game coins."`.
2. `cents -= sum`; `food += foodUse*100000; wood += woodUse*100000; stone += stoneUse*50000; iron += ironUse*40000`.
3. Push PlayerInfoUpdate, ResourceUpdate. Response `{ packageId, ok:1 }`. **Not saved** to DB.
**Bug:** negative inputs are accepted (gain cents, lose resources). Validate each ≥ 0. No warehouse cap, no `xRemain` enforcement.

### 8.4 shop.useGoods
Requires castleId. Request `{ castleId, itemId: string, num: uint32 }`.
1. `GetItemCount(itemId) < num` → `-24 "Insufficient items."`.
   **Bug:** `num = 0` bypasses the check; all handlers consume exactly 1 regardless of `num`, and `AddItem(id,-1)` on a missing item is a no-op → free use of any item (e.g. infinite amulets). Validate `num >= 1` and count ≥ 1 (and consider honouring `num`).
2. Dispatch on `itemId` (response cmd `shop.useGoods`, base `{ packageId, ok:1 }`); client saved afterwards. Unhandled item ids → **no response** (the full list of known-but-unimplemented ids is in the code as comments: speakers, ritual of pact, blueprints, flags, keys, teleporters, transaction, hero stat items, attack/defence buffs, boxes/presents/chests, resource boosts, truce, troop boxes, holiday items, etc.).

#### 8.4.1 player.level.hero.100 (debug item)
Mayor of current city; none → `-99 "Mayor not set."`. `level += 100; remainpoint += 100` (upgradeexp not updated). Push HeroUpdate(2); consume 1; `{ packageId, ok:1 }`; save client, city, hero. (Item is not in config_items.)

#### 8.4.2 player.box.special.1 / .2 / .3 (Junior / Medium / Senior Medal Box)
Consume 1. Grant three medal types, each `2 + rand()%3` (2–4) pieces:
- special.1 → hero.loyalty.1, .2, .3
- special.2 → hero.loyalty.4, .5, .6
- special.3 → hero.loyalty.7, .8, .9
Response `{ packageId, ok:1, itemBeans: [ { id, count, minCount:0, maxCount:0 } ×3 ] }`. Save client.

#### 8.4.3 player.box.test.1
Empty branch; no response.

#### 8.4.4 player.box.gambling.3 (Amulet)
1. Two unused random draws from all items (ignore).
2. `result = GenerateGamble()` (3.3); response data = `result` (`{ itemBeans:[won], gamblingItemsBeans:[24], packageId, ok:1 }`), cmd `shop.useGoods`.
3. `it = config of won.id`; `worth = it.cost * won.count`; `desc = it.desc`.
4. Consume 1 Amulet.
5. Award:
   - `player.box.gambling.gold` → current city gold += count
   - `.food` / `.wood` / `.stone` / `.iron` → that resource += count
   - `player.box.gambling.medal.10` → `cents += count` and desc = `"Cents"` (count is 1 per GetGambleCount, so +1 cent — the item name implies 10)
   - anything else → `AddItem(id, count)`
   No ResourceUpdate/PlayerInfoUpdate is pushed for resource/cent wins (bug; push them).
6. Broadcast to all players (`MassMessage`, alliance:false, tV:false, noSender:false):
   `"<Lady |Lord ><font color='#FF0000'><b><u>PLAYERNAME</u></b></font> gained <b><font color='#00A2FF'>COUNT DESC</font></b> (worth <b><font color='#FF0000'>WORTH</font></b> Cents) from <b><font color='#FF0000'>Amulet</font></b>!"` — "Lady " if `sex == 1` else "Lord ". (COUNT is produced by casting the integer to string; may render empty in C++ — use the decimal number.) A commented capture of the official server shows two broadcasts (one with `tV:true`, one with `noSenderSystemInfo:true`).
7. Send the response. Client saved by the caller.

### 8.5 shop.useCastleGoods
Requires castleId. Request `{ castleId, itemId, num }`. Same count check as 8.4 (error cmd is `shop.useGoods`, `-24 "Insufficient items."`, same num=0 bug). Response cmd is **`shop.useGoods`** with `{ packageId, ok:1 }`. Target city = the player's city with `m_castleid == castleId`; not found → `-99 "Invalid castle."` (cmd `shop.useCastleGoods`).

| itemId | name | effect |
|---|---|---|
| player.pop.1.a | Civil Code | `population += max(100, floor(maxpopulation * 0.20))`, capped at maxpopulation |
| player.heart.1.a | Speech Text | `loyalty = 100; grievance = 0` |
| player.box.test.1 | Test Item | nothing, no response |
| other | — | no response |

After the effect: consume 1, recalc stats, push `server.CastleUpdate` and ResourceUpdate, save client and city, send response.

---

## 9. trade.* commands (marketplace)

No castleId checks; the market uses the client's current city.

### 9.1 trade.searchTrades
Request `{ resType: 0 food | 1 wood | 2 stone | 3 iron }`. Out of range → `-99 "Not a valid resource type."`.
Response `{ packageId, ok:1, sellers: [ {amount, price} ], buyers: [ {amount, price} ] }` from the aggregated cache (2.4; refreshed if older than 5 s).
**Bug:** a single counter caps buyers+sellers together at 5 (if 5 buyers are listed, at most 1 seller is). Intended: top 5 price levels each side (buyers highest price first, sellers lowest first). In practice only food has data.

### 9.2 trade.newTrade
Request `{ resType: 0..3, tradeType: 1 = sell, anything else = buy, amount: number, price: string }`.
1. resType out of range → `-99 "Not a valid resource type."`.
2. `price = atoi(price string)` — integer truncation (prices below 1 become 0; intended decimal parsing).
3. Buy: `city.gold < amount * price` → `-99 "Not enough gold."`. Sell: **no check that the city has the resource.**
4. Add to market (food: `addFoodBuy/addFoodSell`; wood/stone/iron: discarded stubs).
5. Response `{ packageId, ok:1 }`.
**Not implemented:** escrow/deduction of gold or resources, marketplace building requirement, max open orders, fees, `server.TradesUpdate` push, persistence, matching (Process disabled), delivery.

### 9.3 Trade commands the client knows but the server ignores
`trade.cancelTrade`, `trade.getMyTradeList`, `trade.getTransingTradeList`, `trade.speedUpTrans` → no response.

---

## 10. stratagem.*

There is no handler. `stratagem.useStratagem` (the only command the client knows) is routed to `punknown` and answered with `server.SystemInfoMsg { alliance:false, tV:false, noSenderSystemInfo:false, msg:"Unknown object - stratagem.useStratagem" }`. Stratagems must be designed from scratch.

---

## 11. Consolidated bug / gap list (priority order)

Crashes (null deref / UB):
1. All alliance-not-found checks compare against `-1` instead of null (2.2.6).
2. `army.newArmy` attack on NPC/unowned tile dereferences null owner (5.7 k).
3. `hero.hireHero` dereferences empty inn slots (6.3).
4. Scout battle: removed camper `il->client = 0; il->client->...`; `am->hero->m_status` without null check; null owner on re-validation (5.8).
5. `alliance.agreeComeinAllianceList` / `getAllianceMembers` with allianceid −1 / 0.
6. `GenerateGamble` with an empty bucket (`% 0`).
7. `AddItem` of an item id absent from config_items dereferences null config.
8. `Client::HeroUpdate(id, castleId)` iterates hero slots without null checks.

Exploits / economy:
9. `army.newArmy` never deducts carried resources (duplication on return); negative troop counts accepted.
10. `shop.useGoods` / `useCastleGoods` with `num = 0` → free item use.
11. `shop.buyResource` negative values.
12. `trade.newTrade` no escrow; price parsed as integer.
13. `alliance.agreeComeinAllianceByUser` joins without an invitation; `agreeComeinAllianceByLeader` permission check is dead (`rank < 3`) and doesn't require an application.
14. `alliance.setPowerForUserByAlliance`, `setAllInfoForAlliance`, `setAllianceFriendship`, `canceladdUsertoAlliance` have no permission checks.

Logic:
15. `alliance.resignForAlliance` disbands the whole alliance for any non-host resigner and sends no response.
16. `alliance.sayByetoAlliance` allows Host to leave; saves nothing.
17. `alliance.createAlliance` never INSERTs the alliance (lost on restart); charges gold before checking existing membership.
18. Alliance `SaveToDB` cumulative relation strings; intro/motd not loaded.
19. `resetTopPowerForAlliance` doesn't update `stMember.rank`.
20. `GetRelation` treats two allianceid-0 players as the same alliance.
21. Rally Spot army limit never enforced; `restTime` added in seconds to ms timestamp.
22. Attack missions do nothing on arrival; reinforce/transport/build missions not implemented; `army.callBackArmy` unimplemented.
23. `server.EnemyArmysUpdate` / `FriendArmysUpdate` payloads empty; enemy movement lists never cleaned.
24. Loaded armies have event id 0 → mass removal from timer list.
25. `CreateRandomHero` can leave stratagem at 0.
26. `hero.addPoint` responds with cmd `hero.resetPoint`; `refreshHerosListFromTavern` responds with cmd `hero.getHerosListFromTavern`; `useCastleGoods` responds with `shop.useGoods`.
27. Market: wood/stone/iron orders discarded; cache aggregation flag bug; wood/stone buys written to food cache; comparators invalid; matching disabled; searchTrades shared counter.
28. `field.getOtherFieldInfo` hard-codes relation 0; mutates orphaned tiles to FLAT.
29. Tavern heroes are memory-only (lost on restart); hero names are placeholders and used as identifiers for hiring (use an offer id instead).
30. `hero.promoteToChief` accepts non-idle heroes; `hero.resetPoint` is free (Holy Water TODO); `hero.changeName` unvalidated.

Unimplemented commands (no response today): alliance.dropAllianceFriendshipRelation, getAllianceArmyReport, getAllianceEventList, getAllianceList, messagesForAllianceMember; army.callBackArmy, cureInjuredTroop, disbandInjuredTroop, exerciseArmy, setAllowAllianceArmy; field.getCastleFieldInfo, giveUpField; hero.callBackHero, releaseHero, tryGetSeizedHero; trade.cancelTrade, getMyTradeList, getTransingTradeList, speedUpTrans; stratagem.useStratagem (unknown-object message); most `shop.useGoods` item ids.
