# Evony Age 1 Private Server: Battle Mechanics Specification

Sources:
- `evony-private-server/src/BattleCalc.cpp` and `src/combatsimulator.h`: the simulator embedded in the server.
- `EvonyAge1BattleCalc/BattleCalc/BattleCalc.cpp`, `combatsimulator.h`, `BattleMechanics.md`: the standalone DLL version, plus the prose write-up.
- `EvonyAge1BattleCalc/BattleTesterSharp/*.cs`: a WinForms tester that P/Invokes the DLL.
- `EvonyAge1BattleCalc/BattleTest/BattleTest.cpp`: a regression harness that reads `x64/*/testdata/*.txt`.
- Integration: `src/spitfire.cpp` (army arrival handling) and `src/packets/parmy.cpp`.

Labels used below:
- **As-is** marks behaviour reproduced exactly from the C++, bugs included.
- **Recommendation** marks a suggested change.
- **External** marks values that do not appear anywhere in these sources.

---

## 1. Which implementation to follow

The two `BattleCalc.cpp` files share the same algorithm. They differ only in these places:

| Aspect | `evony-private-server/src` | `EvonyAge1BattleCalc` (DLL) |
|---|---|---|
| `battleResult.result` | `int8 = defenderAlive` (1 = defender still standing, 0 = defender wiped) | `int32 = attackerAlive \| (defenderAlive << 1)`: 1 = attacker won, 2 = defender won, 3 = both alive after 100 rounds (draw), 0 = both wiped (draw) |
| Wall hit points variable | `float` | `int64_t` |
| min/max | `std::min/std::max` with explicit casts | Windows `min/max` macros (same results) |
| `heroStat` | `{attack, intel, leadership}` | adds `int8 ok` (unused) |
| Export | none (static `CombatSimulator::fight`) | `extern "C" simulateBattle(attacker, defender, battleResult*)` |

**Recommendation:** use the **EvonyAge1BattleCalc (DLL) version** as the reference.
- Its 2-bit result encoding can express draws.
- It keeps wall HP as an integer, which avoids float precision loss at large values.
- Everything else is identical.

If you need server parity, note that the server's scout handler only tests `if (result.result)`, meaning "defender survived". In the DLL encoding, that is the same as `result & 2`.

`BattleMechanics.md` agrees with the code with two exceptions:
- **Field orientation.** The prose puts defenders at 0 and attackers at `field_size`. The code puts **attackers at 0 and defenders at `field_size`**. Only the sign changes. This spec uses the code orientation.
- **Wall HP.** The prose says `100000 * wall_capacity`. The code uses `50000 * L * (L + 1)` for wall level L, which equals `100000 * L(L+1)/2`.

The `.md` contains no worked example. §9 gives worked examples instead, checked by hand against the project's regression test data.

---

## 2. Data model (simulator I/O)

### 2.1 Troop index (12 types). The same index is used everywhere in battle: TR id − 2
| idx | Troop | TR id | Client key | Class |
|---|---|---|---|---|
| 0 | Worker | 2 | peasants | melee, ground |
| 1 | Warrior | 3 | militia | melee, ground |
| 2 | Scout | 4 | scouter | melee, ground (special movement) |
| 3 | Pike | 5 | pikemen | melee, ground |
| 4 | Sword | 6 | swordsmen | melee, ground |
| 5 | Archer | 7 | archer | **ranged**, ground |
| 6 | Transporter | 8 | carriage | melee (special movement; no stat modifiers) |
| 7 | Cavalry | 9 | lightCavalry | melee, mounted |
| 8 | Cataphract | 10 | heavyCavalry | melee, mounted |
| 9 | Ballista | 11 | ballista | **ranged**, mechanical |
| 10 | Ram | 12 | batteringRam | melee, mechanical |
| 11 | Catapult | 13 | catapult | **ranged**, mechanical |

Class arrays (exact):
- `troopTypes` (isMelee) = `[T, T, T, T, T, F, T, T, T, F, T, F]`
- `rangedTroopTypes = [5, 9, 11]`
- `mechTroopTypes = [9, 10, 11]`
- `mountedTroopTypes = [7, 8]`
- `groundTroopTypes = [0, 1, 2, 3, 4, 5]`
- `meleeTroopTypes = [0, 1, 2, 3, 4]` (unused)
- `movementOrder = [2, 7, 8, 3, 4, 1, 0, 6, 10, 5, 9, 11]`
- `attackOrder = [2, 7, 8, 3, 4, 5, 1, 0, 6, 10, 9, 11]`
- `nonRangedTroops = [7, 8, 3, 4, 1, 0, 6, 2, 10]`. This is the priority order for the "fastest melee" search; on equal speed, the earlier entry wins.

