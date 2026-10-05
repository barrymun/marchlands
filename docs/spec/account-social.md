# Spec: Accounts, Login, Player Bean, Chat, Mail, Reports, Rankings, Quests, Furlough

Source of truth: `evony-private-server/src` (C++). Files covered: `request_handler.cpp`,
`packets/{packet,plogin,pcommon,pserver,pgameclient,punknown,pfurlough,pfriend,pmail,preport,prank,pquest}.cpp`,
plus the helpers they call in `spitfire.cpp`, `Client.cpp`, `PlayerCity.cpp`, `City.cpp`, `Map.cpp`,
`AllianceMgr.cpp`, `Utils.cpp`, `structs.h`, `defines.h`, `connection.cpp`, and the MySQL dumps in `DB/`.

This document describes **what the C++ does** (including its bugs) and, where the behaviour is clearly
broken, what the **intended** behaviour is. Each bug is tagged **[BUG]**, each unimplemented branch **[GAP]**.
Section 15 collects them. A reimplementation should follow the "intended" notes unless wire compatibility
with the original Flash client needs the buggy behaviour.

---

## 0. Conventions

### 0.1 Message envelope

The client and server exchange objects of this shape (originally AMF3 over TCP with a 4-byte big-endian
length prefix; in the rewrite, JSON over WebSocket):

```
{ "cmd": "<type>.<command>", "data": { ... } }
```

* Client→server requests: `cmd` is like `"mail.sendMail"`. The login request uses the bare `cmd` `"login"`.
* Server→client responses usually repeat the request's `cmd` (e.g. `"mail.sendMail"`). Unsolicited pushes use
  `cmd` = `"server.<Something>"`.
* Almost every response's `data` contains `"packageId": 0.0` (always the number 0) and `"ok"`: `1` means success.
  A negative number (or another code) is an error.
* Times are **milliseconds since the Unix epoch** (`Utils::time()`), sent as numbers (often doubles).

### 0.2 Standard error object (`spitfire::CreateError`)

```
{ "cmd": <cmd>, "data": { "errorMsg": <message string>, "packageId": 0.0, "ok": <code int> } }
```

Every error below is written as `ERR(<cmd>, <code>, "<message>")`, which means this object.

### 0.3 Type coercion of request fields

Request fields are read with implicit AMF conversions. A missing field or a field of the wrong type becomes
`0` / `false` / `""`. Numbers given as strings are **not** parsed. Strings built from numbers are their decimal
text. Bools read as ints are 0/1. In the rewrite, a missing field should behave the same way (default to
0/""/false) unless you add validation on purpose.

### 0.4 "Silent drop"

Some paths send nothing back, so the client waits forever or ignores the request. They are marked
**(no response)**.

### 0.5 Client (player) identity fields used throughout

| C++ field | Meaning |
|---|---|
| `masteraccountid` | id in the global `account` table (the login identity). Sent as `userId`. |
| `accountid` | id in the per-server `accounts` table (the in-game player). Sent as `id` / `playerId`. |
| `playername` | in-game name (`accounts.username`). Default `"Testname"` before a player is created. |
| `email` | login name (`account.email`). Sent as `accountName` in PlayerInfo. |
| `password` | plaintext password copied from `account.password` at server start only. |
| `cents` | premium currency. Sent as `medal`. |
| `icon` | chat icon id (`ownitemid` in chat messages). |
| `status` | player state: 0 NORMAL, 1 PEACETIME, 2 TRUCE, 3 BEGINNER, 5 HOLIDAY (`defines.h`). |
| `prestige`, `honor`, `title`, `office` (default `"Civilian"`), `sex` (0/1), `flag`, `faceurl` | profile fields. |
| `allianceid` (default -1), `alliancerank` (4 Host, 5 Vice Host, 6 Presbyter, 7 Officer, 8 Member) | alliance membership. |
| `prestigerank` | 1-based position in the prestige ranking (recomputed every 5 s). |
| `citylist`, `citycount`, `currentcityid`, `currentcityindex` | owned cities and the focused city. |
| `bufflist` (`{id, desc, endtime}`), `itemlist` (`{id, name, count, mincount, maxcount}`), `maillist`, `reportlist`, `packagelist`, `castlesignlist`, `research[25]` | collections. |
| `connected`, `socket`, `loggedin`, `debugmode`, `haschangedface`, `beginner`, `lastlogin`, `creation` | session and misc flags. |

All players that exist in the `accounts` table are **loaded into memory at startup**. Nearly all lookups
(`GetClient`, `GetClientByName`, `GetClientByParent`) are linear scans over the in-memory `players` list, so
**offline players count as "existing"**. A message sent to an offline player is silently discarded.
`SendObject(client, …)` does nothing unless `client` is non-null, `client->connected` is true and
`client->socket` is non-null.

---

## 1. Dispatcher (`request_handler::handle_request`)

1. Read `cmd` and split it on `"."`. `cmdtype = tokens[0]`. `command = tokens[1]` if present.
2. If `cmdtype != "login"` and either `cmdtype` or `command` is empty, log the problem and **drop the request
   silently**.
3. If the connection has a client and `client->debugmode` is true, first send that client
   `server.SystemInfoMsg` with `msg = <the full cmd string>` (see §14). This is the debug echo, toggled by the
   `\debug` chat command.
4. Route on `cmdtype`:

| cmdtype | handler | requires auth (`check()`) |
|---|---|---|
| `common` | pcommon | yes |
| `report` | preport | yes |
| `server` | pserver (no-op) | yes |
| `castle`, `field`, `alliance`, `tech`, `trade`, `shop`, `fortifications`, `troop`, `interior`, `hero`, `city`, `army` | other specs | yes |
| `quest` | pquest | yes |
| `login` | plogin | **no** |
| `rank` | prank | yes |
| `mail` | pmail | yes |
| `friend` | pfriend (no-op) | yes |
| `furlough` | pfurlough | yes |
| `gameClient` | pgameclient | **no** |
| anything else (`truce`, `gamemaster`, `stratagem`, typos, …) | punknown | **no** |

5. **Auth gate (`packet::check`)**: if the connection has no attached `Client`, it throws `2`. The dispatcher
   catches the int and **drops the request silently**. "Attached" means a `login` request on this connection
   reached the point where `conn.client_` was set, which includes the `-4 need create player` outcome. The
   `client->loggedin` flag is set but **never checked anywhere**.
6. Castle-id helpers used by some handlers:
   * `VERIFYCASTLEID()`: `data` must be an object containing `castleId`, otherwise throw `1` (silent drop).
   * `CHECKCASTLEID()`: if `data.castleId` is present and differs from `client->currentcityid`, throw `0`
     (silent drop).
7. Database exceptions and `std::exception` are logged and swallowed, so the client gets no response.
8. A packet's `city` is `client->citylist[client->currentcityindex]` when an index is set.

Transport notes (informational, not needed for REST/WS):
* Frames are a 4-byte big-endian length followed by an AMF3 object. Frames with size < 4 or
  ≥ `MAXPACKETSIZE` close the connection.
* A Flash cross-domain policy responder exists (`<policy-file-request/>` returns an allow-all policy for
  domain `*`, ports `*`), but its port-843 listener is commented out.

---

## 2. Persistence model (relevant tables)

### 2.1 Global DB (`dbmaintable`), table `account` (login identities)

| column | type | notes |
|---|---|---|
| id | uint PK | → `masteraccountid` |
| name | varchar(45) | always inserted as `'null'` |
| email | varchar(80) | the login user name (any string, not validated as an email) |
| ip | varchar(16) | inserted `''`, never updated |
| lastlogin, creation | double (ms) | set at insert, never updated |
| password | varchar(45) | **plaintext**, after `makesafe` |
| status | int | `-99` = banned globally |
| reason | varchar(45) | ban reason |

### 2.2 Server DB (`dbservertable`), table `accounts` (in-game player)

`accountid` PK, `parentid` (→ account.id), `username`, `lastlogin` double, `creation` double,
`ipaddress`, `status` int (`-99` = banned on this server), `reason`, `buffs` text, `sex`, `flag`
varchar(10), `faceurl` varchar(45), `research` text, `items` text, `allianceid`, `alliancerank`, `misc` text,
`cents` uint, `prestige` double, `honor` double, `changedface` tinyint, `icon` int, `allianceapply` text,
`allianceapplytime` int, `castlesign` text.

Serialized string formats (needed only for data migration; use proper columns or JSON in Postgres):
* `buffs`: repeated `"<id>,<desc>,<endtime>|"`.
* `items`: repeated `"<itemId>,<count>|"`, only for items with count > 0.
* `research`: 25 entries `"<i>,<level>,<castleid>,<starttime>,<endtime>|"`.
* `misc`: `"<icon>,<haschangedface>"`. **[BUG]** `icon` is `int8_t`, so it is written as a raw char, not
  digits. `ParseMisc` then sets `haschangedface = (bool)tokens[1].c_str()`, which is always **true** after a
  reload.
* `castlesign`: repeated `"<tileId>,"`.

`SaveToDB` updates: buffs, research, items, misc, status, ipaddress, sex, flag, faceurl, allianceid,
alliancerank, cents, prestige, honor, lastlogin, changedface, icon, allianceapply, allianceapplytime,
castlesign `WHERE accountid=?`. `username` and `creation` are never updated after insert.

### 2.3 `mail`

`id` PK auto, `content` varchar(1000), `senderid` int (0 = System), `title` varchar(45), `senttime` bigint ms,
`readtime` bigint ms (0 = unread), `receiverid` uint, `type` int (1 inbox, 2 system, 3 sent),
`pid` int (per-receiver mail id that the client sees as `mailid`).

### 2.4 `reports`

Columns in the dump: `id, accountid, reportid, guid, title, type_id, back, attack, armytype, startpos,
targetpos, eventtime, isread`.

**[BUG]** The code reads and inserts a column named `typeid`, which the schema does not have (it has
`type_id`). Reports are written **only at clean shutdown**: `TRUNCATE` followed by a re-insert of every
in-memory report. Report body content lives in a file `<reportbasepath><guid>.xml`, not in the DB.

### 2.5 `cities` (only what this spec touches)

`id` PK, `accountid`, `misc` (`"population,taxRate,foodRate,woodRate,ironRate,stoneRate,loyalty,grievance,lastResourceUpdateMs"`),
`fieldid` (tile id), `name`, `buildings` (`"type,level,position,status,start,end|…"`), `gold`, `food`, `wood`,
`iron`, `stone`, `creation`, `transingtrades`, `troop`, `fortification`, `trades`, `troopqueues`, `logurl`,
`status`, `allowalliance`, `gooutforbattle`, `hasenemy`.

### 2.6 When data is saved

