# Breaking historic cities

*Simulated 2026-11-01, before historic cities exist in the game, to settle their garrisons ([features/historical-cities.md](../features/historical-cities.md), Testing how they're broken). The garrisons are Age 2's ([reference/historic-cities.md](../reference/historic-cities.md), Garrisons), refilling every second as decided, and the cities have research (Tuning, below). What a win takes off loyalty isn't known from any source: these runs take 100 loyalty and 3 a win, so about 34 wins, close to Age 2's 30 to 40 loyalty waves.*

## How it's simulated

`npm run sim -- siege` (`tools/battle-sim/siege.ts`, plans in `tools/battle-sim/plans.ts`) fights a plan's waves one after another against a historic city:

- **The garrison carries over:** each wave meets what the waves before it left (troops, traps, towers, logs and trebuchets), plus what has refilled since: 10% of the full garrison every 6 minutes, a little every second (`--refill`, `--gap` for the seconds between waves).
- **The city's research:** every research at 10 but Archery, which stays at 0 (`historicResearch`, `--city-research`). Why: Tuning, below.
- **The wall is whole for every wave,** as it is for barbarian cities today (`resolveCombat` takes the wall's level, not its damage). Its level is the city's (`--wall`): 7.8M hit points at level 12, 17.1M at 18.
- **Its hero:** level 100, with AeroCalc's Attack and Intelligence for the level (110 / 500 at 12, up to 300 / 1,650 at 18).
- **The day's garrison:** `--day pikemen,lightCavalry,batteringRam` by default, the weak day Age 2 players waited for.
- **Loyalty** falls by `--loyalty-per-win` for each wave that wins, from `--loyalty`; a plan's loyalty stage sends waves until it reaches 0.
- **The attacker** is the lord options every simulation takes (`--research`, `--power`, `--gear-level`, `--stars` …; the maintainer's account by default: Attack 1,219, research 10, a horn running). Every wave gets the same hero; armies are capped at 125,000 (Rally Spot 10 with a War Ensign).
- **A plan's stages** send one wave a number of times, or until the garrison is broken, one troop type is gone (`until: 'cleared'`), or the city is captured.

```bash
npm run sim -- siege --plan archers-best,pikes-archers --level 16 --day swordsmen,heavyCavalry,catapult --gap 1 --seeds 3
```

## Tuning

**Age 2's garrisons alone were soft in our battles** (the first run, the same day): the maintainer's account broke a level 12 with one wave of archers for 28M, about five hits on a level 10 barbarian city, and an ungeared player with research 5 needed four. A level 12 breaking wave of 121,750 archers lost 14,620 of them to trebuchets and 10,998 to traps, and almost none to the garrison: like barbarian cities, the city had no research, so its archers (range 1,400) couldn't reach attacking archers standing off the wall at range 1,800, and its cavalry crossed the field at 1,000 a round under fire.

What each change did (breaking waves, the maintainer's account and an ungeared hero, the weak day):

| Change | Level 12 | Level 14 | Level 16 | Level 18 |
|---|---|---|---|---|
| Age 2 as it was | 1 / 2 | 3 / 7 | 10 / 19 | 20 / 39 |
| A stronger hero (500 / 1,500) | 1 / 2 | 4 / 8 | 10 / 19 | 20 / 40 |
| Walls 4 levels higher | 1 / 2 | 3 / 7 | 10 / 20 | 21 / 40 |
| Three times the fortifications | 2 / 3 | 4 / 8 | 12 / 21 | 22 / 41 |
| Twice the troops | 2 / 4 | 8 / 15 | 20 / 39 | 41 / 60+ |
| Every research at 10 | 3 / 5 | 8 / 15 | 22 / 45 | 47 / 60+ |
| **Every research at 10 but Archery** | **2 / 5** | **7 / 15** | **19 / 38** | **39 / 76** |

- **The hero, the walls and more fortifications hardly matter:** the archers stand off out of the fortifications' reach, and the wall is only a few rounds' work.
- **Research makes the garrison fight back,** its cavalry fast and its troops tougher, and grows each level's siege with its garrison (about 2.5 times a level).
- **But Archery 10 closes most days.** It gives the city's archers, ballistae and catapults the attackers' reach: at level 16 its 91,500 catapults then hit every archer wave before it can shoot, and nothing reaches them while the rest of the garrison stands. Only 3 of the 12 daily garrisons, all with rams, could be broken at all. With Archery at 0 every day can be broken (below), and the days differ by what to send.

**Decided (2026-11-01): historic cities have every research at 10 but Archery, which stays at 0,** and Age 2's garrisons, fortifications and heroes as they were.

## What a siege takes

**The plan that works best is the simplest:** the level 10 farming army (121,750 archers, 1,500 workers and 1,750 warriors) sent wave after wave until the garrison breaks, then loyalty waves of 20,000 archers and 20,000 warriors (`archers-best`). On a day with cataphracts, which ride the archers down, waves of 125,000 pikemen go first until the cataphracts are gone (`pikes-archers`), as AeroAgg's table advised. The maintainer's account, waves 1 second apart:

| Level | Breaking waves, by daily garrison | Lost | Loyalty waves | In all |
|---|---|---|---|---|
| 12 | 2, or 2 pikemen + 2 on a cataphract day | 123M to 339M | 33 | 35–37 waves in about 35 seconds |
| 14 | 6–7, plus 3 pikemen on a cataphract day | 703M to 984M | 33 | 40–43 waves |
| 16 | 15–19, plus 7 pikemen on a cataphract day | 2.0 to 2.6 billion (about 2M archers) | 33 | 51–57 waves |
| 18 | 31–39, plus 14 pikemen on a cataphract day | 4.2 to 5.2 billion (4 to 5M archers) | 33 | 70–81 waves |

- Every breaking wave but the last loses all its archers: each one kills a share of the garrison and dies. The pikemen waves die to the last man too.
- **The daily garrison** changes what to send more than how much at the bigger cities: a cataphract day costs the pikemen waves, about a sixth more at levels 16 and 18 (but two and a half times as much at 12, where the breaking itself is cheap); catapult days cost a little more than ram days, ballista days a little less; swordsmen or pikemen make little difference.
- **Age 2's plans** (`age2-staged`, `age2-layered`, `age2-ballista`, `age2-hnt`) all take a level 12, at 171M to 339M for the maintainer's account and 171M to 664M for an ungeared hero, against `archers-best`'s 123M and 473M. Without gear the shapes match what Age 2 players reported: source 9's plan needs 5 big archer waves after its 40 trap waves (it planned 4 and an insurance wave), and a single wave of 117,000 ballistae still breaks a level 12 (171M).

## The weakest attacker

**There is no minimum hero or gear:** every attacker breaks every level with enough archers. A weaker hero just costs more waves. Breaking waves on the weak day, 1 second apart, then what the whole siege lost:

| Attacker (research 10 unless said) | Hero Attack | Level 12 | Level 14 | Level 16 | Level 18 |
|---|---|---|---|---|---|
| No gear | 169 | 5 waves, 472M | 15, 1.6 billion | 38, 4.3 billion | 76, 8.8 billion |
| Gear level 5, no stars | 239 | 4, 356M | 13, 1.4 billion | 33, 3.7 billion | 66, 7.6 billion |
| Gear level 10, no stars | 309 | 4, 355M | 12, 1.3 billion | 30, 3.4 billion | 62, 7.1 billion |
| Gear level 8, 5 stars | 561 | 3, 238M | 10, 1.1 billion | 25, 2.8 billion | 51, 5.9 billion |
| Gear level 10, 10 stars | 1,219 | 2, 123M | 7, 703M | 19, 2.1 billion | 38–39, 4.4 billion |
| Gear level 10, 10 stars, research 8 | 1,219 | 4, 354M | 11, 1.2 billion | 27, 3.2 billion | 57, 6.5 billion |

The horn (+20% attack) is worth about two waves at level 18 and nothing at 12; research 8 instead of 10 costs 2 waves at level 12 and 18 at level 18. A level 12 is a strong player's prize (2 to 5 waves); a level 18 takes millions of archers whoever leads them, an alliance's work, as Atlantis was in Age 2.

## Timing

**The gaps between waves matter most for the loyalty waves.** A breaking wave of 125,000 archers hardly notices a minute's refill, but a loyalty wave of 40,000 troops meets everything that came back since the last one. `archers-best`, the maintainer's account, what the whole siege lost:

| Gap | Level 12 | Level 14 | Level 16 | Level 18 |
|---|---|---|---|---|
| 1 s | 123M | 703M | 2,109M | 4,443M |
| 5 s | 125M | 705M | 2,115M | 4,822M |
| 20 s | 130M | 835M | 2,347M | 5,705M |
| 60 s | 154M | 963M | **fails** | **fails** |
| 180 s | 312M | **fails** | **fails** | **fails** |

"Fails" means the 20,000 + 20,000 loyalty waves stopped winning against the refill, and bigger ones would be needed. At level 18 the breaking waves feel it too: 39 a second apart, 47 at 20 seconds, 61 at a minute. Landing within a few seconds of each other is what makes the bigger cities possible, which is the point of camp times ([features/camp-times.md](../features/camp-times.md)).

## Armies and heroes

A siege lands 35 to 81 waves within a minute or so, each its own army with its own hero. A city with Rally Spot 10 has at most 10 armies out at once (`BALANCE.rallySpotArmiesPerLevel`) and its Feasting Hall 10 heroes, so a level 12 takes 4 cities' armies and a level 18 7 to 9, near the "3–6 cities" Age 2 players launched from. Loyalty waves are 33 of them at every level, so what a win takes off loyalty decides how many cities a small siege needs.

## One landing second

*Simulated 2026-11-01 against the game as built, for the level 12 at (207, 405) on the dev stack, with the maintainer's account (research 10, 16 heroes at about 1,220 Attack, the horn and the War Ensign running).*

**At `GAME_SPEED` 60, as on the dev stack, the garrison refills 60 times as fast** as in the runs above: 10% every 6 real seconds (`historicState` refills by `scaled(npcRegenMs)`), so a gap of a few seconds costs what a few minutes do at speed 1 (`--refill 6` simulates it). Loyalty comes back by real time (a point every 6 real minutes) and doesn't matter within a siege.

**The wave planner lands a plan's waves a millisecond apart** (camp times), so a whole siege lands inside one second and nothing refills between waves. Then the loyalty waves meet an empty garrison and can be tiny. The `one-second` plan: the farming army until the garrison breaks, then waves of 5,000 archers alone until it's captured. Losses for the whole siege, 5 sieges each:

| Plan, waves apart | Swordsmen, light cavalry, ballistae | Pikemen, light cavalry, rams | Pikemen, cataphracts, catapults |
|---|---|---|---|
| `one-second`, 1 ms | 35 waves, 119M | 35 waves, 119M | 36 waves, 261M |
| `archers-best` (20k archers + 20k warriors), 1 ms | 35 waves, 122M | 35 waves, 122M | 36 waves, 264M |
| `age2-ballista`, 1 ms | 34 waves, 171M | 34 waves, 171M | 34 waves, 170M |
| `one-second`, 1 s | 35 waves, 135M | 35 waves, 135M | 36 waves, 277M |
| 5,000 archers led by Inn heroes, 1 s | fails | fails | fails |
| `archers-best`, 5 s | 35 waves, 418M | 36 waves, 508M | 37 waves, 787M |
| 5,000 archers, 5 s | fails | fails | fails |

- **Two breaking waves** on a light cavalry day: the first dies whole and leaves the garrison weak enough for the second. A cataphract day takes a third, or one wave of 117,000 ballistae, which is then the cheapest (170M against 261M).
- **Loyalty waves:** 100 loyalty at 3 a win is 34 wins, the breaking win and 33 more. Warriors in a loyalty wave die to the rolling logs the breaking waves leave; archers alone lose almost nothing (0.1M for all 33).
- **Inn heroes do as well as the best** in the loyalty waves landed a millisecond apart *(script: a fresh level 1 hero, no gear, no horn)*, so the 33 loyalty waves don't need the strong heroes, only a hero each. A second apart, they fail with Inn heroes and win with strong ones.
- **Warriors alone don't do:** 1,000-warrior waves with Inn heroes never win; 10,000 win only a millisecond apart.
- **Armies:** 35 waves are 35 armies and 35 heroes, from 4 cities at Rally Spot 10 and Feasting Hall 10.

Before the last win can capture, the attacker needs a free city slot (`maxCitiesFor(title)`) and room under `holdLimit`: otherwise the city stays at 0 loyalty for the next wave.

```bash
npm run sim -- siege --plan one-second,archers-best,age2-ballista --level 12 --day pikemen,lightCavalry,batteringRam --gap 0.001 --refill 6 --seeds 5
```

The Inn-hero runs used a one-off script giving the loyalty stage its own lord (`Lord` with `power: 20`, `heroLevel: 1`, no gear, no item).

## Not covered yet

- Defending a captured city, and retaking one.
- The levels above 12 at game speed 60, in one landing second.