### 2.2 Fortification index: TR id − 14
| fidx | Fort | TR id | Client key |
|---|---|---|---|
| 0 | Trap | 14 | trap |
| 1 | Abatis | 15 | abatis |
| 2 | Archer Tower | 16 | arrowTower |
| 3 | Rolling Log | 17 | rollingLogs |
| 4 | Trebuchet ("rockfall") | 18 | rockfall |

### 2.3 Inputs
```
researchStats { military_tradition, iron_working, medicine, compass, horseback_riding, archery, machinery }   // int32 levels, default 0
heroStat      { attack: float, intel: float, leadership: float }                                              // default 0
attacker {
  research: researchStats, hero: heroStat,
  troops: int64[12],
  attack_modifier: float = 1, defence_modifier: float = 1, life_modifier: float = 1
}
defender {
  research, hero, attack_modifier = 1, defence_modifier = 1, life_modifier = 1,
  troops: int64[12],
  fortifications: int64[5],
  wallLevel: int32 = 0,
  gateOpen: int8,                  // UNUSED
  trapKillPower: float = 1.25, logKillPower: float = 1.25, rockKillPower: float = 1.25
}
```
These inputs are declared but **unused** by the algorithm:
- `hero.attack`, `hero.leadership`
- `research.military_tradition`, `research.machinery`
- `gateOpen`

**Recommendation:** callers that want hero attack or Military Tradition bonuses should fold them into `attack_modifier`, e.g. `1 + power/100 + 0.05*MT`. That formula is external and not in the source.

### 2.4 Output
```
battleResult {
  attackerTroops: int64[12],   // survivors per type
  defenderTroops: int64[12],   // survivors per type
  fortification:  int64[5],    // surviving forts (see as-is notes: abatis never decrease)
  result,                      // see §1
  totalRounds: int32           // min(lastRoundIndex + 1, 100)
}
```
Losses are `input − survivors`. The simulator never produces injured troops. There is no "wounded" output.

---

## 3. Troop and fortification statistics

### 3.1 Battle base stats (`baseStats`, identical in both versions and in BattleMechanics.md)
| idx | Troop | Life | Attack | Defense | Speed | Range |
|---|---|---|---|---|---|---|
| 0 | Worker | 100 | 5 | 50 | 180 | 10 |
| 1 | Warrior | 200 | 50 | 50 | 200 | 20 |
| 2 | Scout | 100 | 20 | 50 | 3000 | 20 |
| 3 | Pike | 300 | 150 | 150 | 300 | 50 |
| 4 | Sword | 350 | 100 | 250 | 275 | 30 |
| 5 | Archer | 250 | 120 | 50 | 250 | 1200 |
| 6 | Transporter | 700 | 10 | 60 | 150 | 10 |
| 7 | Cavalry | 500 | 250 | 180 | 1000 | 100 |
| 8 | Cataphract | 1000 | 350 | 350 | 750 | 80 |
| 9 | Ballista | 320 | 450 | 160 | 100 | 1400 |
| 10 | Ram | 5000 | 250 | 160 | 120 | 600 |
| 11 | Catapult | 480 | 600 | 200 | 80 | 1500 |

### 3.2 Fortification base stats (`baseFortificationStats`)
| fidx | Fort | Life | Attack | Defense | Speed | Range |
|---|---|---|---|---|---|---|
| 0 | Trap | 0 | 0 | 0 | 0 | 5000 |
| 1 | Abatis | 0 | 0 | 0 | 0 | 5000 |
| 2 | Archer Tower | 2000 | 300 | 360 | 0 | 1300 |
| 3 | Rolling Log | 0 | 500 | 0 | 0 | 1300 |
| 4 | Trebuchet | 0 | 800 | 0 | 0 | 5000 |

### 3.3 March speed (outside battle)
`spitfire::CalcTroopSpeed` uses the same speeds as the battle table. See models-and-map.md §8.7:
- `travelSeconds = distance * 60000 / slowestSpeed`
- mechanical and mounted speeds get `×(1 + 0.05·HBR)`
- foot speeds get `×(1 + 0.10·Compass)`
- tech levels are capped by the Academy level

### 3.4 Load (carry capacity), food upkeep, training cost
**Not defined in any of these sources.**
- Training costs and population come from DB table `config_troops`: `troopid, buildtime (s/unit), food, wood, stone, iron, gold, population, inside, prereqbuilding, prereqtech, prereqitem`. There is no upkeep or load column.
- `PlayerCity.m_troopconsume` (food upkeep) is always 0.
- The client receives `loadSkillParam = Logistics*10` (percent) in `army.getTroopParam`. Nothing on the server applies it.

**External** reference values, commonly published for Evony Age 1. **Verify these against client data before use.**