There is **no periodic save** (the 3-minute timer is empty). Data is written by:
* explicit `SaveToDB()` calls in individual handlers (noted per command), and
* a full save at clean shutdown (players, cities, heroes, armies, reports).

The rewrite should write through to Postgres on every mutation.

---

## 3. `login`

**Request** `cmd: "login"`, `data`:

| field | type | meaning |
|---|---|---|
| user | string | login name (stored as `account.email`) |
| pwd | string | password (plaintext) |

Documented error codes (comment in source): `-5` captcha, `-99` general, `-100` holiday. `-2`, `-4` and `6`
are also used.

**Algorithm**

1. *(Disabled)* A server-full check (`maxplayers <= online+1`) exists but is commented out.
2. If this connection already has an attached client, send
   `ERR("server.loginResponse", -99, "Client already logged in.")` and stop. The cmd really has a lowercase
   `l`. **[BUG]** It should be `server.LoginResponse`.
3. `u = makesafe(user)` and `p = makesafe(pwd)`. `makesafe` replaces every char not in `[0-9A-Za-z_./:@|]`
   with a space.
4. **Auto-registration**: `SELECT COUNT(*) FROM account WHERE email=u`. If it is 0, run
   `INSERT INTO account (name,email,ip,lastlogin,creation,password,status,reason) VALUES ('null',u,'',now,now,p,0,'')`.
   Any unknown user name therefore creates an account with the given password.
5. `SELECT * FROM account WHERE email=u AND password=p`. If there is no row, send
   `ERR("server.LoginResponse", -2, "Incorrect account or password.")` to the connection and stop.
6. `masteraccountid = account.id`. Look up the in-memory client with `GetClientByParent(masteraccountid)`.
7. **Ban check**: `SELECT * FROM accounts WHERE parentid=masteraccountid`. The player is banned if
   `account.status == -99`, or if an `accounts` row exists with `status == -99`. If banned, send
   `ERR("server.LoginResponse", -99, "You are banned. Reason: " + (account.reason non-empty ? account.reason : accounts.reason))`
   and stop.
8. **Attach the client.**
   * **No in-memory client** (brand-new master account): `NewClient()` creates a `Client` with the
     defaults from the constructor, appends it to `players`, and sets `masteraccountid`, socket,
     `conn.client_` and `connected=true`. **[BUG]** `NewClient` returns null when
     `currentplayersonline >= maxplayers`, and the code dereferences it before the null check, so it crashes.
     `ipaddress`, `email` and `password` are **not** set on this path.
   * **Existing client** (every player loaded from DB at startup, or created earlier in this run):
     1. If `client.connected` is true, call `CloseClient(client, 3, "")`. This sends
        `server.ConnectionLost {reasonCode:3, msg:""}` to the **old** socket and closes it (§14).
        `connected` is never reset on disconnect, so after the first login of the process this always runs.
     2. Set `connected = true`.
     3. **Throttle**: if `now - client.lastlogin < 5000` ms, send
        `ERR("server.LoginResponse", 6, "You have tried logging in too frequently. Please try again later.")`
        to the new connection, close the new connection, and stop. The old session has already been kicked
        at this point.
     4. Set `lastlogin = now`. If a socket is still attached, `CloseClient(client,3,"")` again. Attach the new
        connection, and set `socknum` and `ipaddress = remote address`.
     5. Hard-coded admin hack: if `client.email == "Daisy"`, set `m_bdenyotherplayer = true` and `icon = 7`.
9. Query `accounts WHERE parentid=masteraccountid` again.
   * No row: send `ERR("server.LoginResponse", -4, "need create player")` and set `loggedin = true`. The client
     is now attached and must call `common.zoneInfo` and `common.createNewPlayer`.
   * Row exists: set `client.accountid = accounts.accountid`. Then `SELECT * FROM cities WHERE accountid=…`.
     * No cities (the player used "restart"): same `-4 need create player` error and `loggedin = true`.
     * Cities exist: continue with the next step.
10. **Debug giveaways (run on every login).** If the item count of `"consume.1.a"` (Speaker) is below 10000,
    `SetItem("consume.1.a", 10000)`, which pushes `server.ItemUpdate` **before** the login response.
    `client.cents = 5000` **unconditionally**. **[BUG]** Every login resets cents to 5000; this was a testing
    hack. Remove both.
11. Build the response: `data.packageId = 0.0` and `data.player = client.ToObject()` (the PlayerBean, §4).
12. If `client.citylist` is empty (DB has cities but memory has none), send
    `ERR("server.LoginResponse", -99, "Error with connecting. Please contact support.")` and stop.
13. Set `currentcityid = citylist[0].castleid`, `currentcityindex = 0`, `accountexists = true`.
14. **Holiday (furlough) check**: look up buff `"FurloughBuff"`.
    * If it exists and `endtime > now`: `secs = (endtime-now)/1000`, `h = secs/3600`, `m = secs/60 - h*60`,
      `s = secs - m*60 - h*3600` (all integer division). Set `data.ok = -100`, `data.msg = "<h>,<m>,<s>"` and
      `data.errorMsg` to the same string. The player data is still sent and the session stays logged in; the
      client is expected to offer `furlough.cancelFurlought`.
    * Otherwise set `data.ok = 1` and `data.msg = "success"`.
15. Send `{cmd:"server.LoginResponse", data}`.
16. `clientdelay = now - start`, `loggedin = true`, `currentplayersonline++`, `client.SaveToDB()`, then log the
    count of players that have a socket.

**Success response**

```
{ cmd: "server.LoginResponse",
  data: { packageId: 0.0, player: <PlayerBean §4>, ok: 1, msg: "success" } }
// holiday variant: ok: -100, msg: "H,M,S", errorMsg: "H,M,S"
```

No `server.LoginResponse` is sent after `common.createNewPlayer`; that command's own response carries the
PlayerBean.

---

## 4. PlayerBean (`Client::ToObject`) — full object tree

Sent as `data.player` in `server.LoginResponse` and `common.createNewPlayer`, and as `data.playerBean` in
`furlough.isFurlought`. Field names are exact, typos included.

| key | type | value |
|---|---|---|
| newReportCount_trade | int | always 0 (the counting code is commented out) |
| newMaileCount_system | int | unread mails with `type_id == 2` |
| newReportCount | int | always 0 |
| isSetSecurityCode | bool | false |
| mapSizeX, mapSizeY | int | `mapsize` (config; default 800) |
| newReportCount_other | int | always 0 |
| buffs | array<Buff> | §4.4 |
| gamblingItemIndex | int | 1 |
| changedFace | bool | `haschangedface` |
| castles | array<CastleBean> | one per city, `citylist[0..citycount-1]`, §4.2 |
| playerInfo | PlayerInfo | §4.1 |
| redCount | int | 0 |
| usePACIFY_SUCCOUR_OR_PACIFY_PRAY | int | 1 |
| newMaileCount_inbox | int | unread mails with `type_id == 1` |
| currentDateTime | string | server local time formatted `"YYYY.MM.DD HH.MM.SS"` (zero-padded, dots in the time part) |
| newReportCount_army | int | 0 |
| friendArmys | array<ArmyMovement> | `client.friendarmymovement`, §4.6 |
| saleTypeBeans | array | §4.7 |
| autoFurlough | bool | false |
| castleSignBean | array | `[{id: tileid, name, y, x}]` from `castlesignlist` (in the `castle.castleSignInfoArr` push, `id` is the castle id instead) |
| furloughDay | int | 0 |
| tutorialStepId | int | 0 (any tutorial step id can be set here) |
| newMailCount | int | total unread mails (all types) |
| furlough | bool | false, even while furlough is active |
| gameSpeed | int | 1 |
| enemyArmys | array<ArmyMovement> | `client.enemyarmymovement` |
| currentTime | number | now (ms) |
| items | array<Item> | §4.5 |
| freshMan | bool | false |
| finishedQuestCount | int | 0 |
| selfArmys | array<ArmyMovement> | `client.armymovement` |
| saleItemBeans | array | §4.8 |

### 4.1 PlayerInfo (`Client::PlayerInfo`)

Also pushed as `server.PlayerInfoUpdate {playerInfo}`.

| key | type | value |
|---|---|---|
| alliance | string | only when `allianceid > 0`: always `""` (real lookup commented out) |
| allianceLevel | int | only when in an alliance: always `0` |
| levelId | int | only when in an alliance: `alliancerank` |
| createrTime | number | `creation` (ms). It is 0 for players created in the current process run. |
| office | string | `"Civilian"` default |
| sex | int | 0/1 |
| honor | number | |
| bdenyotherplayer | int/bool | `m_bdenyotherplayer` |
| id | int | `accountid` |
| accountName | string | `email` (the login name, so this leaks it to the client) |
| prestige | number | |
| faceUrl, flag | string | |
| userId | int | `masteraccountid` |
| userName | string | `playername` |
| castleCount | int | `citycount` |
| medal | int | **`cents`** |
| ranking | int | `prestigerank` |
| titleId | int | `title` |
| lastLoginTime | number | `lastlogin` |
| population | int | sum of `m_population` over the cities. Side effect: it is stored into `client.population`. |

### 4.2 CastleBean (`PlayerCity::ToObject`)

Also used in `server.CastleUpdate {updateType:2, castleBean}`.

| key | value |
|---|---|
| buildingQueues | `[]` (always empty) |
| heros | array<Hero> (§4.3), non-null `m_heroes[0..9]` |
| status | `m_status` (int8) |
| allowAlliance | `false` (hard-coded, ignores `m_allowalliance`) |
| resource | Resources object (below) |
| logUrl | `m_logurl` (default `"images/icon/cityLogo/citylogo_01.png"`) |
| fieldId | tile id (`y*mapsize + x`) |
| usePACIFY_SUCCOUR_OR_PACIFY_PRAY | 1 |
| transingTrades | `[]` |
| troop | Troops object |
| id | castle id |
| name | city name |
| buildings | array<Building> |
| fortification | `{trap, rollingLogs, rockfall (=trebuchets), arrowTower, abatis}` |
| trades | `[]` |
| fields | `[]` |
| goOutForBattle | `false` |
| hasEnemy | `false` |

**Resources** (`PlayerCity::Resources`). Let `eff = m_productionefficiency/100` and
`mgmt = 1 + m_resourcemanagement/100` (`m_resourcemanagement` is always 0). Let `base = m_resourcebaseproduction`,
which is 100.

