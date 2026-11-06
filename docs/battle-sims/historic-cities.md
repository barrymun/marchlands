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

## Atlantis in one landing second

*Simulated 2026-11-03 against the game as built, for Atlantis (0, 0) with the maintainer's own armies on the dev stack: research 10, the horn and the defence item running, and each wave led by one of its city's heroes (level 100, about 1,220 Attack; one a city about 1,530 with Excalibur). A one-off script fought the waves one after another as `attackHistoric` does (`resolveCombat`, the day's garrison from `historicState`, the city's guard and research), a millisecond apart, over the 30 daily garrisons from 2026-11-04.*

**Checked against a real siege first:** the same script for the maintainer's 56-wave plan on Rome (level 16, the same day) said the garrison breaks on wave 13 and the city is captured on wave 46. The siege as it landed broke on wave 14 and captured on wave 47.

**The waves:** 90, the most 9 cities send at once (10 armies a city at Rally Spot 10, `BALANCE.rallySpotArmiesPerLevel`, and 10 heroes): 10 of 187,500 from a held level 14, 10 of 156,250 from a held level 12, and 70 of 125,000 (the seats' Rally Spots, `rallyBonusPerStep`; the War Ensign everywhere). The plan's limit is 100 waves (`BALANCE.warPlans.maxWaves`). The biggest waves and the strongest heroes go first. Every wave is the same mix of troops; once the garrison breaks, each one wins without loss and takes 3 loyalty.

**What to send: archers with 1,000 each of five foot types.** The breaking waves, by what they carry besides archers (every daily garrison):

| Each wave carries, besides archers | Breaks on wave | Loyalty 0 on wave | Lost |
|---|---|---|---|
| **1,000 each of workers, warriors, scouts, swordsmen and pikemen** | **26–33** | **59–66** | **4.2M–5.0M** |
| the same and 1,000 each of light cavalry, cataphracts, transporters and ballistae | 26–33 | 59–66 | 4.1M–5.0M |
| 1,000 each of workers, warriors and scouts | 30–38 | 63–71 | 4.6M–5.6M |
| 250 of each of the five | 29–38 | 62–71 | 4.5M–5.6M |
| 3,000 of each of the five | 27–37 | 60–70 | 4.2M–5.5M |
| 1.4% warriors and 1.2% workers (the farming army's shape) | 30–37 | 63–70 | 4.6M–5.5M |
| nothing (archers alone) | 42–61 | 75–90; 11 of 30 days not within 90 waves | 6.1M–8.5M |
| 10% warriors | 46–53 | 79–86 | 6.6M–7.5M |
| 10% pikemen | 45–63 | 78–83; 13 days not within 90 | 6.5M–8.7M |
| pikemen or swordsmen alone | never: about 17M of the garrison left after 90 waves | | 12.2M |

- **Thin layers of several types beat a thicker one of a few:** the garrison spreads its hits over every type in the wave, and each layer takes a share of them before the archers do. Five layers of 1,000 save 4 waves over the farming army's warriors and workers, and about 0.4M troops; more types add nothing, and thicker layers only cost more troops. The same holds with one hero, 125,000-troop waves and no defence item.
- **Openers don't pay at level 18:** pikemen waves until the cataphracts are gone (`pikes-archers`, AeroAgg's advice) cost 5 to 7 more waves on a cataphract day (66 became 73), and one wave of 207,000 ballistae first saves 1.
- **The day:** light cavalry days are the cheapest (loyalty 0 on wave 59–64, the cheapest with pikemen and catapults), cataphract days 64–66. There's no day this plan can't take.
- **Loyalty waves can be tiny, but shouldn't be:** once the garrison and its towers are gone, 1,000 archers win as well as 125,000, and nothing is lost either way. But a plan is set before it lands: if the garrison holds a wave or two longer than planned, small waves meet what's left and die. In the simulator, with the waves switching to 5,000 archers as soon as the garrison's troops were gone, 2 of 5 daily garrisons left a few thousand arrow towers standing and every loyalty wave failed. Full waves throughout cost nothing more.
- **More waves:** a held level 16 sends 218,750; with archers and level 100 heroes moved to it, its 10 waves save about 5 (with the farming army's shape). Excalibur on every hero saves 1 to 2, or 2 to 5 with the level 16's waves.
- **Capturing it** needs a free city slot: a player at Prince with 10 cities, the most any title allows, breaks Atlantis and leaves it at 0 loyalty but can't take it (TODO.md, Abandoning a city).

**Siege engines first: far fewer waves, three to four times the resources.** The city's research leaves Archery at 0 (Tuning, above), so its archers, ballistae and catapults reach no further than they do untrained, while an attacker with Archery 10 shoots from further off: attacking catapults outrange the whole garrison, and ballistae nearly do. Engines in the first waves (the biggest armies), then the layered archers, every daily garrison:

| The first waves | Breaks on wave | Loyalty 0 on wave | Lost | Their cost (resources) |
|---|---|---|---|---|
| None: layered archers throughout | 26–33 | 59–66 | 4.2M–5.0M archers and decoys | 4.0–4.8 billion |
| 1 of catapults | 22–31 | 55–64 | 3.6M–4.8M, 188,000 of them catapults | |
| 3 of catapults | 12–25 | 45–58 | 2.1M–4.0M, 563,000 of them catapults | |
| **10 of catapults** | **5–6** | **38–39** | **0.76M–0.95M catapults** | **14.7–18.3 billion** |
| 10 of ballistae | 6–8 | 39–41 | 1.0M–1.35M ballistae | 7.4–9.9 billion |
| 10 of catapults from a held level 16 (218,750 a wave), with level 100 heroes moved there | 4–5 | 37–38 | 0.69M–0.92M catapults | 13.3–17.6 billion |
| 10 of ballistae from a held level 16 | 5–7 | 38–40 | 0.95M–1.37M ballistae | 6.9–10.0 billion |

- **The engine waves die whole until about the fifth,** each killing a share of the garrison from out of its reach; then one wins. A catapult costs 19,200 resources to train and a ballista 7,300, against an archer's 950, so the siege takes 25 waves fewer for three to four times the resources (catapults) or twice (ballistae). With Medicine 10, half of what an attack loses comes home injured (`attackersGetInjured`), so the losses above are half dead.
- **Engines go first, catapults before ballistae.** After 32 layered archer waves, 8 catapult waves from the held level 16 and 8 ballista waves from the held level 14 only finish what the archers nearly did (loyalty 0 on wave 63–66, 4.0M–4.3M lost); after 16, on wave 51. First, the catapults break the garrison on wave 4–5 and loyalty is 0 on wave 37–38, the ballistae behind them adding nothing; ballistae first, on wave 6–8 and 39–41. Scouts instead of the archers, with or without decoys, do worse (68–70): they hardly hurt the garrison.
- **Mixing:** half ballistae, half archers is worse than either (40–46 waves, the held level 16's waves). Foot layers in catapult waves change almost nothing, but a few ballistae, rams and horses change a lot (Layering catapult waves, below).
- **What it takes in armies:** 38 waves are 4 cities' armies and heroes, against 6 or 7 for archers, and the engines have to be trained first: about 1.1 million catapults for the 6 waves of 187,500 it takes, or 1.5 million ballistae for 8.

```bash
npm run sim -- siege --plan one-second-catapults,one-second-layered --level 18 --day pikemen,lightCavalry,catapult --gap 0.001 --refill 0 --seeds 3
```

With the simulator's lord and 125,000 a wave, `one-second-catapults` breaks the garrison with 7 catapult waves (9 on a day with cataphracts and rams) and takes 40 to 42 waves in all, losing 0.76M to 1.01M catapults (14.7 to 19.4 billion), against `one-second-layered`'s 64 to 71 waves (3.5 to 4.4 billion).

Whether siege engines should be this good against historic cities is a balance question, not settled here: it follows from the decision to leave their Archery at 0.

### Layering catapult waves

*Simulated 2026-11-06 for Atlantis with the maintainer's own armies: research 10, the horn and the defence item running, the War Ensign, and each wave led by one of its city's heroes (about 1,225 Attack, the first of each city about 1,530 with Excalibur). One day's garrison only: swordsmen, light cavalry and rams. A one-off script fought the waves a millisecond apart as `attackHistoric` does, over 20 to 60 seeds, with 8 waves of 218,750 from a held level 16 and 8 from a held level 14, then archers.*

**Checked against the real siege:** the maintainer's 56 waves landed on 2026-11-06 with the 15,000-ram mix as below. As simulated, wave 1 left 8,357,143 of the garrison, wave 2 broke it and wave 35 captured it, with the same losses (217,561 catapults, 13,717 archers). The 21 waves after the capture turned back without fighting.

**A few of the right troops in the first waves more than halve the cost.** Only the waves before the first win decide it, and all of those came from the held level 16. The 15,000-ram mix was carried by its first 3 waves only, the most its rams allowed:

| Each wave carries, besides catapults | Garrison left after waves 1, 2, 3 | First win | Loyalty 0 on wave | Catapults lost | All losses (resources) |
|---|---|---|---|---|---|
| nothing | 14.68M, 8.20M, 1.28M | 4 | 37 | 672,704 | 12.9 billion |
| 1,000 each of workers, warriors, scouts, swordsmen and pikemen | 14.72M, 8.31M, 2.26M | 4 | 37 | 657,704 | 12.6 billion |
| 1,000 light cavalry, or 1,000 cataphracts, or 1,000 rams | about 14.69M, 8.2M, 1.3M to 2.1M | 4 | 37 | about 670,000 | 12.9 billion |
| 100 to 4,500 ballistae | about 9.4M, 2.5M, 0 | 3 | 36 | 445,000–454,000 | 8.7 billion |
| **15,000 rams and 1,000 each of ballistae, light cavalry and cataphracts** | **8.36M, 0** | **2** | **35** | **217,561** | **4.6 billion** |

- **Ballistae work at any number:** 100 lengthen the first wave from 9 rounds to 13, and 4,500 do no better. The likely reason, not traced troop by troop: they stand in front of the catapults, and a group never passes an enemy group (Moving, [mechanics.md](mechanics.md#the-field)), so the garrison stops at them first.
- **The wave 2 win is sharp in the horses:** with 12,000 to 17,000 rams it needs 1,000 of each horse type; 500, 1,500, 2,000 and 3,000 all fall back to wave 3. Why isn't understood. 8,000 rams with 2,000 of each horse also win on wave 2, but lose about 100,000 more catapults. These runs took 6 seeds a mix, with 100, 1,000 or 3,000 ballistae, which made little difference. A miss costs one more wave of about 200,000 catapults, since the next wave is the same mix.
- **More isn't better:** 10,000 or 30,000 of either horse type with the rams and ballistae breaks on wave 3 at best, for 340,000 catapults or more.
- **Later waves need no layers:** once the garrison is gone, plain catapults and archers alone win. Archers alone lose about 13,700 over the loyalty waves, against about 24,000 with five foot layers, to what's left of the fortifications.
- **How far it holds:** the numbers are for this garrison, and the mix wasn't tried on the other daily garrisons, with 125,000-troop waves or at other levels. The next day's garrison (pikemen, cataphracts and catapults) took 5 breaking waves of plain catapults, with layered archers after them.

**Refill inside one second: none.** The game refills a historic city in whole steps, 10% of the full garrison every `scaled(npcRegenMs)` (6 seconds at game speed 60, `historicState`), counted from its first battle of the day. So a siege landing within a second meets no refill, unless the city was attacked earlier that day and a step falls inside the siege: then 10% of the garrison comes back at once. The simulator spreads the refill evenly instead (`--refill`), about 230 warriors a millisecond at level 18 and game speed 60, which is enough to hide the layers' gain: model a siege in one landing second with `--refill 0`. The runs in One landing second above used `--refill 6`, a small error at level 12.

```bash
npm run sim -- siege --plan one-second,one-second-layered,pikes-archers --level 18 --day pikemen,heavyCavalry,catapult --gap 0.001 --refill 0 --seeds 3
```

That run, with the simulator's lord (one hero for every wave, 125,000 a wave, no defence item): `one-second-layered` breaks on wave 34 and captures on wave 68 (3.9 billion lost), `one-second` breaks the garrison's troops on wave 40 but leaves towers its 5,000-archer loyalty waves can't beat, and `pikes-archers` takes 81 waves (5.1 billion).

## Not covered yet

- Defending a captured city, and retaking one.
- Level 14 at game speed 60, in one landing second.