| Troop | Load | Food upkeep/h |
|---|---|---|
| Worker | 200 | 2 |
| Warrior | 20 | 3 |
| Scout | 5 | 5 |
| Pike | 40 | 6 |
| Sword | 30 | 7 |
| Archer | 25 | 9 |
| Transporter | 5000 | 10 |
| Cavalry | 100 | 18 |
| Cataphract | 35 | 35 |
| Ballista | 35 | 50 |
| Ram | 45 | 100 |
| Catapult | 75 | 250 |

---

## 4. Numeric model (important for bit-exact results)

- All stats and intermediate damage values are C++ `float` (IEEE-754 binary32). Troop counts are `int64`. Positions are `int32`.
- To reproduce results in TypeScript, apply `Math.fround` after **every** arithmetic operation, evaluated **left to right exactly as written** below. Convert int64 counts to float (`Math.fround(count)`) when they meet a float.
- Some kill counts use `ceil`, where a 1-ulp difference changes the result. That is why this rule matters.
- Conversions to int64 or int32 truncate toward zero. All damage values are non-negative, so this equals `floor`.
- `rand()` is used once per battle, for the trap rate (§6.5). Make the RNG injectable for tests.
- The round limit is 100.

---

## 5. Stat modification (`modifyStats`): applied once per side before the battle

Each side gets its own copy of `baseStats`. Let `r = research`, `h = hero`, and `atkM, defM, lifeM` = that side's modifiers.

1. **Defense** (all 12 types). The stored `defense` becomes a *damage-taken multiplier*:
   ```
   ironFactor  = floor((r.iron_working*5 + 100) / 100)      // INTEGER division (as-is): 1 for IW 0..19, 2 for IW 20
   intelFactor = (100 + h.intel) / 100                      // float
   defense = max( (1000 - ironFactor * intelFactor * baseDefense * defM) / 1000 , 0.5 )
   ```
   Example: with no bonuses, Worker gets (1000−50)/1000 = **0.95**, Sword gets 0.75, Cataphract gets 0.65.
   - Higher base defense gives a lower multiplier, so the unit takes less damage. The multiplier never goes below 0.5.
   - **Recommendation:** the integer division is almost certainly a bug, since Iron Working is meant to give +5% per level. Keep it for parity, or switch to float division when you deliberately rebalance.
2. **Ground troops** (idx 0–5):
   - `life = life * (r.medicine*5 + 100) * lifeM / 100`
   - `attack = attack * atkM`
   - `speed = speed * (r.compass*10 + 100) / 100`
3. **Mechanical** (idx 9, 10, 11):
   - `life = life * lifeM`
   - `attack = attack * atkM`
   - `speed = speed * (r.horseback_riding*5 + 100) / 100`
4. **Ranged** (idx 5, 9, 11): `range = range * (r.archery*5 + 100) / 100`
5. **Mounted** (idx 7, 8):
   - `life = life * lifeM`
   - `attack = attack * atkM`
   - `speed = speed * (r.horseback_riding*5 + 100) / 100`
6. **Transporter** (idx 6) gets no life, attack or speed modification at all (as-is). Only its defense changes, via step 1.

### 5.1 Defender archer tower stats
- `life = (def.r.medicine*5 + 100) * 2000 / 100`
- `attack = 300 * def.attack_modifier`
- `defense = max( 1 - (def.r.iron_working*5 + 100) * (100 + def.h.intel) * 360 * def.defence_modifier / 10000000 , 0.5 )`
  - Here the iron-working term is **not** integer-divided. With no bonuses this gives 0.64.
- `range = 1300 * (def.r.archery*5 + def.wallLevel*4.5 + 100) / 100`
- Other forts use base stats unchanged.

### 5.2 Wall hit points
`wallHP = 50000 * wallLevel * (wallLevel + 1)`. Level 0 gives 0, level 1 gives 100,000, and level 10 gives 5,500,000.

---

## 6. Battle algorithm (`CombatSimulator::fight`)

### 6.1 Battlefield
```
field_size = 0
for i in [0,1,3,4,6,5,7,8,9,10,11]:                 // NOTE: scouts (2) excluded
    if atk.troops[i] > 0 or def.troops[i] > 0:
        field_size = max(field_size, int(200 + baseStats[i].range))     // BASE range, not modified
for f in 0..4:
    if def.fortifications[f] > 0:
        field_size = max(field_size, int(200 + baseFortificationStats[f].range))
```
If only scouts are present and there are no forts, `field_size = 0`.

Positions:
- every attacker group starts at **0**;
- every defender group starts at **field_size**;
- the archer tower and the wall are fixed at `field_size`.

Each of the 24 groups (12 types per side) has `count` (troops at the start of the round), `effectiveTroops` (live count during the round), `location`, `stat` and `typeId`. The archer tower is a pseudo-group with `typeId = 14`, `count = effectiveTroops = def.fortifications[2]`, and location `field_size`.