| key | value |
|---|---|
| maxPopulation | `m_maxpopulation` |
| taxIncome | `m_production.gold` (= population × taxRate/100) |
| support | `m_loyalty` |
| wood / stone / iron | `{amount, storeRercent:int(storepercent), workPeople:int(workpopulation), max:int(maxresources), increaseRate: production×eff×mgmt + base}` |
| food | same, but `increaseRate = production×eff×mgmt − m_troopconsume + base` |
| buildPeople | 0 |
| workPeople | `int(Σ workpopulation[r]×workrate[r]/100)` over food, wood, stone, iron |
| curPopulation | `m_population` |
| herosSalary | Σ hero.level × 20 |
| troopCostFood | `m_troopconsume` |
| gold | `m_resources.gold` |
| texRate | `int(m_workrate.gold)` (tax rate) |
| complaint | `m_grievance` |
| populationDirection | `target = int(maxPopulation × min(100, loyalty+grievance)/100)`. The value is -1 if population > target, 1 if population < target, otherwise 0. |

**Troops** (also used for injured troops and inside armies):
`{peasants, archer, catapult, ballista, scouter, carriage, heavyCavalry, militia, lightCavalry, swordsmen, pikemen, batteringRam}`.
The mapping is worker, archer, catapult, ballista, scout, transporter, cataphract, warrior, cavalry, sword,
pike, ram.

**Building** (inner buildings first, then outer buildings, only those with `type > 0`):
`{startTime, endTime, level, status, positionId, name, typeId}`. `name` comes from
`Utils::GetBuildingName`: 1 Cottage, 2 Barracks, 3 Warehouse, 4 Sawmill, 5 Stonemine, 6 Ironmine, 7 Farm,
20 Stable, 21 Inn, 22 Forge, 23 Marketplace, 24 Relief Station, 25 Academy, 26 Workshop, 27 Feasting Hall,
28 Embassy, 29 Rally Spot, 30 Beacon Tower, 31 Town Hall, 32 Walls, anything else `"Failed"`.
Inner positions are -2..31. Outer positions are 1001..1040 (`position-1000` is the index).

### 4.3 Hero (`Hero::ToObject`)

`{experience, id, itemAmount, level, logoUrl, loyalty, management, managementAdded, managementBuffAdded, name, power, powerAdded, powerBuffAdded, remainPoint, status, stratagem, stratagemAdded, stratagemBuffAdded, upgradeExp}`.
`itemId` is commented out. Hero status: 0 idle, 1 mayor, 3 attack, 4 seized, 5 returning.

### 4.4 Buff (`Client::BuffsArray`)

`{desc, endTime, id}`. The push form differs (§14 `server.PlayerBuffUpdate`).

### 4.5 Item (`Client::Items`)

`{id, count, minCount, maxCount}` for each owned item with `count > 0`. `minCount` and `maxCount` are always 0.

### 4.6 ArmyMovement (`stArmyMovement::ToObject`)

`{hero (name), direction (1 forward, 2 back, 3 stay), resource:{wood,food,stone,gold,iron}, startPosName, king, troop:<Troops>, startTime, armyId, reachTime, heroLevel, restTime, missionType (1 trans, 2 reinforce, 3 scout, 4 build city, 5 attack), startFieldId, targetFieldId, targetPosName}`.

### 4.7 saleTypeBeans (`Client::SaleTypeItems`)

Exactly 4 objects in this order. Each is `{typeName, items}`, where `items` is the `#`-joined list of
`config_items.name` values that have `buyable=1` and the given `itemtype`:

| order | typeName (UTF-8) | meaning | itemtype |
|---|---|---|---|
| 1 | `加速` | Speed up | 1 |
| 2 | `宝箱` | Chest | 2 |
| 3 | `生产` | Produce | 3 |
| 4 | `宝物` | Treasures/Items | 4 |

### 4.8 saleItemBeans (`Client::SaleItems`)

A fixed list of `{saleType, items}` entries:
`(1,"player.resinc.1")`, `(1,"player.resinc.2")`, `(1,"player.resinc.3")`, `(1,"player.resinc.4")`,
`(0,"consume.1.c")`, `(1,"consume.2.b.1")`, `(1,"player.gold.1.a")`, `(1,"consume.refreshtavern.1")`,
`(1,"consume.2.b")`, `(1,"consume.transaction.1")`.

---

## 5. `common.createNewPlayer`

**Request data**

| field | type | rule |
|---|---|---|
| captcha | string | read but ignored |
| faceUrl | string | length 1..30 |
| castleName | string | length 1..10 |
| flag | string | length 1..5 |
| sex | int | 0 or 1 |
| userName | string | length 1..20 |
| zone | int | 0..15 (state index, §5.3) |

**Algorithm**

1. If `client.accountid > 0 && client.citycount > 0`, return
   `ERR("common.createNewPlayer", -86, "City/Account exists.")`.
2. If any field rule fails, return `ERR("common.createNewPlayer", -87, "Invalid data sent.")`.
3. If `client.accountid == 0` (no `accounts` row yet): `SELECT * FROM accounts WHERE username = userName`
   (the raw name, not `makesafe`d). If a row exists, return `ERR(…, -88, "Player name taken")`.
   The name is not checked against in-memory players or case variants.
4. If `map.m_openflats[zone] == 0`, return `ERR(…, -25, "No open flats exist.")`.
5. Decrement `m_openflats[zone]`. **[BUG]** It is not restored on later failures.
   `tileId = map.GetRandomOpenTile(zone)` (§5.2).
6. If the tile's `m_type != FLAT(10)` or `m_ownerid != 0`, return
   `ERR(…, -25, "Error with account creation. #-25")`. **[BUG]** `GetRandomOpenTile` can return -1, which is
   then used as an array index.
7. Sanitize with `makesafe`: `user`, `castlename2`, `faceUrl2`, `flag2`.
8. If `client.accountid == 0`, insert the player row:
   `INSERT INTO accounts (parentid, username, lastlogin, creation, ipaddress, status, reason, sex, flag, faceurl, buffs, research, items, misc) VALUES (masteraccountid, user, now, now, client.ipaddress, 0, '', sex, flag2, faceUrl2, '', '', '', '')`.
   On failure return `ERR(…, -26, "Error with account creation. #-26")`.
   Set `client.accountid = LAST_INSERT_ID()`. If that is ≤ 0, return
   `ERR(…, -27, "Error with account creation. #-27")`.
   `cents`, `prestige` and `honor` take DB defaults (0).
9. `accountexists = true`.
10. Insert the city:
    `INSERT INTO cities (accountid, misc, fieldid, name, buildings, gold, food, wood, iron, stone, creation, transingtrades, troop, fortification, trades, troopqueues) VALUES (accountid, "50,10.000000,100.000000,100.000000,100.000000,100.000000,90,0,<now>", tileId, castleName /*raw, not makesafe'd*/, "31,1,-1,0,0.000000,0.000000", 100000,100000,100000,100000,100000, now, '', '', '', '', '')`.
    On failure return `ERR(…, -28, "Error with account creation. #-28")`.
11. Set `client.playername = user`, `flag = flag2`, `faceurl = faceUrl2`, `sex = sex`.
12. `castleId = LAST_INSERT_ID()`. If that is ≤ 0, return `ERR(…, -29, "Error with account creation. #-29")`.
    **[BUG]** The code then runs `client.accountid = castleId`, overwriting the player id with the city id.
    From then on in this process, the player's `id`, the city's `m_accountid` and the tile's `ownerid` all
    hold the castle id, and `client.SaveToDB()` updates the wrong row. A restart fixes it, because the
    `cities.accountid` column was written correctly. **Do not replicate this.**
13. `city = AddPlayerCity(client, tileId, castleId)` (§5.1).
14. `city.ParseBuildings("31,1,-1,0,0.000000,0.000000")`, `m_logurl = "images/icon/cityLogo/citylogo_01.png"`,
    `m_cityname = castlename2`, `client.currentcityid = castleId`, `city.m_creation = now`,
    `client.currentcityindex = 0`, `city.SetResources(100000 ×5)`, `city.CalculateResources()`,
    `city.CalculateStats()`.
15. Debug giveaway: Speakers `consume.1.a` are topped up to 10000 (this pushes `server.ItemUpdate`) and
    `cents = 5000`.
16. Recompute the rankings: `SortPlayers()`, `SortHeroes()`, `SortCastles()` (§10).
17. Send:
    ```
    { cmd: "common.createNewPlayer",
      data: { packageId: 0.0, ok: 1, msg: "success", player: <PlayerBean §4> } }
    ```
18. `connected = true` and repeat the Speaker top-up. `map.CalculateOpenTiles()`, `client.SaveToDB()`,
    `city.SaveToDB()`.

Not done: `client.creation` is not set (stays 0), `beginner` is not set and status is not
`DEF_BEGINNER`, the `tiles` DB row is not updated, and `currentplayersonline` is not incremented.

### 5.1 Initial city state (exact)

`AddPlayerCity(client, tileId, castleId)` does the following:
* Creates a `PlayerCity` with `m_type = CASTLE(11)`, `m_status = 0`, `m_tileid`, `m_castleid`,
  `m_accountid = client.accountid` and `m_client = client`.
* `SetBuilding(31, 1, -1, 0, 0, 0)` places a Town Hall at level 1 in inner position -1, which sets
  `city.m_level = 1`. `SetResources(0…)` runs and is then overwritten.
* `ParseMisc("50,10,100,100,100,100,90,0,<now>")` sets population 50, tax rate (`workrate.gold`) 10%,
  food/wood/iron/stone work rates 100%, loyalty 90, grievance 0 and `lastResourceUpdate = now`.
* Appends the city to `client.citylist`, increments `citycount`, and adds it to the global city list.
* Tile mutation: `m_npc=false`, `m_ownerid=client.accountid`, `m_city=city`, `m_type=CASTLE`,
  `m_castleid=castleId`.

Resulting starting state:

| aspect | value |
|---|---|
| Resources | gold 100000, food 100000, wood 100000, stone 100000, iron 100000 |
| Max storage (CalculateStats) | 10000 each for food, wood, stone and iron. With no farms or mines, starting resources exceed the cap, so production adds nothing until they drop below it. Nothing clamps them down. |
| Buildings | `[{typeId:31, name:"Town Hall", level:1, positionId:-1, status:0, startTime:0, endTime:0}]` |
| Population | 50. maxPopulation 50 (base 50 plus cottages: L1 +100, L2 +300, L3 +600, L4 +1000, L5 +1500, L6 +2100, L7 +2800, L8 +3600, L9 +4500, L10 +5500). |
| Production | Production buildings: farm 7, sawmill 4, stonemine 5, ironmine 6. Per level 1..10 each adds max +10k/30k/60k/100k/150k/210k/280k/360k/450k/550k, production +100/300/600/1000/1500/2100/2800/3600/4500/5500/h, and workers +10/30/60/100/150/210/280/360/450/550. Production is then × workrate/100. `production.gold = population × taxRate/100 = 5`. Efficiency is 100 if population ≥ workers, else population/workers×100. Base production of +100/h applies to every resource. |
| Resource tick | `add = (production + 100) × eff / 3.6e6 × (1+mgmt/100) × elapsedMs`, minus `troopconsume` for food. It only applies when `max > current`, and the result is capped at max. Gold adds `(production.gold − Σhero.level×20) × elapsedMs/3.6e6`, floored at 0. |
| Troops | all 0 |
| Fortifications | all 0 |
| Heroes | none (`heros: []`) |
| Items | `consume.1.a` (Speaker) × 10000 |
| Cents | 5000 |
| Buffs | none |
| Resources object as sent | maxPopulation 50, taxIncome 5, support 90, each of wood/stone/iron/food `{amount:100000, storeRercent:0, workPeople:0, max:10000, increaseRate:100}`, buildPeople 0, workPeople 0, curPopulation 50, herosSalary 0, troopCostFood 0, gold 100000, texRate 10, complaint 0, populationDirection -1 (target = 50×90/100 = 45 < 50) |

