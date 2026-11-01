# Old guides' strategies in Marchlands

The TODO item *Test the strategies from old game guides*, first pass, 2026-11-01: nine strategies from the guides in [../reference/](../reference/README.md), simulated with `npm run sim` ([README.md](README.md)). Unless said otherwise the lord is the simulator's `DEFAULT_LORD` (research 10, a geared hero of Attack 1,219, the attack item on); where the hero matters, a hero nearer the guides' era was run too (no gear, Attack 100 or 250, no item).

Three set-ups the CLI can't express (separate Archery and Horseback Riding levels, a part-refilled garrison, a player's wall) were run through the game's own `resolveCombat` from a one-off script, not kept in the repository; those are marked *(script)*. That's an idea for the simulator: those three options.

## Results

| # | Strategy (guide) | Result | Verdict |
|---|---|---|---|
| 1 | 500–600 ballistae farm a level 5 barbarian city without losses (aeroagg, research high) | 300–600 win without losses in 32–39 rounds; 200–500 with an Attack 100 hero, 47–81 rounds; research 8 too | **Works**, because of the ballista rule change (traps hit only ground troops, ranged stop at wall range; deviations.md). Without it all 500 die in about 5 rounds |
| 2 | 20, 50, 170 and 250 ballistae for levels 1–4; "trebuchets at 6+ always cost some" (ballista-farming) | Levels 1–4 win without losses at those counts, and at half; at level 6, 500–1,000 lose everything and 2,000 or more always lose exactly 1,740 ballistae (12.7M, more than the city holds) | **Levels 1–4 work.** Level 6 costs a fixed 12.7M a hit: ballista farming stops at level 5 |
| 3 | Only some Archery and Horseback Riding pairs are safe for level 5 ballistae (ballista-farming) *(script)* | At Archery 8–10 every pair is safe; at 0–2 none; at 3–4 some | **Works differently:** the effect appears at Archery 3–4, where our ballistae's range meets a level 5 tower's; at the guide's research ours outrange the towers by far (the reference's own note that Age 1's towers probably outranged ours) |
| 4 | AeroAgg's level 10 wave (2k warriors, 2k workers, 4k scouts, 92k archers) and the wiki's rainbow, reported losing 4–7k archers | Every 100k wave wins in 10 rounds losing 5,610 archers (6.1M); 7,025 with an Attack 250 hero; the repository's `archers-best` loses 5,070 | **Works, at the reported cost.** The scouts never die and change nothing (scouts stay at position 0 until the rest are dead: the ported calculator) |
| 5 | Take a level 8 with 90–100k warriors and 1k transporters (aeroagg) | With a Wiseman-style hero: 89k wins 74%, 99k 99%, losing 60–70k warriors; at research 6, 4% and 38%; with the default lord 100%, losing 48k (11.3M). 89k archers lose 4.3k | **Works only at full research with a strong hero, and dearly:** the warriors break a 3.6M-hit-point wall under the towers |
| 6 | Follow-up waves 20–30 s apart; Justice and Nation medal waves every 4 minutes (aeroagg) *(script)* | At `GAME_SPEED` 1 the garrison is barely back (a win, 281–10.6k lost); at 60, as on the dev stack, 25 s is 42% back and every wave dies | **Works at game speed 1, not at 60:** garrisons refill by the second (deviations.md, NPC cities), 10% every 6 game minutes, every 6 real seconds at 60. Medal drops are our own table (deviations.md), with no penalty for hitting again soon |
| 7 | Suicide waves to use up traps and abatis (aeroagg, gilgad) *(script)* | 1k warriors and 1k cavalry die in 2.6 rounds (2.3M) using 15% of the traps; scouts die before traps fire; cavalry use no traps. With every trap gone the main wave saves only 2M | **Doesn't pay:** traps hit only ground troops, and the per-second refill brings them back |
| 8 | AeroAgg's walls: long-range abatis against a compact tower wall *(script, no defending troops)* | Abatis stop cavalry a little (4.6k lost of 100k) and archers not at all; towers cost cavalry 29k and archers 19.5k | **Partly holds:** only cavalry break abatis, as the guide says, but neither wall holds alone, and trap and abatis walls are weaker against mounted and siege armies than in the original |
| 9 | Keep one catapult so cavalry can't strike in round 1 (gilgad) *(script)* | 100k cavalry against 100k archers: with a ballista they win losing 10k; with a catapult they still win, losing 50k | **Works as stated** (also a test in `shared/core/test/battle-scenarios.test.ts`) |

## Not simulated

- Valley medal farming: valleys drop no medals here (deviations.md, medals), and the CLI can't attack a valley.
- Historic cities' wave tables: the guide gives no outcomes to compare; [historic-cities.md](historic-cities.md) covers them.
- Player against player tactics: they depend on Age 2 rules we don't have (troop life from Intelligence, Leadership) and on cities the guides don't describe.

## Commands

```
npm run sim -- compare --level 5 --research 10 --troops ballista=500 --troops ballista=600 --troops ballista=300 --troops ballista=500,carriage=200 --seeds 200
npm run sim -- compare --level 5 --research 10 --gear-level 0 --stars 0 --power 100 --no-attack-item --troops ballista=100 --troops ballista=200 --troops ballista=300 --troops ballista=500 --seeds 200
npm run sim -- compare --level 1 --research 10 --gear-level 0 --stars 0 --power 100 --no-attack-item --troops ballista=20 --seeds 200
npm run sim -- compare --level 6 --troops ballista=500 --troops ballista=1000 --troops ballista=2000 --troops ballista=5000 --troops ballista=10000 --sources
npm run sim -- compare --troops militia=2000,peasants=2000,scouter=4000,archer=92000 --troops militia=2000,peasants=2000,scouter=6000,carriage=1800,archer=88200 --troops peasants=2100,militia=2100,scouter=2800,archer=91000 --troops militia=2000,peasants=2000,archer=96000 --preset archers-best --sources --seeds 300
npm run sim -- compare --level 8 --troops militia=89000,carriage=1000 --troops militia=99000,carriage=1000 --troops militia=60000,carriage=1000 --sources --seeds 300
```

Levels 2–4 as level 1 with 50, 170 and 250 ballistae (and half); level 8 again with `--power 60 --stratagem 120 --hero-level 50 --gear-level 0 --stars 0 --no-attack-item` and with `--research 6`.