Fort state:
- `trapCount = f[0]`, `abatisCount = f[1]`, `rollingLogCount = f[3]`, `rockCount = f[4]`
- `trapDieRate = trapCount > 0 ? trapCount * (5 + rand()%5) / 100 : 0` (int64 math, a 5..9% rate fixed for the whole battle)
- `abatisDieRate = abatisCount / 10`
- `logDieRate = rollingLogCount / 10`
- `maxRockDieRate = rockCount / 10` (integer division)

### 6.2 Round loop (round = 0..99)
Each round runs these phases in order: **Movement**, **Troop attacks**, **Traps**, **Abatis**, **Rolling logs**, **Trebuchets**, **Archer towers**, **End-of-round sync**.

#### 6.2.1 Movement (iterate `i` over `movementOrder`)
For each `i`:

**a) Defender group i moves** if `i ∉ {2, 6}` (defender scouts and transporters never move) and `count > 0`:
```
maxRange = loc - range
inRange = any attacker group g with g.count > 0 and g.location >= maxRange
if not inRange:
    nearest = max(0, max over attacker groups with count>0 of g.location)   // starts at 0
    loc = max(nearest, int(loc - speed))
```

**b) Skip for attacker scouts and transporters.** If `i ∈ {2, 6}` and the attacker has any troops of types `{0,1,3,4,5,7,8,9,10,11}` with `count > 0`, skip the attacker move for this `i`. Attacker scouts and transporters move only when nothing else is left on the attacker side.

**c) Attacker group i moves** if `count > 0`:
```
maxRange = loc + range
inRange = any defender group g with g.count > 0 and g.location <= maxRange
if not inRange:
    nearest = min(field_size, min over defender groups with count>0 of g.location)
    loc = min(nearest, int(loc + speed))
```

Notes on movement:
- A group stops when **any** enemy group is within its range, not necessarily one it can hit. Archer towers and walls are ignored for this check.
- A group never passes an enemy. It can stop **on the same coordinate** as the nearest enemy.
- When the defender has no troops, attackers march to `field_size` (the wall).
- Moves are sequential. A later group sees the updated positions of earlier groups.

#### 6.2.2 Troop attacks (iterate `i` over `attackOrder`)
For each `i`, the **defender** group i acts first, then the **attacker** group i. A group acts only if its `count > 0`.

Damage always uses the acting group's **`count`** (its strength at the start of the round). Target eligibility uses the target's **`effectiveTroops > 0`**. This makes the round simultaneous: a group destroyed earlier in the round still strikes back with its full start-of-round count.

**Target selection: defender group D (location L, range R):**
- Let `maxRange = L − R`.
- **D is melee:** scan attacker groups g in index order 0..11 where `g.eff > 0 && g.location >= maxRange`. Pick the smallest `dist = L − g.location`. On equal distance, pick the larger `g.attack * g.eff` (strictly greater).
- **D is ranged:**
  1. Among attacker ranged groups `[5, 9, 11]` with `eff > 0 && location >= maxRange`, pick the largest `attack * eff` (strictly greater than the running best, which starts at 0).
  2. If none, among `nonRangedTroops` order `[7,8,3,4,1,0,6,2,10]` with `eff > 0 && location >= maxRange`, pick the highest **speed** (strictly greater; ties go to the earlier entry).

**Target selection: attacker group A (location L, range R):**
- Let `maxRange = L + R`.
- **A is melee:**
  1. Scan defender groups 0..11 with `eff > 0 && location <= maxRange`. Use the same nearest / largest-attack-value rule as above, with `dist = g.location − L`.
  2. If none was found, and the archer tower has `eff > 0`, `field_size <= maxRange` and `tower.attack * tower.eff > 0`, the target is the **archer tower**.
- **A is ranged:**
  1. Among defender ranged groups `[5, 9, 11]` in range, pick the largest `attack * eff`.
  2. Then, if the archer tower is alive and in range (`field_size <= maxRange`) and `tower.attack * tower.eff > bestValue`, the target becomes the **archer tower**. This replaces a ranged pick with a lower attack value.
  3. If there is still no target, use the fastest group among `nonRangedTroops` in range.
- **If A found no target at all:** when `wallHP > 0 && maxRange >= field_size`, A hits the wall: `wallHP = max(wallHP − floor(A.count * A.attack), 0)`.

**Damage, when the actor is melee** (the target may be a troop group or the archer tower):
```
mod = damageModifiers[actor.typeId][target.typeId]; if mod == 0: mod = 1
killed = int64( (float)(mod * actor.count * actor.attack * target.defense) / target.life )     // truncation
```
**Damage, when the actor is ranged:**
```
distance = |actor.location - target.location|        // computed as (defender.loc - attacker.loc)
if distance <= target.range and isMelee[target.typeId]:   mod = 0.25
elif distance > actor.range / 2:                          mod = 0.5
else:                                                     mod = 1
killed = ceil( actor.attack * target.defense * actor.count * mod / target.life )
```
- As-is undefined behaviour: when the target is the archer tower (typeId 14), `isMelee[14]` reads outside the 12-element array. **Implement it as `false`.** A tower target then never gets the 0.25 modifier. This is the most likely compiled behaviour, since the adjacent bytes are 0.
- After either formula: `target.eff = killed > target.eff ? 0 : target.eff − killed`.