### 5.2 Map tile selection

* `Map.CalculateOpenTiles()` scans every tile. For each state it counts:
  * `occupiable`: tiles with `m_type >= FLAT(10)`.
  * `totalflats`: tiles with `m_type == FLAT`.
  * `openflats`: FLAT tiles with `m_ownerid == 0`. Their ids are pushed to `m_openflatlist[state]`.
  * `occupied`: all other occupiable tiles, plus owned flats.
  * `cities`: tiles with `m_type == CASTLE(11)`.
  * `npcs`: other non-flat occupiable tiles.

  Stats per state: `numbercities = cities + npcs`, `playerrate = int(occupied/occupiable×100)`,
  `players = cities`.
* `GetRandomOpenTile(zone)`: if the list is empty, return -1. Otherwise pick a uniformly random index into
  `m_openflatlist[zone]`, remove that entry and return the tile id.
* Tile id is `y*mapsize + x`, so `x = id % mapsize` and `y = id / mapsize`.
* **[BUG]** `CalculateOpenTiles` runs at startup **before** the player cities are loaded, and creating a city
  never updates the `tiles` table. After a restart, existing player cities can be counted as open flats until
  the next `createNewPlayer`, and a pick can land on an occupied tile (→ `-25`). Intended behaviour: open
  tiles are FLAT tiles with no owner and no city, derived from authoritative DB state, and the tile's
  ownership is persisted on city creation.

### 5.3 States (zones)

The map is split into a 4×4 grid of equal quarters. `col = x < N/4 ? 0 : x < N/2 ? 1 : x < 3N/4 ? 2 : 3`,
the same rule gives `row` from `y`, and `state = row*4 + col`. Names by index:
0 FRIESLAND, 1 SAXONY, 2 NORTH MARCH, 3 BOHEMIA, 4 LOWER LORRAINE, 5 FRANCONIA, 6 THURINGIA, 7 MORAVIA,
8 UPPER LORRAINE, 9 SWABIA, 10 BAVARIA, 11 CARINTHIA, 12 BURGUNDY, 13 LOMBARDY, 14 TUSCANY, 15 ROMAGNA.

---

## 6. Other `common.*` commands

### 6.1 `common.zoneInfo`

Request data is unused. Response:
```
{ cmd:"common.zoneInfo", data:{ packageId:0.0, ok:1,
  zones:[ {id:i, rate:playerrate, name:stateName, playerCount:stats.players, castleCount:stats.numbercities} ×16 ] } }
```
The stats are only recomputed at startup and after each `createNewPlayer` / `city.advMoveCastle`.

### 6.2 `common.mapInfoSimple`

Request `{x1, x2, y1, y2, castleId}`. `castleId` is ignored. The response is
`{cmd:"common.mapInfoSimple", data: GetTileRangeObject(...)}`. If that function throws, `data` is `{}`.

`data` always starts with `{x1, x2, y1, y2}` (the request values as given). Then:
1. If `x1 > x2` or `y1 > y2`: `ok:-1, errorMsg:"Error retrieving results. x1", packageId:0.0`.
2. Wrap normalization per axis (N = mapsize): if `|a1| ≥ N` and `|a2| ≥ N`, both become `a % N`; else if
   `|a2| ≥ N`, then `a1 -= N` and `a2 %= N`.
3. If after normalization `x1 < 0` or `y1 < 0` (wrap-around request):
   `dx = (x1<0 && x2>=0) ? |x1|+x2 : x2-x1`, and `dy` the same way. If `dx > 20`, `dy > 20`, `dx ≤ 0` or
   `dy ≤ 0`, return `ok:-1, errorMsg:"Out of range.", packageId:0.0`. Otherwise iterate
   `y = y1..y1+dy`, `x = x1..x1+dx`, with negative coordinates wrapped by +N.
4. Otherwise, if `x2-x1 > 20` or `y2-y1 > 20`, return "Out of range." (same shape). Otherwise iterate
   `y1..y2` × `x1..x2` inclusive. The maximum is 21×21 tiles.
5. For each tile, row-major (y outer, x inner):
   * Append two chars to `mapStr`: `hex(type)` then `hex(level)`. For `type > 10` (CASTLE 11 or NPC 12), the
     level is the city's `m_level` (Town Hall level). `hex` maps 0..15 to `0-9a-f`; any other value becomes
     a NUL char. **[BUG]** Levels above 15 corrupt the string.
   * If `type > 10`, add a castle object to `castles`:
     `{id: tileId, name: city.name, state: city.m_status, npc: true}` for NPC cities. For player cities:
     `{id, name, prestige, honor, userName, flag, [changeface — only in the wrap-around branch],
     [allianceName if allianceid>0 — from client.alliancename], canLoot, canOccupy, canScout, canSend,
     canTrans, playerLogoUrl: faceurl, relation, state: client.status, zoneName: stateName,
     furlough: client.beginner, npc: false}`.
     * **[BUG]** `relation` is hard-coded to `0`, which is `DEF_ALLIANCE`. Every player castle is therefore
       sent with `canLoot/canOccupy/canScout=false, canSend/canTrans=true, relation:0`.
     * Intended relation mapping: self (5), ally (1) and alliance (0) give `{false,false,false,true,true}`;
       enemy (3) gives `{true,true,true,true,true}`; neutral (2), none (4) and default give
       `{true,true,true,false,false}`.
6. `data.castles`, `data.mapStr`, `data.ok = 1`, `data.packageId = 0.0`.

Tile type codes: 1 forest, 2 desert, 3 hill, 4 swamp, 5 grass, 6 lake, 10 flat, 11 castle, 12 NPC.

### 6.3 `common.getPackage` [GAP]

Request: `ruleId` (package id), `serial` (empty string). **[BUG]** The code reads them from `obj` instead of
`data`, and does nothing with them. It always responds `{cmd:"common.getPackage", data:{packageId:0.0, ok:1}}`.

### 6.4 `common.getPackageList` [GAP]

Response: `{packages: client.Packages(), packageId:0.0, ok:1}`. `packagelist` is never populated, so this is
always `[]`. Package object shape:
`{desc, packageName, status, type, minMedal, maxMedal, id, isUseNow, scores, provideTime, expiredTime, claimedTime, itemList:[{id, count, name, minCount, maxCount}]}`.
**[BUG]** Every numeric field is filled with `package.id`. The intended source fields are:
status ← status (4 = unclaimed?, 2 = claimed?), type ← type, minMedal and maxMedal, isUseNow, scores,
providetime, expiredtime, claimedtime (string).

### 6.5 `common.getPackageNumber` [GAP]

Response `{packageId:0.0, ok:1, number:0}` (the number of unclaimed packages, always 0).

### 6.6 `common.changeUserFace`

Request `{faceUrl: string, sex: int}`.
* If `haschangedface` is already true, or `faceUrl.length > 30`, or `sex ∉ {0,1}`, return
  `ERR("common.changeUserFace", -99, "Invalid setting.")`.
* Otherwise set `faceurl`, `sex`, `haschangedface = true`, call `SaveToDB()`, and respond
  `{packageId:0.0, ok:1, msg:"头像设置成功"}` ("avatar set successfully", UTF-8).
* faceUrl is not otherwise validated, so any URL is accepted (TODO in source). Combined with the
  `ParseMisc` bug (§2.2), nobody can change their face after a server restart.

### 6.7 `common.delUniteServerPeaceStatus`

Sets `client.status = 0` (NORMAL) and calls `SaveToDB()`. Response `{packageId:0.0, ok:1, number:0}`.

### 6.8 `common.getItemDefXml`

1. Push `server.SystemInfoMsg` with
   `msg = "<font color='#00A2FF'>Welcome to EPS! There are currently <u>{N}</u> players online.</font>"`,
   where N is the number of players with a socket.
2. Respond `{ok:1, packageId:0.0, itemXml:<static XML string — Appendix A>}`.

### 6.9 `common.setSecurityCode` [GAP]

Reads `data.code` and does nothing **(no response)**.

### 6.10 `common.deleteUserAndRestart` [GAP]

Reads `data.pwd`. Nothing is deleted. The planned work in comments: send enemy armies back, send reinforcing
alliance armies back, notify enemies, clear mail and reports, delete cities, and keep the `accounts` row so
login returns `-4`.
**[BUG]** The response's `cmd` is never set (the code writes `obj["cmd"]` on the *request*), so it sends
`{cmd:"", data:{packageId:0.0, ok:0}}`. Intended: `{cmd:"common.deleteUserAndRestart", data:{packageId:0.0, ok:1}}`,
after which the client returns to the login screen.

### 6.11 Unhandled `common.*` (no response)

These are known to the client but have no code: `CbUD`, `cancelOnlineBonus`, `changeName`, `denyPlayerSpeak`,
`getOnlineBonus`, `getPlayerInfoByName`, `mapCastle`, `mapInfo`, `refreshCaptcha`, `step`,
`authSecurityCode`, `cancelRemovingSecurityCodeProcess`, `changeSecurityCode`, `getIsSecurityCodeSetted`,
`getProtectOption`, `removeSecurityCode`, `setProtectOption`, `setUnlockOption`. Related pushes exist in the
client protocol (`server.OnlineBonus`, `server.SecurityCodeRemovedEvent`, `server.ChangeName`,
`server.CbUpdate`) but the server never sends them.

---

## 7. Chat

Common push fields: `languageType: 0`, `ownitemid: sender.icon`, `fromUser: sender.playername`.
Message text is **not sanitized** (HTML is rendered by the client). Chat does **not** consume Speaker items
(`consume.1.a`). Real Evony charged 1 Speaker per world message and 2 per group message; that is [GAP].

### 7.1 `common.worldChat`

