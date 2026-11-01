# Breaking historic cities

*Simulated 2026-11-01, before historic cities exist in the game, to settle their garrisons ([features/historical-cities.md](../features/historical-cities.md), Testing how they're broken). The garrisons are Age 2's ([reference/historic-cities.md](../reference/historic-cities.md), Garrisons), and they refill every second as decided. What a win takes off loyalty isn't known from any source: these runs take 100 loyalty and 3 a win, so about 34 wins, close to Age 2's 30 to 40 loyalty waves.*

## How it's simulated

`npm run sim -- siege` (`tools/battle-sim/siege.ts`, plans in `tools/battle-sim/plans.ts`) fights a plan's waves one after another against a historic city:

- **The garrison carries over:** each wave meets what the waves before it left (troops, traps, towers, logs and trebuchets), plus what has refilled since: 10% of the full garrison every 6 minutes, a little every second (`--refill`, `--gap` for the seconds between waves).
- **The wall is whole for every wave,** as it is for barbarian cities today (`resolveCombat` takes the wall's level, not its damage). Its level is the city's (`--wall`): 7.8M hit points at level 12, 17.1M at 18.
- **Its hero:** level 100, with AeroCalc's Attack and Intelligence for the level (110 / 500 at 12, up to 300 / 1,650 at 18).
- **The day's garrison:** `--day pikemen,lightCavalry,batteringRam` by default, the weak day Age 2 players waited for.
- **Loyalty** falls by `--loyalty-per-win` for each wave that wins, from `--loyalty`; a plan's loyalty stage sends waves until it reaches 0.
- **The attacker** is the lord options every simulation takes (`--research`, `--power`, `--gear-level`, `--stars` …; the maintainer's account by default: Attack 1,219, research 10, a horn running). Every wave gets the same hero; armies are capped at 125,000 (Rally Spot 10 with a War Ensign).

```bash
npm run sim -- siege --plan archers-best,age2-ballista --level 16 --gap 1 --seeds 3
```

## What a siege takes

**The plan that works best is the simplest:** the level 10 farming army (121,750 archers, 1,500 workers and 1,750 warriors) sent wave after wave until the garrison breaks, then loyalty waves of 20,000 archers and 20,000 warriors (`archers-best`). The maintainer's account, waves 1 second apart:

| Level | Breaking waves | Lost breaking it | Loyalty waves | Lost to loyalty | In all |
|---|---|---|---|---|---|
| 12 | 1 | 25M (25,475 archers) | 33 | 3M | 34 waves in 33 seconds |
| 14 | 3 | 234M (244,000 archers) | 33 | 3M | 36 waves |
| 16 | 10 | 1,056M (1.1M archers) | 33 | 3M | 43 waves |
| 18 | 20 | 2,264M (2.4M archers) | 33 | 3M | 53 waves |

- Every breaking wave but the last loses all its archers: each one kills a share of the garrison and dies.
- **Age 2's plans** (`age2-staged`, `age2-layered`, `age2-ballista`, `age2-hnt`) all take a level 12, but cost more: 74M to 186M, against 28M. Trap waves and waves against one troop type at a time cost troops our battles don't need to spend. A single wave of 117,000 ballistae breaks a level 12 or 14 (162M, its towers and trebuchets kill 21,790 ballistae) but not a 16.
- **The daily garrison** matters a little: against swordsmen, cataphracts and catapults a level 16 takes 12 breaking waves (1,293M) rather than 10.

## The weakest attacker

**There is no minimum hero or gear:** every attacker breaks every level with enough archers. A weaker hero just costs more waves. Waves 1 second apart:

| Attacker (research 10 unless said) | Hero Attack | Level 12 | Level 14 | Level 16 | Level 18 |
|---|---|---|---|---|---|
| No gear, research 5, Attack 100 | 100 | 4 waves, 360M | | | |
| No gear | 169 | 2–3 waves, 160M | 7 waves, 758M | 19–20 waves, 2,150M | 39–40 waves, 4,476M |
| Gear level 5, no stars | 239 | 2 waves, 123M | 6–7, 625M | 17, 1,875M | 34–35, 3,904M |
| Gear level 10, no stars | 309 | 1–2 waves, 62M | 5, 504M | 16–17, 1,797M | 32, 3,621M |
| Gear level 8, 5 stars | 561 | 1 wave, 30M | 5, 470M | 13, 1,419M | 26–27, 2,962M |
| Gear level 10, 10 stars | 1,219 | 1 wave, 28M | 3, 237M | 10, 1,060M | 20, 2,268M |

Breaking waves, then what the whole siege lost. Research 8 instead of 10 adds a wave or four at the higher levels; the horn (+20% attack) is worth about one wave at level 18.

## Timing

**The gaps between waves matter most for the loyalty waves.** A breaking wave of 125,000 archers barely notices a minute's refill, but a loyalty wave of 40,000 troops meets everything that came back since the last one. `archers-best`, the maintainer's account:

| Gap | Level 12 | Level 14 | Level 16 | Level 18 |
|---|---|---|---|---|
| 1 s | 28M | 237M | 1,059M | 2,267M |
| 5 s | 29M | 238M | 1,061M | 2,274M |
| 20 s | 33M | 242M | 1,075M | 2,495M |
| 60 s | 44M | 275M | 1,226M | **fails**: loyalty waves lose |
| 180 s | 97M | 460M | **fails** | **fails** |

What the whole siege lost; "fails" means the 20,000 + 20,000 loyalty waves stopped winning against the refill, and bigger ones would be needed. Landing within a few seconds of each other is what makes a level 16 or 18 possible, which is the point of camp times ([features/camp-times.md](../features/camp-times.md)).

## Armies and heroes

A siege lands 34 to 53 waves within a minute, each its own army with its own hero. A city with Rally Spot 10 has at most 10 armies out at once (`BALANCE.rallySpotArmiesPerLevel`) and its Feasting Hall 10 heroes, so a level 12 takes 4 cities' armies and a level 18 6, the "3–6 cities" Age 2 players launched from. Most of those waves are loyalty waves, so what a win takes off loyalty decides how many cities a siege needs.

## What this means for the design

- **Age 2's garrisons are soft in our battles.** A fully geared player breaks a level 12 with one wave for 28M, about five hits on a level 10 barbarian city; even an ungeared player with research 5 needs only four waves. Levels 16 and 18 cost 1 to 2 billion in resources and over a million archers, which looks like the prize they should be. Ways to make a level 12 and 14 harder, to try next: bigger garrisons (more archers and cavalry, the troops that hurt archers), more trebuchets and towers, a stronger hero, or higher walls.
- **Loyalty sets the size of a siege.** At 3 a win it takes 34 wins, so 4 cities' armies even when one wave breaks the garrison. Fewer, larger loyalty steps would let one city take a level 12.
- **Refilling every second does its job:** spreading the waves out makes the loyalty phase fail at the bigger cities, so timing to the second pays.

## Not covered yet

- Garrisons tuned for levels 12 and 14 (above), and loyalty's numbers.
- The heroes leading the cheap waves: every wave here gets the lord's best hero.
- Defending a captured city, and retaking one.
