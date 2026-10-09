# Farming level 10 barbarian cities

*Simulated 2026-10-09 with barrymun's research (every level 10), heroes and items. Checked against 697 real level 10 attack reports.*

## The target

| | |
|---|---|
| Troops | 400,000 militia |
| Fortifications | 11,000 traps, 5,500 abatis, 3,666 archer towers, 2,200 rolling logs, 1,375 trebuchets |
| Wall | Level 10 (5.5M hit points) |
| Guard hero | Random, level 1 to 100 |
| Loot | 19M gold, 19M food, 600k each of lumber, stone and iron (39.8M) |

The city refills its troops and fortifications every 6 game minutes (6 seconds at `GAME_SPEED` 60), so every attack meets the full garrison.

## The best army

Army size is 125,000 (Rally Spot 10 with a War Ensign).

| Setup | Archers lost | Fodder lost | Value lost per hit | Dead (half) |
|---|---|---|---|---|
| **Old:** 116,500 archers, 1,000 each of peasants, militia, pikemen, swordsmen and scouts, 3,500 transporters | 5,237 | 917 + 917 + 1,000 + 1,000 | 6.88M | 3.44M |
| **Best:** 118,250 archers, 1,500 peasants, 1,750 militia, 3,500 transporters | 5,453 | 1,337 + 1,413 | **5.79M** | **2.89M** |

- Both setups win every time, in 9 rounds, and carry the full 39.8M of loot (the best one carries 41.6M).
- A grid search over 500 to 4,000 peasants and militia found about 1,500 to 2,000 of each to be best; anything in that band is within 0.05M.

## Items and hero