**`damageModifiers[attacker][target]`.** Only melee actors use this table. Indices 0–11 are troops; index 14 is the archer tower. Any value not listed is 0, which means ×1.
| Actor \ Target | Archer (5) | Cavalry (7) | Cataphract (8) | Pike (3) | Archer Tower (14) |
|---|---|---|---|---|---|
| Worker, Warrior, Scout, Archer, Transporter, Ballista, Ram, Catapult | – | – | – | – | 0.3 |
| Pike (3) | – | **1.8** | **1.8** | – | 0.3 |
| Sword (4) | – | – | – | **1.1** | 0.3 |
| Cavalry (7) | **1.2** | – | – | – | 0.3 |
| Cataphract (8) | **1.2** | – | – | – | 0.3 |

(Ranged actors never consult this table, so the archer, ballista and catapult rows have no effect.)

#### 6.2.3 Traps (if `trapCount > 0`)
1. `zone = [field_size − 5000, field_size)`. A group sitting at `field_size` is excluded.
2. `n` = the number of attacker **groups** (types) with `eff > 0` whose location is in the zone.
3. If `n > 0`:
   - `fired = int32(min(trapCount, trapDieRate))`
   - `kills = int32( (float)(fired * 0.5 * trapKillPower) / n )`
   - Every attacker group in the zone loses `kills` from its `eff`, floored at 0.
   - `trapCount −= fired`.

#### 6.2.4 Abatis (if `abatisCount > 0`)
1. `zone = [field_size − 5000, field_size)`.
2. The target is attacker **Cavalry** if its `eff > 0` and it is in the zone. Otherwise it is attacker **Cataphract** under the same condition. Otherwise there is no target.
3. `kills = int64( min(abatisCount, abatisDieRate) * 0.535 )` and `target.eff = max(target.eff − kills, 0)`.

As-is: `abatisCount` is **never decremented**, so abatis are never consumed and the output `fortification[1]` equals the input. **Recommendation:** subtract `min(abatisCount, abatisDieRate)` after firing, as the prose describes.

#### 6.2.5 Rolling logs (if `rollingLogCount > 0`)
1. `zone = [field_size − 1300, field_size)`, using the base log range.
2. The target is the attacker **ground** group (idx 0–5) in the zone with the greatest `eff * attack` (strictly greater than a running best that starts at 0).
3. If there is a target:
   - `fired = min(rollingLogCount, logDieRate)`
   - `target.eff = max( target.eff − floor(fired * logKillPower * 500 * target.defense), 0 )`
   - `rollingLogCount −= fired`.

As-is, there is no division by target life.

#### 6.2.6 Trebuchets (if `rockCount > 0`)
1. `zone = [field_size − 5000, field_size)`.
2. The target is the attacker group (any of 0–11) in the zone with the greatest `eff * attack`.
3. If there is a target:
   ```
   totalDef = target.eff * target.life * target.defense
   totalAtk = maxRockDieRate * rockKillPower * 800
   if totalDef > totalAtk:
       rockCount -= maxRockDieRate
       target.eff = max( target.eff - floor( (float)(maxRockDieRate * 800 * rockKillPower) / (float)(target.defense * target.life) ), 0 )
   else:
       rockCount -= ceil( (float)(target.defense * target.life * target.eff) / (float)(rockKillPower * 800) )
       if rockCount < 0: rockCount = 0
       // AS-IS BUG: the target's troops are NOT reduced in this branch.
       // Recommendation: set target.eff = 0 here (enough rocks were fired to kill the whole group).
   ```
   `maxRockDieRate` is fixed at 10% of the *initial* count and is not capped by the remaining `rockCount`.

#### 6.2.7 Archer towers
1. Set `tower.count = tower.eff`. Damage dealt by attackers earlier in this round therefore reduces the tower's fire this round.
2. If `tower.count > 0`, let `maxRange = field_size − tower.range` and select a target:
   - Among attacker ranged groups `[5, 9, 11]` with `eff > 0 && location >= maxRange`, pick the largest `attack * eff`.
   - Otherwise pick the fastest group in `nonRangedTroops` order with `eff > 0 && location >= maxRange`.
   - Unlike the other forts, the tower can also hit troops standing at `field_size`.