Request `{msg}`.
1. Ack: `{cmd:"common.worldChat", data:{packageId:0.0, ok:1}}`.
2. Build `server.ChannelChatMsg {msg, languageType:0, ownitemid, fromUser, channel:"world"}`. `msg` is wrapped
   as follows:
   * Sender's `prestigerank == 1`: `<font color="#FF0000">` + msg + `</font>`.
   * Otherwise, sender's alliance has `m_prestigerank == 1`: `<font color="#0066FF">` + msg + `</font>`.
   * Otherwise the raw msg.
3. If `ParseChat(sender, msg)` returns true (not a command), send the push to **every** player, sender
   included (offline players are skipped by SendObject).

### 7.2 `common.channelChat` (beginner channel)

Request `{msg, sendMsg}`. The ack is `{cmd:"common.channelChat", data:{msg: data.msg, ok:1, channel:"beginner"}}`,
with no packageId. The push and the command parse use **`sendMsg`**:
`server.ChannelChatMsg {msg (colour-wrapped as in 7.1), languageType:0, ownitemid, fromUser, channel:"beginner"}`.
It is broadcast to all players if not a command. There is no beginner-only filtering.

### 7.3 `common.allianceChat`

Request `{msg}`.
* If `allianceid <= 0`, return
  `ERR("common.allianceChat", -99, "To send an alliance message, you must be a member of an alliance")`.
* Ack `{msg, ok:1, channel:"alliance"}`.
* Push `server.AllianceChatMsg {msg (no colouring), languageType:0, ownitemid, fromUser, channel:"alliance"}`
  to every member of the alliance (`GetClient(member.clientid)`), sender included, if `ParseChat` returns true.
* **[BUG]** A null alliance object (stale `allianceid`) crashes.

### 7.4 `common.privateChat`

Request `{targetName, msg}`.
* Target is `GetClientByName(targetName)` (exact, case-sensitive). If not found, return
  `ERR("common.privateChat", -41, "Player " + targetName + " doesn't exist.")`.
* Ack `{msg, packageId:0.0, ok:1}`.
* Push to the target: `server.PrivateChatMessage {msg, chatType:0, ownitemid, fromUser}`. If the target is
  offline, it is silently lost.
* No `ParseChat`, no block list (friend/block is unimplemented), no self-check.

### 7.5 `ParseChat(client, str)` — slash (backslash) commands

* Returns **true** (broadcast normally) unless `str` is non-empty **and starts with a backslash `\`**.
  Commands use `\`, not `/`.
* Copies at most the first 200 bytes. **[BUG]** If the length is ≥ 200, the copy has no NUL terminator.
* `command` is the first token, split on `\` and space. If there is no token, return false: no broadcast and no
  reply.
* Prepares a reply `server.SystemInfoMsg {alliance:false, tV:false, noSenderSystemInfo:true, msg:<set per command; may be absent>}`.
  After the command it **always sends that reply to the issuer** (even with no `msg` key) and returns false,
  so command text is never broadcast. The early returns for "Invalid syntax" send the reply and return false.

| command | permission | effect | reply msg |
|---|---|---|---|
| `\motd` | none | If `allianceid <= 0` or `alliancerank < 3`, set the error message. Otherwise do nothing [GAP: set alliance MOTD]. **[BUG]** Ranks are 4..8, so `<3` never blocks members. | `"You do not have an alliance or are not the proper rank."` or none |
| `\restart` | `playername == "Daisy"` | `CloseClient(every player, 1, "")`, then server `Shutdown()` (saves all) | none |
| `\online` | none | Also sends a separate SystemInfoMsg (`noSenderSystemInfo:false`): `"<font color='#00A2FF'>There are currently <u>{N}</u> players online.</font>"` | none |
| `\debug` | none | Toggles `client.debugmode` (dispatcher echoes every received cmd name back as a SystemInfoMsg) | none |
| `\massmsg <text>` | `playername == "Daisy"` | `text` is everything after `"\massmsg "` (assumes exactly one leading `\` and one space). Every `&lt;` becomes `<`. `MassMessage(text)` sends `server.SystemInfoMsg {alliance:false, tV:false, noSenderSystemInfo:false, msg:text}` to all players. | none |
| `\cents` | **none [BUG: cheat]** | `cents += 50000`, push `server.PlayerInfoUpdate` | `"50000 Cents granted."` |
| `\resources` | **none [BUG: cheat]** | Focused city resources += 10,000,000 each of gold, food, wood, stone and iron. Push `server.ResourceUpdate`. | none |
| `\tempvar <n>` | none | `client.icon = atoi(n)` (chat icon). **[BUG]** A missing argument crashes. | `"Tempvar set to '<u>n</u>'."` |
| `\kick <code>\|<message>` | none | Parses an int code (delims ` \|`) and a message (delim `\|`). **[BUG]** Calls `CloseClient(issuer, code, message)`, which kicks **yourself**; there is no target argument. | Missing parts: `"Invalid syntax"` |
| `\buff <id> <desc> <ms>` | **none [BUG: cheat]** | `SetBuff(id, desc, now + atoi(ms))` (push `server.PlayerBuffUpdate`). `desc` cannot contain spaces. | `"Buff set to '<u>id</u>'."`; missing parts: `"Invalid syntax"` |
| `\commands` | none | Does nothing. A second, unreachable branch would reply `"Commands: motd cents resources"`. | none |
| anything else | — | — | `"Command '<u>X</u>' does not exist."` |

Recommendation for the rewrite: gate admin commands on a real role flag, not on the name "Daisy", and remove
the cheats or put them behind the GM role.

---

## 8. Mail (`mail.*`)

In-memory record `stMail {mailid (per-receiver pid), playerid (sender accountid, 0 = System), type_id, title, content, senttime, readtime}`.
`isRead = readtime > 0`. Type ids: 1 INBOX, 2 SYSTEM, 3 SENT.

At startup, each player's `maillist` is loaded with `SELECT * FROM mail WHERE receiverid=<accountid>` (no
ORDER BY; insertion order), and `mailpid = max(pid)+1` (minimum 1). New mail is appended at the end, and
listing iterates newest-first (reverse).

### 8.1 `mail.receiveMailList`

Request `{pageSize:int, type:int, pageNo:int}`.
1. If `pageNo == 0`, use `pageNo = 1`.
2. `count` = number of mails with `type_id == type`.
3. If `pageSize ∉ [1,20]` or `pageNo ∉ [0,100000]`, return `ERR("mail.receiveMailList", -99, "Invalid data.")`.
4. If `(pageNo-1)*pageSize > maillist.size()`, return `ERR(…, -99, "Invalid page.")`. **[BUG]** This uses the
   total of all types; intended `> count`.
5. Page = filter by type, order newest-first, slice `[(pageNo-1)*pageSize, pageNo*pageSize)`.
6. `totalPage = ceil(count/pageSize)` (0 when there is no mail).

Response:
```
{ cmd:"mail.receiveMailList", data:{ packageId:0.0, ok:1, pageNo, pageSize, totalPage,
  mails:[ { sender, playerId, mailid, selected:false, title, receiver, receiveTime, targetId, type_id, isRead } ] } }