| Choice | Effect |
|---|---|
| War Ensign | **Keep it.** Without it the army has fewer archers and the battle lasts longer: 90k archers takes 10 rounds (6.4M lost), and 60k takes 11 rounds (7.4M). |
| Attack item (Ivory Horn) | **No effect:** still 9 rounds. Save it for fights against other lords. |
| Defense item (Ultra Corselet) | **Slightly worse:** +0.06M per hit (see [the defense factor](mechanics.md#the-defense-factor)). |
| Hero | **Send the lowest-Intelligence attack hero:** ATK - 70 in lol (Intelligence 18) or ATK - 68 (21). Intelligence 55 costs about 150 more archers per hit. |
| Intelligence heroes | **Much worse:** too little attack, so 14 rounds and about 13k archers lost. |

## How the battle goes

From one seed of the best setup. Positions run from 0 (attacker) to 5200 (defender).

| Round | Archers | Defending militia | What happens |
|---|---|---|---|
| 0-3 | Walk 500 → 2000 | Walk 5000 → 4400 | Traps and trebuchets fire every round |
| 4 | 2500 | 4200, 400k → 178k | The first volley, at half damage (distance 1,700 > 900) |
| 5 | 2500 (stay) | All dead | The second volley |
| 6 | 3000 | | Walking to tower range |
| 7 | 3500 | | All 3,666 towers die in one volley, before they fire |
| 8 | 4000 | | The wall is destroyed. The archers walked into rolling-log range on the way |

**Where the archer losses come from (per battle):**
- **Trebuchets:** about 3,700 (about 415 a round). This is the biggest share, and no setup can avoid it.
- **Traps:** about 1,100 with 5 groups in the zone. The best setup's 3 groups give the archers a third of the trap kills, about 160 a round.
- **Rolling logs:** about 420, in the last round.

## Why the old setup lost more

- **Pikemen and swordsmen** are fast, so they reach archer-tower range (3315) before the archers can kill the towers, and all 2,000 are shot (1.5M in resources). Without them, the archers kill the towers before the towers fire once.
- **Scouts** never leave position 0 (see [the field](mechanics.md#the-field)), so they take no part in the battle.
- **Peasants and militia** are the cheapest units that march into the trap zone, about 220 each against 950 for an archer. That makes them the best trap fodder.
- **Extra fodder groups cost more than they save.** A pikeman group takes its share of the trap kills at 750 a unit. Light cavalry is also shot by the abatis, about 290 a round.

## Why losses can't reach zero

- **The battle can't end until the wall is destroyed.** To hit the wall, the archers have to be within 1,800 of it (position 3400 or more), and that is deep inside the trap and trebuchet zone (200 or more).
- **9 rounds is the floor for this army:**
  - Walking to tower range takes 7 moves, and one round is spent on a second volley at the militia.
  - Killing all 400k militia in one volley would need about twice the attack. Hero power is soft-capped, so that isn't reachable. In the simulation, a hero with 10,000 power got it to 8 rounds.
- **Other armies are worse:**

  | Army | Value lost per hit |
  |---|---|
  | Half ballistas | 64M |
  | All ballistas | 80M |
  | 30k catapults | 117M |
  | 10k battering rams for the wall | 16M |
  | 1,000 each of 8 fodder types | 22M |

  Siege units are slow, so the battle lasts longer, and each one lost is worth far more. Melee and cavalry armies are compared below.
- **No decoy pulls the trebuchets off the archers:** they always pick the group with the most attack power.

**Expect about 5,450 archers lost per hit, half of them coming home injured, against 39.8M of loot.**

## Melee and cavalry armies

300 seeds each, 125k armies including 3,500 transporters, same hero and items.

| Army | Wins | Rounds | Lost per battle | Value lost per hit |
|---|---|---|---|---|
| Archers (the best army above) | 100% | 9 | 5.4k archers + 2.7k fodder | **5.8M** |
| 121.5k militia (with or without a peasant layer) | 0% | 19 | The whole army | 36.5M |
| 121.5k swordsmen | 100% | 13 | 80.5k | 60M |
| 121.5k pikemen | 98% | 11 | 87.5k | 66M |
| 118k light cavalry + peasant and militia layers | 100% | **5** | 8.9k cavalry + 2.7k fodder | 19.3M |
| 121.5k heavy cavalry | 100% | 6 | 30k | 150M |
| 110k archers + 8k light cavalry | 100% | 9 | 5.3k archers + all 8k cavalry | 23M |

- **Militia** fight the 400k defending militia head-on and lose every time.
- **Swordsmen and pikemen** win, but lose most of the army in melee.
- **Light cavalry** is the only real alternative:
  - It reaches the wall in 5 rounds, versus 9 for archers, so it loses fewer units.
  - Each one is worth 2,100, against 950 for an archer, and they're hit by archer towers (about 6.3k a battle), trebuchets (about 1.2k), the abatis (about 900) and traps (about 500).
  - The result is 3.3 times the archers' losses for the same loot.
- **Fodder doesn't help cavalry much:** towers and the abatis pick out cavalry directly.
- **Mixing cavalry into the archer army** adds the cavalry losses without saving archers. The battle stays at 9 rounds.
## Siege armies

200 seeds each, same hero and items, 3,500 transporters.

| Army | Rounds | Lost per battle | Value lost per hit |
|---|---|---|---|
| Archers (the best army above) | 9 | 5.4k archers + 2.7k fodder | **5.8M** |
| 118k ballistas + 1.5k peasants and 1.75k militia | 22 | **10k ballistas** + all fodder | 74M |
| 111.5k ballistas + 5k peasants and 5k militia | 22 | 9.7k ballistas + all fodder | 73M |
| 101.5k ballistas + 10k peasants and 10k militia | 22 | 9.5k ballistas + all fodder | 74M |
| 30k ballistas + layers | 24 | 10.1k ballistas + all fodder | 75M |
| 118k catapults + layers (1.5k to 10k each) | 27 | **8.4k to 8.6k catapults** + all fodder | 165M |

Siege units lose **more units** than archers, not fewer, and each one is worth far more: a ballista 7,300 and a catapult 19,200, against 950 for an archer.

- **They're slow:** 150 a round for ballistas and 120 for catapults, against 500 for archers. The battle lasts 22 to 27 rounds instead of 9.
- **Traps run out of targets:** the traps keep firing every round (11,000 last 14 to 20 rounds), so they wipe the fodder layers and then fire only at the siege group, about 4k a battle. Bigger layers just die too.
- **Trebuchets kill more per round:** they hit the siege group for all 10 rounds they have ammunition. Ballistas have only 320 life (Medicine doesn't apply to siege units), so about 600 die a round, against 415 archers. That's about 6k ballistas, or 4.4k catapults (480 life).
- **Their longer range doesn't help:** they still have to walk deep into the trap and trebuchet zone to hit the towers and wall.

## Notes

- **March time doesn't change:** transporters are the slowest unit in every one of these armies, so they all take as long to arrive. Light cavalry without transporters carries only 25M of loot.