3. Apply damage:
   ```
   distance = field_size - target.location
   mod = distance > tower.range / 2 ? 0.5 : 1
   killed = int64( (float)(tower.attack * tower.count * mod) / (float)(target.defense * target.life) )
   target.eff = killed > target.eff ? 0 : target.eff - killed
   ```
   As-is, the tower formula **divides** by the defense multiplier, whereas troop formulas multiply by it. Keep this for parity.

#### 6.2.8 End-of-round sync and termination
```
for every group on both sides: count = eff
attackerAlive = any attacker count > 0
defenderAlive = any defender count > 0  OR  wallHP > 0
if !attackerAlive or !defenderAlive: stop
```
Neither surviving forts (including towers) nor surviving traps keep the defender "alive". Only troops and wall HP count.

### 6.3 Result
- `attackerTroops[i] = attacker group i count`
- `defenderTroops[i] = defender group i count`
- `fortification = [trapCount, abatisCount, tower.count, rollingLogCount, rockCount]`
- `totalRounds = min(round + 1, 100)`
- The server version sets `result = defenderAlive`. The DLL version sets `result = attackerAlive | (defenderAlive << 1)`.

### 6.4 Edge cases
- If one side is empty at the start, round 0 still runs in full before the check. For example, an attacker facing no defenders and no wall ends with `totalRounds = 1`.
- **Wall-only defence:** the attacker must bring wall HP to 0. Only groups that find no troop or tower target and have `loc + range >= field_size` damage the wall.
- **Draw:** both sides are still alive after 100 rounds.

---

## 7. How the live server uses the simulator (`spitfire.cpp`)

Army arrival is processed every 100 ms for armies with `reachtime < now`.

### 7.1 Target validation (direction FORWARD)
The target is invalid, and the army simply turns back, when any of these holds:
- the attacker is a beginner and the target tile is a city (`type > 10`);
- the tile is owned and the owner client is missing;
- the relation between the players is SELF, ALLIANCE or ALLY;
- the owner is a beginner and the tile is a CASTLE.

Turning back sets:
- `direction = BACKWARD`
- `reachtime = now + (reachtime − starttime − resttime)`
- `resttime = 0`, `starttime = now`
- hero status RETURN

### 7.2 `MISSION_SCOUT` (3), the only mission with combat implemented

**Valley (tile type < CASTLE):**
1. Ensure `tile.m_valley` exists and call `Reset(false)`. Valley defenders regenerate at most every 6 min (models-and-map.md §7).
2. There is **no battle**.
3. A "Scout Report" is written with `isFound="false" isSuccess="true"`, containing the valley hero (level, name) and troops (`troopStrType typeId=idx+2 count`).
4. The army returns.