```
* `sender` is `"System"` when `playerid == 0`, otherwise the sender's playername. **[BUG]** A null sender
  crashes.
* `playerId` is the sender's accountid, or the reader's accountid for System mail.
* `receiver` is the reader's playername, `receiveTime` is `senttime`, `targetId` is the reader's accountid,
  `isRead` is a bool.

### 8.2 `mail.readMail`

Request `{mailId}`. Find the mail by `mailid` in the reader's list. If not found → **(no response)**.
1. Set `readtime = now` (always overwritten, even if already read).
2. Push `server.NewMail` (§14) **before** the response.
3. Response (no packageId):
   ```
   { cmd:"mail.readMail", data:{ sender, targetId, content, mailid, title, receiver, receiveTime, playerId, ok:1, type_id, isRead:true } }
   ```
   * `sender` and `targetId` are the sender's name and accountid, or `"System"` and the reader's accountid.
   * `receiver` is the reader's name, `playerId` is the reader's accountid, `receiveTime` is `senttime`.
4. DB: `UPDATE mail SET readtime=? WHERE pid=? AND receiverid=? LIMIT 1`.

### 8.3 `mail.sendMail`

Request `{username, title, content}`.
1. (Commented out: self-mail check `ERR(-21, "invalid mailing operation.")`.)
2. `target = GetClientByName(username)`. If not found, return
   `ERR("mail.sendMail", -41, "Player " + username + " doesn't exist.")`.
3. If `CreateMail(sender.playername, username, title, content, 1)` fails, return
   `ERR("mail.sendMail", -42, "Error sending mail")`.
4. Response `{packageId:0.0, ok:1}`, then push `server.NewMail` to the sender and then to the target.

There is no length validation (the DB has title 45 and content 1000) and no block-list check.

**`CreateMail(sender, receiver, subject, content, type)`**:
* Both are resolved by name. Fail if the receiver is missing, or the sender is missing and is not
  `"System"`. `playerid = sender=="System" ? 0 : snd.accountid`.
* Receiver copy: `mail{content, title, type_id:type, senttime:now, mailid: rcv.mailpid, playerid}` is appended
  to `rcv.maillist`. `INSERT INTO mail (senderid, receiverid, title, content, senttime, type, pid) VALUES (playerid, rcv.accountid, subject, content, now, type, rcv.mailpid)`,
  then `rcv.mailpid++`.
* If the sender is System, stop and return true.
* Sent copy, intended for the sender's "Sent" folder: `{type_id: MAIL_SENT(3), mailid: snd.mailpid, playerid, readtime: now}`.
  **[BUG]** It is appended to **rcv**.maillist and inserted with `receiverid = rcv.accountid` and
  `type = <type>` (not 3), with `pid = snd.mailpid`. `snd.mailpid++`.
  * Effects: the receiver sees the mail in their Sent folder; the sender has no Sent copy; after a restart the
    receiver has two inbox copies and possible pid collisions.
  * Intended: append to `snd.maillist` and insert `(senderid=playerid, receiverid=snd.accountid, type=3, readtime=now, pid=snd.mailpid)`.
    `receiveMailList` then shows the sent copy with `sender` = the sender's own name, while `receiver` shows
    the reader's (own) name. The original client protocol has no "to" field.

The system uses `CreateMail("System", name, "Beginner's Protection Expired", <long text>, MAIL_SYSTEM)` when
Town Hall reaches level 5 (owned by the building spec).

### 8.4 `mail.reportBug`

Request `{subject, content}`. Nothing is stored [GAP]. Response `{errorMsg:"success", packageId:0.0, ok:1}`.

### 8.5 Unhandled (no response)

`mail.deleteMail`, `mail.readOverMailList` (mark several as read), `mail.getAllTVMsg`, `mail.reportPlayer`.
Intended: `deleteMail` and `readOverMailList` likely take an id list like reports (`idStr` / `mailIds`
comma-separated) and respond `{packageId:0.0, ok:1}`, then push `server.NewMail`.

---

## 9. Reports (`report.*`)

Record `stReport {reportid (per-player session counter starting at 1, NOT persisted), armytype (mission type), back:bool, attack:bool, type_id (0 trade, 1 army, 2 other), startpos (string e.g. "Name (x,y)"), targetpos, title, guid (28-char random), eventtime (ms), isread}`.
New reports are inserted at the **front** of the list, so the list is newest-first. Report bodies are XML
files at `reportbasepath + guid + ".xml"`; the XML root is
`<reportData reportUrl="<reportbaseurl><guid>.xml">…`. Generation belongs to the army/battle spec.
Because `reportid` is re-numbered at every server start, ids are not stable across restarts. The rewrite
should use the DB id.

### 9.1 `report.receiveReportList`

Request `{pageSize, reportType, pageNo}`.
1. If `pageNo == 0`, use `pageNo = 1`. `count` = reports with `type_id == reportType`.
2. If `pageSize ∉ [1,1000]` or `pageNo ∉ [0,100000]`, return `ERR("report.receiveReportList", -99, "Invalid data.")`.
3. If `(pageNo-1)*pageSize > count`, return `ERR(…, -99, "Invalid page.")`.
4. Filter by type in list order (newest first) and slice the page. `totalPage = ceil(count/pageSize)`.

Response: `{packageId:0.0, ok:1, pageNo, pageSize, totalPage, reports:[ReportBean]}`, where
`ReportBean = {id, selected:false, title, startPos, back, attack, targetPos, eventTime:number, type:type_id, armyType, isRead, content:{} (empty object)}`.

### 9.2 `report.markAsRead` (open a report)

Request `{reportId:int}`. Find the report with this id (the last match wins). If none, return
`ERR("report.markAsRead", -99, "Invalid report id.")`.
Response `{ok:1, packageId:0.0, report: ReportBean}`, where `isRead` is the value **before** this call and
`content` is the full XML text read from the file (`""` if the file is missing). Then set `isread = true` and
push `server.NewReport`.

### 9.3 `report.readOverReport` (bulk mark read)

Request `{reportIds: string}` such as `"12,15,16"`. Parsing: repeatedly `strtol`. After each number, stop if
at the end of the string, otherwise skip exactly one separator char. A parsed value of 0 (garbage or empty
segment) returns `ERR("report.readOverReport", -99, "Invalid report id.")`, but ids before it have already
been applied (partial effect). Unknown ids are ignored. An empty string is a no-op. Each found report gets
`isread = true`. Response `{packageId:0.0, ok:1}`, then push `server.NewReport`.

### 9.4 `report.deleteReport`

Request `{idStr: string}`, with the same parsing and partial-failure semantics, and error
`ERR("report.deleteReport", -99, "Invalid report id.")`. Each found report is removed from memory. The XML
file is not deleted and the DB is not touched until the shutdown snapshot. Response `{packageId:0.0, ok:1}`,
then `server.NewReport`.

---

## 10. Rankings (`rank.*`)

### 10.1 Ranking lists (recomputed every 5 s by the timer, and at startup/createNewPlayer)

`SortPlayers()` takes **every** in-memory Client, including clients with no player or city yet (named
`"Testname"`) **[BUG]**. It builds 5 lists sorted **descending** with a stable sort. Ties keep `players`
order, which is accounts loaded by accountid ASC and then newly created ones. Ranks are assigned 1..N with no
shared ranks.

| list | key |
|---|---|
| prestige | `client.prestige`. Side effect: `client.prestigerank = rank` and a `server.PlayerInfoUpdate` push to each connected player **every 5 s**. |
| honor | `client.honor` |
| title | `client.title` (never changes from 0) |
| population | `client.population` (cached; updated by PlayerInfo and CalculateResources) |
| cities | `client.citycount` |

`SortHeroes()`: one entry per hero in `city.m_heroes[0..9]` of every city.
`{grade: level, stratagem, management, power (base stats, not including Added/BuffAdded), name, kind: owner playername}`.
Lists by stratagem, power, management and grade, each descending.

`SortCastles()`: one entry per city.
`{level: TownHall level, population: city.m_population, name: city name, grade: "Level <n>", alliance: owner's alliance name or "", kind: owner playername}`.
Lists by level and by population, descending.

`AllianceMgr.SortAlliances()`: per alliance, `members = m_members.size()`,
`prestige = Σ member.prestige`, `honor = Σ member.honor`, and `m_allicitycount = Σ member city counts`.
Lists:
* members-desc. **[BUG]** It is pre-sorted by prestige through a union aliasing members; tie-break is
  effectively undefined. Intended: members desc, then prestige desc.
* prestige-desc. Also writes `alliance.m_prestigerank` and `m_prestige`.
* honor-desc. Also writes `m_honorrank` and `m_honor`.

### 10.2 Common request/paging semantics

Request `{pageSize:int, key:string, sortType:int, pageNo:int}`.
1. If `pageSize ∉ [1,20]` or `pageNo ∉ [0,100000]`, return `ERR(<cmd>, -99, "Invalid data.")`.
2. If `key` is non-empty, replace the list with the **search result** (§10.3).
3. If `(pageNo-1)*pageSize > list.size`, return `ERR(<cmd>, -99, "Invalid page.")`. Because of a
   signed/unsigned comparison, `pageNo = 0` always returns "Invalid page." here, so pages start at 1.
   A page exactly at the end returns empty `beans`.
4. Skip `(pageNo-1)*pageSize` entries and take up to `pageSize`.
5. Response `{packageId:0.0, ok:1, pageNo, pageSize, totalPage: ceil(size/pageSize), beans:[…]}`.
   `ranking`/`rank` in each bean is the entry's **global** rank in the chosen list, even for search results.

### 10.3 Search (`DoRankSearch`)

* Case-insensitive substring match (`ci_find`) of `key` against playername (players), hero name (heroes),
  castle name (castles) or alliance name (alliances).
* Results are cached per `(source list, exact key string)`. A cached hit is returned unchanged.
  `lastaccess` is set at creation and **not** refreshed on hits.
* `CheckRankSearchTimeouts` (every 60 s) drops player, hero and castle search caches older than 30 s.
  **[BUG]** Alliance search caches are never evicted, so results are frozen forever and memory leaks.
* Intended for the rewrite: compute the search live, or cache for ≤ 30 s.

### 10.4 `rank.getPlayerRank`

`sortType`: 1 title, 2 prestige, 3 honor, 4 cities, 5 population, other → prestige.
Bean:
```
{ createrTime:0, [alliance: allianceName, allianceLevel: rankName, levelId: alliancerank]  // only if allianceid>0
  office, sex, honor, bdenyotherplayer, id: accountid, accountName:"", prestige, faceUrl, flag,
  userId: masteraccountid, userName, castleCount: citycount, titleId: title, medal:0, ranking: rank,
  lastLoginTime:0, population }
```
`rankName` (`AllianceMgr::GetAllianceRank`): 4 "Host", 5 "Vice Host", 6 "Presbyter", 7 "Officer",
8 "Member", other "No Rank".

### 10.5 `rank.getAllianceRank`

**[BUG]** The handler first sends `{cmd:"rank.getAllianceRank", data:{packageId:0.0, ok:1, beans:[]}}`, then
sends the real response, so there are two messages.
`sortType`: 1 members, 2 prestige, 3 honor, other → members.
Bean: `{member: m_currentmembers, prestige: m_prestige, rank, playerName: m_owner, honor: m_honor, description: m_intro, createrName: m_founder, name, city: m_allicitycount}`.

### 10.6 `rank.getHeroRank`

`sortType`: 1 grade (level), 2 management, 3 power, 4 stratagem, other → grade.
Bean: `{rank, stratagem, name, power, grade, management, kind}` (`kind` is the owner player name).

### 10.7 `rank.getCastleRank`

`sortType`: 1 population, 2 level, other → population.
Bean: `{alliance, rank, level, name, grade, kind, population}`.

---

## 11. Quests (`quest.*`) — placeholder implementation

`config_quests` exists in the DB (`id, mainId, isFinish, description, name, typeId, prereqbuilding, prereqitem, prereqtech, prereqquest`)
but is **unused** [GAP].

### 11.1 `quest.getQuestType`

The client polls this about every 3 minutes. Request `{castleId, type}`. `castleId` is required
(VERIFYCASTLEID; silent drop if absent) but ownership is not checked.
* `type == 1` (main quests): `types = [ {description:"Rebuild", mainId:1, isFinish:false, name:"Rebuild", typeId:66}, {description:"Domain Expansion", mainId:1, isFinish:false, name:"Domain Expansion", typeId:72} ]`.
* `type == 3` (dailies): `types = [ {description:"Daily Gift", mainId:3, isFinish:false, name:"Daily Gift", typeId:94} ]`.
* Any other type: **(no response)**.

Response `{cmd:"quest.getQuestType", data:{ok:1, packageId:0.0, types}}`.

### 11.2 `quest.getQuestList`

Request `{castleId, …}` (`castleId` required; the quest `typeId` is not read). It always returns one dummy
quest:
```
{ ok:1, packageId:0.0, quests:[ { description:"quest.getQuestList DESCRIPTION", manual:"WIN THE GAME LA",
  isCard:false, isFinish:false, name:"CHAMPION OF SERVERS", award:"Gold 187,438,274,822,314",
  targets:[ {name:"Winning the game.", finished:false} ], questId:63 } ] }
```
The bean shape is the useful part:
`{description, manual, isCard, isFinish, name, award (display string), targets:[{name, finished}], questId}`.

### 11.3 Unhandled (no response)

`quest.award`, `quest.awardPacket`, `quest.getAwardItems`. The pushes `server.QuestFinished` and
`server.NewFinishedQuest` are never sent. `finishedQuestCount` in the PlayerBean is always 0.

---

## 12. Furlough (holiday) and truce

### 12.1 `furlough.isFurlought` (start holiday)

Request `{playerId:int (ignored), password:string, isAutoFurlough:bool (ignored), day:int}`.
1. If `client.password != password` (raw comparison, not makesafe'd), return
   `ERR("furlough.isFurlought", -50, "Incorrect account or password.")`. **[BUG]** `client.password` is only
   loaded at server start, so players who registered during the current run have an empty password here.
2. If `client.cents < day*10`, return `ERR("furlough.isFurlought", -99, "Not enough cents.")`. **[BUG]**
   `day` is not validated, so `day ≤ 0` is accepted and a negative value adds cents.
3. Subtract `day*10` cents. `SetBuff("FurloughBuff", "", now + day*86_400_000)`, which pushes
   `server.PlayerBuffUpdate`.
4. Response `{cmd:"furlough.isFurlought", data:{packageId:0.0, ok:1, playerBean: <PlayerBean §4>}}`.
   No SaveToDB.

Not done: `status` is not set to HOLIDAY(5), the session is not disconnected, and nothing protects cities
from attack (protection would belong to the battle code). The effect visible here is the login-time `-100`
response (§3 step 14).

### 12.2 `furlough.cancelFurlought`

`SetBuff("FurloughBuff", "", 0)` sets the end time to 0 and pushes `server.PlayerBuffUpdate` with endTime 0.
The 5-second timer later removes it with `server.PlayerBuffUpdate updateType:1`. Response
`{packageId:0.0, ok:1}`. `SaveToDB()`.

### 12.3 Buff expiry (timer, every 5 s)

For each buff with `now > endtime`:
* If its id is `"PlayerPeaceBuff"`, first `SetBuff("PlayerPeaceCoolDownBuff", "Truce Agreement in cooldown.", now + 12h)`.
* Then `RemoveBuff(id)`, which pushes `server.PlayerBuffUpdate {buffBean, updateType:1}`.

### 12.4 `truce.*` [GAP]

`truce.setDreamTruce`, `truce.cancelDreamTruce` and `truce.changeDreamTruceTime` have no handler. They fall
through to `punknown` (§13.4). The real truce is implemented elsewhere: `city.setStopWarState` and items set
`status = TRUCE(2)` and the `PlayerPeaceBuff` (12 h). See the city/shop spec.

---

## 13. Misc command groups

### 13.1 `friend.*` [GAP]

`pfriend::process` is empty, so `friend.addFriend`, `friend.deleteFriend`, `friend.addBlock`,
`friend.deleteBlock` and `friend.isBlockMailPlayer` get **no response**. There are no friend or block data
structures anywhere.

### 13.2 `server.*` (sent by client)

Accepted (auth required), but nothing is done and **no response** is sent.

### 13.3 `gameClient.version`

The request `data` is a **string** (the client build id), no auth required.
* If it equals `"091103_11"`: nothing is sent.
* Otherwise: `{cmd:"gameClient.errorVersion", data:{version:"091103_11", msg:"Invalid Version."}}`.
  **[BUG]** It is sent through the Client object, so it never reaches a not-yet-logged-in connection; send it
  to the connection directly.
* A commented-out alternative was `gameClient.kickout {msg}`.

### 13.4 Unknown command groups (`punknown`)

Covers `truce.*`, `gamemaster.*`, `stratagem.*` and any other unknown group. Sends
`server.SystemInfoMsg {alliance:false, tV:false, noSenderSystemInfo:false, msg:"Unknown object - <cmd>"}` and
logs it. Only delivered if the connection is logged in.

### 13.5 `gamemaster.*` [GAP]

The client protocol knows `gamemaster.addBuilding`, `addHero`, `addItems`, `removeBuilding`, `removeHero`,
`removeItem`, `setResources` and `setTechnology`. None are implemented; they reach `punknown`. The only GM
features are the chat commands in §7.5.

---

## 14. Server push catalogue (emitted by code in this spec)

| cmd | data | emitted by |
|---|---|---|
| `server.LoginResponse` | PlayerBean wrapper (§3), or an error object | login |
| `server.ConnectionLost` | `{reasonCode:int, msg:string}`; the socket is closed after sending. Codes used: 3 duplicate login, 1 server restart, any code via `\kick`. | CloseClient |
| `server.SystemInfoMsg` | `{alliance:bool, tV:bool, noSenderSystemInfo:bool, msg:string}` | SendMessage (one player, offline skipped), MassMessage (all players), ParseChat replies, debug echo, unknown-command notice, getItemDefXml welcome |
| `server.ChannelChatMsg` | `{msg, languageType:0, ownitemid, fromUser, channel:"world"\|"beginner"}` | world/channel chat |
| `server.AllianceChatMsg` | `{msg, languageType:0, ownitemid, fromUser, channel:"alliance"}` | alliance chat |
| `server.PrivateChatMessage` | `{msg, chatType:0, ownitemid, fromUser}` | private chat |
| `server.PlayerInfoUpdate` | `{playerInfo: PlayerInfo}` | SortPlayers (every 5 s, each connected player), `\cents`, others |
| `server.ItemUpdate` | `{items:[{id, count, minCount, maxCount}]}`. Contains only the changed item; the array is empty if not found. | SetItem/AddItem |
| `server.PlayerBuffUpdate` | `{buffBean:{descName, endTime, typeId}, updateType:int}` (0 add/update, 1 remove) | SetBuff/RemoveBuff |
| `server.NewMail` | `{count_system, count, count_inbox}` (unread counts) | MailUpdate |
| `server.NewReport` | `{count, army_count, trade_count, other_count}`. Unread counts by type: 0 → trade, 1 → army, 2 → other. | ReportUpdate |
| `server.ResourceUpdate` | `{castleId, resource: Resources}` | `\resources`, timers |
| `server.CastleUpdate` | `{updateType:2, castleBean}` | (other specs) |
| `server.EnemyArmysUpdate` / `server.FriendArmysUpdate` | `{}` **[BUG]** The army list is built but never attached; intended `{armys:[ArmyMovement]}` | army code |
| `server.SelfArmysUpdate` | `{armys:[ArmyMovement]}` | army code |
| `castle.castleSignInfoArr` | `{castleSignInfoArr:[{id: castleId, name, y, x}]}` | castle sign updates |

Pushes that exist in the protocol but are never sent by this code: `server.KickedOut`, `server.OnlineBonus`,
`server.PackageList`, `server.QuestFinished`, `server.NewFinishedQuest`, `server.SecurityCodeRemovedEvent`,
`server.ChangeName`, `server.CbUpdate`, `server.RegisterResponse`, `server.WorldChatMsg`.

---

## 15. Bugs, gaps and recommendations (consolidated)

**Security and integrity**
1. Passwords are stored and compared in plaintext. Login auto-registers unknown user names. `makesafe` mangles
   special characters into spaces. → Hash passwords and use an explicit register flow (or keep
   auto-register with a flag).
2. Hard-coded admin identity `"Daisy"` (by email in login, by playername in chat).
3. Chat cheats with no permission check: `\cents`, `\resources`, `\buff`, `\tempvar`.
4. Every login and new player resets `cents = 5000` and tops up Speakers to 10000.
5. `PlayerInfo.accountName` exposes the login name to the client.
6. Chat text and mail are not sanitized.
7. `changeUserFace` accepts any URL.

**Logic bugs**

8. `createNewPlayer` overwrites `client.accountid` with the new castle id.
9. `CreateMail` puts the sender's "sent" copy into the **receiver's** mailbox, with the wrong DB row
   (receiverid, type and pid).
10. `receiveMailList` validates the page against the total mail count instead of the per-type count.
11. `ParseMisc` makes `haschangedface` always true after a restart. `DBMisc` writes `icon` as a raw char.
12. `reports.typeid` vs schema `type_id` mismatch. Reports persist only at shutdown, and report ids are
    renumbered each run.
13. `deleteReport` and `readOverReport` apply partially before failing on a bad id.
14. `CalculateOpenTiles` at startup ignores player cities, and city tiles are never persisted to `tiles`.
    `GetRandomOpenTile` may return -1.
15. Map castle `relation` is hard-coded to 0 (= alliance), so every castle appears friendly.
16. `rank.getAllianceRank` sends two responses. The alliance search cache never expires. The members ranking
    tie-break is undefined.
17. `SortPlayers` includes players who haven't created a character ("Testname") and pushes PlayerInfoUpdate
    to everyone every 5 s.
18. Rank `pageNo=0` gives "Invalid page."; mail and report requests treat 0 as 1.
19. `deleteUserAndRestart` responds with an empty cmd and does nothing.
20. `getPackage` reads fields from the wrong object. `Packages()` fills every numeric field with `id`.
21. `\kick` kicks the issuer. `\tempvar` with no argument crashes. `\motd` rank check is ineffective. The
    `\commands` help is unreachable.
22. Login: the "already logged in" error uses cmd `server.loginResponse`. `NewClient()` null deref when the
    server is full. `connected` is never cleared on disconnect, so the duplicate-login kick always fires. The
    throttle (code 6) fires after the old session was already kicked. A ban with an empty global reason and no
    server row throws (no response).
23. `furlough.isFurlought`: the password check fails for players registered this run, and `day` is
    unvalidated (negative day gives free cents).
24. `gameClient.errorVersion` and unknown-command notices are never delivered to unauthenticated connections.
25. Null-pointer crashes: mail sender lookup, alliance chat with a stale alliance, rank bean alliance lookup.
26. `EnemyArmysUpdate` and `FriendArmysUpdate` pushes omit the army list.
27. Item XML (Appendix A) uses a raw string, so `itemType` values are the literal text `\xE5\xAE\x9D…`
    rather than UTF-8 `宝箱`/`宝物`, and `\92` is literal text (intended `’`). The client will likely not
    match these item types. Send the decoded UTF-8.

**Unimplemented [GAP]**

28. Friends and blocks (all of `friend.*`).
29. Mail delete, bulk read, TV messages and reportPlayer. `reportBug` storage.
30. Quests: all real quest logic, awards, and quest-finished pushes.
31. Packages and online bonus. Security code / protect options. `changeName`, `getPlayerInfoByName`,
    `denyPlayerSpeak`, `refreshCaptcha`, `step`, `CbUD`, `mapInfo`, `mapCastle` (`field.getOtherFieldInfo`
    covers castles).
32. `truce.*` and `gamemaster.*`.
33. Speaker consumption for world/group chat. Furlough's real effects (status 5 and attack immunity).
    Beginner status on new players. `createrTime` for new players.
34. Report counts in the PlayerBean (`newReportCount*`) are always 0.

---

## Appendix A — `common.getItemDefXml` payload (verbatim)

`data.itemXml` is the following string. `\xE5…` and `\92` appear as literal backslash text because the C++
source uses a raw string literal (see bug 27). Intended decoding: `\xE5\xAE\x9D\xE7\xAE\xB1` = `宝箱`
(Chest), `\xE5\xAE\x9D\xE7\x89\xA9` = `宝物` (Treasure), `\92` = `’`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<itemdef>
<items>
<itemEum id="player.box.compensation.e" name="Compensation Package" itemType="\xE5\xAE\x9D\xE7\xAE\xB1" dayLimit="0" userLimit="1" desc="Includes: 10 amulets, 100 cents." itemDesc="This package was sent to every member of your server to apologize for extended downtime." iconUrl="images/items/chongzhidalibao.png" price="0" playerItem="true"/>
<itemEum id="player.box.present.money.44" name="Pamplona Prize Pack" itemType="\xE5\xAE\x9D\xE7\xAE\xB1" dayLimit="0" userLimit="1" desc="Includes: Wooden Bull Opener, Lion Medal, Rose Medal, Cross Medal, Primary Guidelines, Intermediate Guidelines, War Horn, Corselet, Holy Water, Hero Hunting, Truce Agreement, City Teleporter, Amulet." itemDesc="These packages are delivered as gifts to players for every $30 worth of purchases made during our Run with the Bulls promotion." iconUrl="images/icon/shop/PamplonaPrizePack.png" price="0" playerItem="true"/>
<itemEum id="player.box.present.money.45" name="Hollow Wooden Bull" itemType="\xE5\xAE\x9D\xE7\xAE\xB1" dayLimit="0" userLimit="1" desc="Includes: Chest A (Freedom Medal, Justice Medal, Nation Medal, Michelangelo's Script, Plowshares, Arch Saw, Quarrying Tools, Blower, War Ensign, Excalibur, The Wealth of Nations, Amulet) or Chest B (Primary Guidelines, Intermediate Guidelines, Hero Hunting, Merchant Fleet, Plowshares, Double Saw, Quarrying Tools, Blower, Michelangelo's Script, Tax Policy, The Wealth of Nations) or Chest C (Excalibur, War Horn, Corselet, Truce Agreement, War Ensign, Adv City Teleporter, Michelangelo's Script) " itemDesc="These chests are sent to you as Run with the Bulls gifts from your friends in the game. They require a Wooden Bull Opener to open. You can obtain a Wooden Bull Opener for every $30 worth of purchases made during the Run with the Bulls promotion. When opened, you will receive the contents of Hollow Wooden Bull A, B or C at random." iconUrl="images/icon/shop/HollowWoodenBull.png" price="300" playerItem="true"/>
<itemEum id="player.key.bull" name="Wooden Bull Opener" itemType="\xE5\xAE\x9D\xE7\xAE\xB1" dayLimit="0" userLimit="0" desc="You can use this key to open one Hollow Wooden Bull sent to you by your friends. If you don\92t have any Hollow Wooden Bull, you should ask your friends to send you some!" itemDesc="You can open any Hollow Wooden Bull your friends gave you with this key once." iconUrl="images/icon/shop/WoodenBullOpener.png" price="0"/>
<itemEum id="player.running.shoes" name="Extra-Fast Running Shoes" itemType="\xE5\xAE\x9D\xE7\xAE\xB1" dayLimit="0" userLimit="0" desc="A gift from your friends around Run with the Bulls. Use it to get 24 hours of 50% upkeep in ALL your cities any time from July 9th through July 13th. Extra-Fast Running Shoes is stackable (meaning if you already have this buff, using it again will add an additional 24 hours). Once July 14th comes, this item will expire if you haven't used it yet." itemDesc="Get a 24 hours 50% upkeep buff during July 9th and July 13th." iconUrl="images/icon/shop/RunningShoes.png" price="0" playerItem="true"/>
<itemEum id="player.box.test.1" name="Test Item" itemType="\xE5\xAE\x9D\xE7\xAE\xB1" dayLimit="0" userLimit="0" desc="Includes: test items." itemDesc="This package exists as a test." iconUrl="images/items/chongzhidalibao.png" price="10" playerItem="true"/>
<itemEum id="alliance.ritual_of_pact.ultimate" name="Ritual of Pact (Ultimate) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="90" userLimit="0" desc="Ritual of Pact (Ultimate): member limit is 1,000; effective for 90 days; leeway period is 7 days." itemDesc="It allows alliance to increase member limit to 1,000 once applied, which is effective for 90 days, while multiple applications of this item can lengthen the effective period. Once the item effect is due, 7-day leeway is given to the alliance. During this time, new members are denied to be recruited to the alliance. If no further application of the item, the alliance disbands automatically once the 7-day leeway period passes." iconUrl="images/items/Ritual_of_Pact_Ultimate.png" price="75"/>
<itemEum id="player.speak.bronze_publicity_ambassador.permanent" name="Bronze Publicity Ambassador (Permanent) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="3650" userLimit="0" desc="Effect of Bronze Publicity Ambassador (Permanent) can only be replaced by Silver Publicity Ambassador (Permanent) or Gold Publicity Ambassador (Permanent)." itemDesc="Once you apply this item, a special bronze icon will be displayed in front of your name when you speak in the chat box. While this item functions permanently, multiple applications make no difference to the duration of the effective period. Its effect can be replaced by Silver Publicity Ambassador (Permanent) or Gold Publicity Ambassador (Permanent)." iconUrl="images/items/Bronze_Publicity_Ambassador_Permanentb.png" price="75"/>
<itemEum id="player.level.hero.100" name="Mega Hero Levelup" itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="0" userLimit="0" desc="Level up your mayor by 100 levels." itemDesc="Level up your mayor by 100 levels." iconUrl="images/icon/shop/WoodenBullOpener.png" price="50000"/>
<itemEum id="player.speak.bronze_publicity_ambassador.permanent.15" name="Bronze Publicity Ambassador (15-day) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="15" userLimit="0" desc="Once you apply this item, a special bronze icon will be displayed in front of your name when you speak in the chat box. It\92s effective for 15 days, while multiple applications can lengthen the effective period. Its effect can be replaced by Bronze Publicity Ambassador (Permanent), Silver Publicity Ambassador (15-day), Silver Publicity Ambassador (Permanent), Gold Publicity Ambassador (15-day) or Gold Publicity Ambassador (Permanent)." itemDesc="Once you apply this item, a special bronze icon will be displayed in front of your name when you speak in the chat box. It\92s effective for 15 days, while multiple applications can lengthen the effective period. Its effect can be replaced by Bronze Publicity Ambassador (Permanent), Silver Publicity Ambassador (15-day), Silver Publicity Ambassador (Permanent), Gold Publicity Ambassador (15-day) or Gold Publicity Ambassador (Permanent)." iconUrl="images/items/Bronze_Publicity_Ambassador_15b.png" price="75"/>
<itemEum id="player.speak.gold_publicity_ambassador.15" name="Gold Publicity Ambassador (15-day) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="15" userLimit="0" desc="Once you apply this item, a special gold icon will be displayed in front of your name when you speak in the chat box. It\92s effective for 15 days, while multiple applications can lengthen the effective period. Its effect can be replaced by Gold Publicity Ambassador (Permanent)." itemDesc="Effect of Gold Publicity Ambassador (15-day) can only be replaced by Gold Publicity Ambassador (Permanent)." iconUrl="images/items/gold_publicity_ambassador_15b.png" price="75"/>
<itemEum id="player.speak.gold_publicity_ambassador.permanent" name="Gold Publicity Ambassador (Permanent) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="3650" userLimit="0" desc="Once you apply this item, a special gold icon will be displayed in front of your name when you speak in the chat box. While this item functions permanently, multiple applications make no difference to the duration of the effective period. " itemDesc="You're the highest level Publicity Ambassador now." iconUrl="images/items/Gold_Publicity_Ambassador_Permanentb.png" price="75"/>
<itemEum id="player.speak.silver_publicity_ambassador.15" name="Silver Publicity Ambassador (15-day) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="15" userLimit="0" desc="Effect of Silver Publicity Ambassador (15-day) can only be replaced by Silver Publicity Ambassador (Permanent), Gold Publicity Ambassador (15-day) or Gold Publicity Ambassador (Permanent)." itemDesc="Once you apply this item, a special silver icon will be displayed in front of your name when you speak in the chat box. It\92s effective for 15 days, while multiple applications can lengthen the effective period. Its effect can be replaced by Silver Publicity Ambassador (Permanent), Gold Publicity Ambassador (15-day) or Gold Publicity Ambassador (Permanent)." iconUrl="images/items/Silver_Publicity_Ambassador_15b.png" price="75"/>
<itemEum id="player.speak.silver_publicity_ambassador.permanent" name="Silver Publicity Ambassador (Permanent) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="3650" userLimit="0" desc="Once you apply this item, a special silver icon will be displayed in front of your name when you speak in the chat box. While this item functions permanently, multiple applications make no difference to the duration of the effective period. Its effect can be replaced by Silver Publicity Ambassador (Permanent) or Gold Publicity Ambassador (Permanent)." itemDesc="Effect of Silver Publicity Ambassador (Permanent) can only be replaced by Gold Publicity Ambassador (Permanent)." iconUrl="images/items/silver_publicity_ambassador_permanentb.png" price="75"/>
<itemEum id="alliance.ritual_of_pact.advanced" name="Ritual of Pact (Advanced) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="15" userLimit="0" desc="Ritual of Pact(Advanced): member limit is 1,000;effective for 15 days; leeway perod is 7 days." itemDesc="It allows alliance to increase member limit to 1,000 once applied, which is effective for 15 days, while multiple applications of this item can lengthen the effective period. Once the item effect is due, 7-day leeway is given to the alliance. During this time, new members are denied to be recruited to the alliance. If no further application of the item, the alliance disbands automatically once the 7-day leeway period passes." iconUrl="images/items/Ritual_of_Pact_Advanced.png" price="75"/>
<itemEum id="alliance.ritual_of_pact.premium" name="Ritual of Pact (Premium) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="30" userLimit="0" desc="Ritual of Pact (Premium): member limit is 1,000; effective for 30 days; leeway period is 7 days." itemDesc="It allows alliance to increase member limit to 1,000 once applied, which is effective for 30 days, while multiple applications of this item can lengthen the effective period. Once the item effect is due, 7-day leeway is given to the alliance. During this time, new members are denied to be recruited to the alliance. If no further application of the item, the alliance disbands automatically once the 7-day leeway period passes." iconUrl="images/items/Ritual_of_Pact_Premium.png" price="75"/>
<itemEum id="consume.1.c" name="Speaker (100 pieces package) " itemType="\xE5\xAE\x9D\xE7\x89\xA9" dayLimit="0" userLimit="0" desc="Used while speaking in World channel and sending group message." itemDesc="It includes 100 Speakers. It costs one Speaker per sentence when chatting in World channel, while sending a group message costs two. Unpack automatically when purchased." iconUrl="images/items/biglaba.png" price="200" playerItem="true"/>
</items>
<special>
<pack id="Special Christmas Chest"/>
<pack id="Special New Year Chest"/>
<pack id="Special Easter Chest"/>
<pack id="Special Spitfire Happiness Chest"/>
<pack id="Halloween Chest O'Treats"/>
<pack id="Special Thanksgiving Package"/>
<pack id="Secret Santa Chest"/>
<pack id="Valentine's Day Chest "/>
<pack id="St Patrick's Day Chest"/>
<pack id="Special Easter Chest"/>
<pack id="Hollow Wooden Bull"/>
</special>
</itemdef>
```
