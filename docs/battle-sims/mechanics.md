# Battle mechanics in practice

How a field battle in `shared/core/src/battle/simulator.ts` plays out. Server battles run it with `fixes: true` (see `resolve.ts`). Each round is movement, then troop attacks, then traps, abatis, rolling logs, trebuchets and archer towers, then the alive check. A battle ends when one side is wiped, or after 100 rounds (a draw).

## The field

- The attacker starts at position 0 and the defender at `fieldSize`. `fieldSize` is the largest of 200 + the base range of every unit type and fortification present on either side (research doesn't change it):

  | Longest range present | Field |
  |---|---|
  | Archers | 1400 |
  | Rolling logs or archer towers | 1500 |
  | A ballista | 1600 |
  | A catapult | 1700 |
  | Any trap, abatis or trebuchet (range 5000) | **5200** |

  **The field decides round 1:** cavalry at Horseback Riding 10 move 1500, so on a 1600 field they reach archers and strike in round 1, and on a 1700 field they hit nothing. One catapult in a city denies cavalry their first strike.
- **Moving:** a group moves toward the nearest enemy group unless an enemy group is already in its range.
  - It never passes an enemy group: it stops at that group's position.
  - The wall and archer towers are not groups, so a group keeps walking even when the wall is in range.
  - **The attacker's scouts and transporters don't move** while the army has any other type, so they stay at 0, out of reach of every fortification. **The defender's never move.**
- **Order:** groups move one at a time in a fixed order by type, and strike in another, the defender's group of each type before the attacker's. Researched speed doesn't change the order (`MOVEMENT_ORDER`, `ATTACK_ORDER` in `simulator.ts`):
  - moving: scouts, cavalry, cataphracts, pikemen, swordsmen, warriors, workers, transporters, rams, archers, ballistae, catapults;
  - striking: the same, but archers come after swordsmen.
- **Reach:** a group strikes what is within its range of where it stands after moving. Melee ranges are short (10 to 100, rams 600), so a melee group strikes once it has walked up to its target.
- **Simultaneous strikes:** damage uses each group's count at the start of the round, so a group wiped out in a round still strikes back that round.
- **Speed and range** (research included): cavalry move 1500 a round with Horseback Riding 10 (1000 without), archers 500 with Compass 10 (250 without), and the archers' range is 1,800 with Archery 10. Compass adds 10% a level to foot troops, Horseback Riding 5% to mounted troops and siege engines, Archery 5% range to archers, ballistae and catapults.

## Who attacks whom

Each group hits one target a round, which is why layering several groups works.

- **Melee groups** hit the nearest enemy group in range; on a tie, the one with the most attack power (attack × count). On an exact tie, the first in troop order (warriors before swordsmen).
- **Ranged groups** (archers, ballistas, catapults) hit the enemy ranged group with the most attack power in range. Otherwise they hit an archer tower if one is in range, otherwise the fastest melee group in range, scouts included.
  - **Fastest, not nearest:** the attacker's scouts stand at 0, behind the whole army, yet they are the fastest group, so defending archers shoot them first. A few scouts are a decoy that soaks a whole volley.
- **Ranged damage halves** beyond half the attacker's range: 900 for archers.
- **Point-blank:** a ranged group shooting a melee group that stands within the melee group's own range of it does a quarter of the damage. 99,000 archers at ×3.5 attack kill 60,707 cavalry (Iron Working 10) at full damage, 15,177 at point-blank.
- **Troop against troop** (`BALANCE.battle.damage`): pikemen do ×1.8 against cavalry and cataphracts, swordsmen ×1.1 against pikemen, cavalry and cataphracts ×1.2 against archers. Archer towers take ×0.3 of the damage aimed at them (`towerDamageTaken`).
- **The wall** (`50,000 × level × (level + 1)` hit points, 5.5M at level 10) is only hit by a group with no other target. Every group hits the archer towers before the wall.
- **The defender stays alive while the wall has hit points,** even with no troops left. Towers don't count toward that. **The battle can't be won without destroying the wall.**

## Fortifications

All of them only hit attacking groups inside their zone: from `fieldSize - range` up to `fieldSize`.

| Fortification | Zone | Each round |
|---|---|---|
| Traps | 200 to 5200 (anything that has moved) | 5-9% of all traps fire (fixed for the battle). Each fired trap kills 0.625 units, **split evenly over every group in the zone**. |
| Abatis | 200 to 5200 | Fire only at cavalry and cataphracts |
| Rolling logs | 3900 to 5200 | 10% fire at the ground group with the most attack power |
| Trebuchets | 200 to 5200 | 10% fire at **the group with the most attack power**. They kill `fired × 1000 / (defense × life)`. If that wipes the group, only the rocks needed are spent. |
| Archer towers | 3315 to 5200 (range 1300 +4.5% per wall level: 1885 at wall 10); 2665 to 5200 with Archery 10 too (+5% a level: 2535) | Hit the ranged group with the most attack power, else the fastest melee group. Half damage beyond half range. |

**What follows from this:**
- **Traps:** the total killed each round is the same however many groups are in the zone. More groups means a smaller share for each, so cheap fodder groups take kills that would otherwise fall on your main troops.
- **Trebuchets** always hit your main damage group, and kill a fixed number of its units each round, whatever the army's size. A decoy would need more attack power than the main group: about 23k catapults against 115k archers.
- **Rolling logs** only reach groups that walk past 3900. Archers do that in the last round, on their way to the wall.
- **Archer towers:** fast fodder (pikemen, swordsmen) reaches tower range first and gets shot. Archers that reach range 3400 kill the towers in one volley.

**Where Age 1 players saw otherwise** ([reference/ballista-farming-and-wall-range.md](../reference/ballista-farming-and-wall-range.md)): two of the rules above come from the calculator we port, whose fortifications were never fully tested, and Age 1 battle reports contradict them.
- **Traps hit every attacking group here.** In Age 1 they only stopped infantry, so ballistae walked past them.
- **Ranged groups keep walking past the point where the wall is in range,** into the towers' range. In Age 1, ballistae stood off and shot the towers from out of their reach for dozens of rounds (a level 5 barbarian city took 45-100 rounds, without losses).

So ballistae can't farm barbarian cities without losses here (500 against a level 5 lose everything to traps), though they could in Age 1. Changing this is a decision for the maintainer.

## The defense factor

Each troop type's defense is turned into a factor (archers with Iron Working 10 and the defense item: 0.91):

```
factor = max(1 - IronWorking × (100 + Intelligence) / 100 × baseDefense × defenseBonus / 1000, 0.5)
```

`IronWorking` is the research multiplier, 1 + 5% per level (1.5 at level 10).

- **Damage from troops is multiplied by the factor.** A lower factor means fewer losses: high Intelligence, Iron Working and the defense item all help, as intended.
- **Damage from trebuchets, rolling logs and archer towers is divided by the factor.** A lower factor means more losses. This is inherited from the original game.

**So against a target whose damage comes from fortifications, such as a barbarian city whose troops never reach you, Intelligence and the defense item make losses worse.** Archers with Iron Working 10:

| Hero Intelligence, defense item | Archer factor | Trebuchet kills a round |
|---|---|---|
| 0, none | 0.925 | about 395 |
| 18, none | 0.911 | about 401 |
| 35, +20% | 0.879 | about 415 |
| 455 or more | 0.5 (floor) | about 730 |

## Attack

- The hero's attack bonus is soft-capped above 200 (`BALANCE.heroSoftCap`), so a hero with 1,359 and one with 3,000 do the same.
- **Attack shortens a battle in whole rounds only,** and a battle's length is mostly set by how far the army has to walk. Extra attack only helps if it removes a whole volley; see [npc-level-10.md](npc-level-10.md#why-losses-cant-reach-zero).

## Tests

Each mechanic above that a guide could check is a named scenario in `shared/core/test/battle-scenarios.test.ts`: the field sizes and round 1, movement round by round, melee and ranged targets with their tie-breaks, the decoy scouts, full and point-blank damage, the defense factor and the archer towers' range.