**Player castle (owned tile):** a **scouting battle** with scouts only.
- `atk.troops[2]` = the army's scouts.
- `atk.hero.attack = hero.GetPower()` and `atk.hero.intel = hero.GetStratagem()`, if a hero is present.
- Research comes from the attacker's raw levels: MilitaryTradition 9, IronWorking 10, Medicine 16, Compass 12, HorsebackRiding 13, Archery 14, Machinery 19. The levels are **not** capped by the Academy.
- `def.troops[2]` is the sum of:
  - the scouts of all "campers" (the owner's `armymovement` and `friendarmymovement` entries with `direction == STAY` and `targetfieldid == tile`);
  - the city's own scouts, **only if** `city.m_gooutforbattle` is true.
- The defender's research comes from the owner's raw levels.
- The defender hero is the one with the highest `GetPower()` among camper heroes and city heroes. It supplies `attack = power` and `intel = stratagem`.
- `def.fortifications` and `wallLevel` are **not** set (both 0). Forts and walls do not take part in scouting.

After the battle:
- `damage = def.troops[2] − result.defenderTroops[2]`.
- Each camper loses `ceil(camperScouts * damage / totalDefScouts)`. This is int64 math, so the division truncates before `ceil`.
  - If a camper has no troops left, its hero becomes IDLE and the camper army is removed.
  - As-is, the code then dereferences a null client, which is a crash bug.
- The city's own scouts lose `ceil(mainScouts * damage / total)`, also integer math.

If the defender survived (`result.result`) and **all attacking scouts died**:
- The attacking hero loses 5 loyalty, floored at 0.
- If the defender city's `FeastingHall level > HeroCount()` and `rand()%100 > hero.loyalty`, the **hero is captured**:
  - The hero is removed from the attacker city and placed in the defender city. As-is bug: the code fills *every* empty slot with the hero; it should fill only the first.
  - The hero's owner changes, loyalty resets to 0, all buff-added stats reset to 0, and status becomes SEIZED.
  - HeroUpdate is pushed to both sides, and the army is deleted.
- Otherwise the army is deleted and the hero "returns immediately". As-is, its status is set to SEIZED here too, which is a bug; it should be IDLE.

In all other cases the army returns home with `result.attackerTroops[2]` scouts.

**NPC city (unowned tile with an NPC):**
1. There is **no battle**.
2. `npc.ResetHero()` is called.
3. A full report is written (`isFound="true"`). It contains:
   - `scoutInfo` with support (loyalty), population, gold, and hero level and name;
   - resources (food, wood, iron, stone);
   - fortifications (`typeId` 14/15/17/16/18 with count, for non-zero values);
   - troops (TR 3/5/6/7/9 with count);
   - buildings (one `buildingType type levels="l1,l2,…"` element per type < 31);
   - a `battleInfo unNomal="No defending troops found."` element with `backTroop`.
4. The army returns.

Report XML files are written to `reportbasepath + guid + ".xml"`, with root `reportData reportUrl=…`. Each report entry gets `type_id = 1` (army), title "Scout Report", and is pushed with `server.NewReport`.

### 7.3 `MISSION_ATTACK` (5): **not implemented** (`// TODO`)
Nothing below exists in the source:
- plunder and carry capacity;
- loyalty or "support" reduction of the target city;
- city capture or occupation;
- valley occupation;
- injured troops (`m_injuredtroops` is never written);
- NPC post-battle recovery. `NpcCity::RecoverFromAttack` adds +18% of the current count up to the max, but it is never called;
- honor or prestige from combat;
- attack battle reports.

Suggested wiring for the rewrite (**Recommendation**, mapping derived from the data structures):
- Attacker: the army's `stTroops`, mapped index for index; research as in the scout case; hero power and stratagem.
- Defender player city: `m_troops` plus camper troops; `m_forts` → `fortifications[traps, abatis, towers, logs, trebs]`; `wallLevel = GetBuildingLevel(B_WALLS)`.
- Defender NPC: troops `warrior → 1`, `pike → 3`, `sword → 4`, `archer → 5`, `cavalry → 7`; forts as above; `wallLevel = npc.m_level` (NPC walls are built at the city level); hero = `m_temphero`.
- Defender valley: `valley.m_troops` and `m_temphero`, with no forts or walls.
- Apply losses from `result`. Distribute camper losses proportionally, as in the scout code.

### 7.4 Return trip
When `direction == BACKWARD` and `reachtime < now`:
- hero status becomes IDLE;
- the army's resources are added to the city with **no cap**;
- the army's troops are added to the city's troops;
- the army is removed and SelfArmyUpdate, PlayerInfoUpdate, TroopUpdate and ResourceUpdate are pushed;
- a report is written with title "Scout Returned", "Attack Returned" or "Returned". Its XML has a `troopMovement isBack="true" type=<mission>` element with the hero attributes and a `troops typeId count` element per type.

---

## 8. Summary of as-is bugs and recommended fixes
| # | Location | As-is | Recommendation |
|---|---|---|---|
| 1 | modifyStats defense | `(IW*5+100)/100` integer division, so Iron Working only matters at level 20 | float division (rebalance knowingly) |
| 2 | Archer-tower ranged hit | `isMelee[14]` out-of-bounds read | treat as false |
| 3 | Abatis | never consumed | decrement by the number fired |
| 4 | Trebuchet "overkill" branch | rocks consumed, troops not killed | set target eff = 0 |
| 5 | Tower damage | divides by the defense multiplier | keep for parity (documented observed behaviour) |
| 6 | Logs damage | no life division | keep for parity (matches BattleMechanics.md) |
| 7 | Unused inputs | hero.attack, leadership, Military Tradition, Machinery, gateOpen | fold into modifiers if needed |
| 8 | Transporter | no life/attack/speed modifiers | keep |
| 9 | Result encoding (server) | only "defender alive" | use the DLL 2-bit encoding |
| 10 | Field size | ignores scouts and uses base ranges | keep |
| 11 | Server scout handler | hero capture fills all slots; "returned" hero marked SEIZED; null deref on camper wipe | fix |

---

## 9. Worked examples (verified against `EvonyAge1BattleCalc/x64/Release/testdata`)

Test file line format: `atk|def|rounds|atkLoss|defLoss`. Each list is a set of `idx_count` entries separated by commas. The harness expects `survivors = input − loss` and an exact `totalRounds`. None of these examples use research, heroes or forts, and all modifiers are 1.

### 9.1 `archer vs archer.txt` line 1: `5_1|5_2000000|1|5_1|5_1`
This is 1 attacking archer against 2,000,000 defending archers.
- **Stats:** archer defense = (1000−50)/1000 = 0.95, life 250, attack 120, speed 250, range 1200.
- **Field size:** 200 + 1200 = 1400. The attacker archers are at 0 and the defender archers at 1400.
- **Round 0, movement (i = 5):**
  - Defender archers: maxRange = 1400 − 1200 = 200. The attacker is at 0, so it is not in range. They move to max(0, 1400 − 250) = **1150**.
  - Attacker archers: maxRange = 0 + 1200 = 1200, and the defender at 1150 ≤ 1200 is in range. They stay.
- **Round 0, attack (i = 5):**
  - Defender archers (count 2,000,000) target the attacker archers. Distance is 1150 > 600, so mod = 0.5. Killed = ceil(120 · 0.95 · 2,000,000 · 0.5 / 250) = 456,000. The attacker's eff drops to 0.
  - Attacker archers (count 1, the start-of-round value) hit back. Distance is 1150, so mod = 0.5. Killed = ceil(120 · 0.95 · 1 · 0.5 / 250) = ceil(0.228) = **1**.
- **End of round:** the attacker is dead, so `totalRounds = 1`. Losses are attacker 1 and defender 1, which matches the test line.

### 9.2 `pikemen vs lightCavalry.txt` line 3: `3_3|7_2000000|1|3_3|7_1`
This is 3 attacking pikemen against 2,000,000 defending cavalry.
- **Stats:**
  - pike: defense 0.85, life 300, attack 150, range 50;
  - cavalry: defense 0.82, life 500, attack 250, speed 1000, range 100.
- **Field size:** max(250, 300) = 300.
- **Round 0, movement:**
  - Defender cavalry (i = 7): maxRange = 300 − 100 = 200, and the pike at 0 is not in range. They move to max(0, 300 − 1000) = **0**, landing on the pikes' coordinate.
  - Attacker pikes (i = 3): maxRange = 50, and the cavalry at 0 is in range. They stay.
- **Round 0, attack:**
  - Defender cavalry (i = 7) attack the pikes. They are melee and mod = table[7][3] = 0 → 1. Killed = trunc(1 · 2,000,000 · 250 · 0.85 / 300) = 1,416,666. The pikes' eff drops to 0.
  - Attacker pikes (i = 3, count 3) attack the cavalry with mod = table[3][7] = **1.8**. Killed = trunc(1.8 · 3 · 150 · 0.82 / 500) = trunc(1.3284) = **1**.
- **Result:** `totalRounds = 1`, matching the test (3 pikes lost, 1 cavalry lost).

### 9.3 `general.txt` line 1: `5_1000|0_2000000|7|5_1000|0_5415` (multi-round)
This is 1000 attacking archers against 2,000,000 defending workers.
- **Stats:**
  - archer: defense 0.95, attack 120, range 1200, speed 250;
  - worker: defense 0.95, life 100, attack 5, speed 180, range 10.
- **Field size:** 1400.

| Round | Worker pos after move | Archer pos | Distance | Archer mod | Workers killed by archers | Notes |
|---|---|---|---|---|---|---|
| 0 | 1220 | 250 (1220 not within 0+1200, so the archers advance min(1220, 0+250)) | 970 | 0.5 | ceil(120·0.95·1000·0.5/100) = 570 | Archers target the fastest non-ranged group, the workers |
| 1 | 1040 | 250 (in range, stay) | 790 | 0.5 | 570 | |
| 2 | 860 | 250 | 610 | 0.5 | 570 | |
| 3 | 680 | 250 | 430 | 1 | 1140 | Distance ≤ 1200/2 |
| 4 | 500 | 250 | 250 | 1 | 1140 | |
| 5 | 320 | 250 | 70 | 1 | 1140 | Workers: maxRange 310 > 250, so they cannot hit yet |
| 6 | 250 (max(250, 320−180)) | 250 | 0 | **0.25** | ceil(…·0.25) = 285 | Distance 0 ≤ worker range 10 and the target is melee |

**Round 6, worker attack:** the workers act after the archers (attack order puts 5 before 0). Their count at the start of round 6 is 2,000,000 − 5,130 = 1,994,870. They target the archers (distance 0, mod 1). Killed = trunc(1,994,870 · 5 · 0.95 / 250) = 37,902, which exceeds 1000, so the archers' eff drops to 0.

**Result:** the attacker is dead at the end of round 6, so `totalRounds = 7`. The defender loses 570·3 + 1140·3 + 285 = **5,415** workers, and the attacker loses 1,000 archers, matching the test line.

### 9.4 Harness smoke case (no expected output recorded)
`BattleTest.cpp main()` runs 20,000 attacking cavalry against a defender with 10,000 abatis and wall level 1:
- wall HP = 100,000;
- field size = 200 + 5000 = 5200;
- abatis zone = [200, 5200);
- abatis kill `trunc(min(10000, 1000) · 0.535) = 535` cavalry per round while the cavalry are in the zone. Under the as-is behaviour the abatis are never consumed.
- the cavalry reach `field_size` (the wall) after ceil(5200/1000) = 6 moves. From then on, each round they deal `floor(count · 250)` to the wall.
