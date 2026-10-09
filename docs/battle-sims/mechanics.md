# Battle mechanics in practice

How a field battle in `shared/core/src/battle/simulator.ts` plays out. Server battles run it with `fixes: true` (see `resolve.ts`). Each round is movement, then troop attacks, then traps, abatis, rolling logs, trebuchets and archer towers, then the alive check. A battle ends when one side is wiped, or after 100 rounds (a draw).

## The field

- The attacker starts at position 0 and the defender at `fieldSize`. `fieldSize` is the largest of 200 + the range of every unit type and fortification present. Traps, abatis and trebuchets have range 5000, so a city with any of them has a field of **5200**.
- **Moving:** a group moves toward the nearest enemy group unless an enemy group is already in its range.
  - The wall and archer towers are not groups, so a group keeps walking even when the wall is in range.
  - **Scouts and transporters never move** while the army has any other type, so they stay at 0, out of reach of every fortification.
- **Speed and range** (research included): archers move 500 a round with Compass 10, and their range is 1,800 with Archery 10.

## Who attacks whom

- **Melee groups** hit the nearest enemy group in range; on a tie, the one with the most attack power (attack × count).
- **Ranged groups** (archers, ballistas, catapults) hit the enemy ranged group with the most attack power in range. Otherwise they hit an archer tower if one is in range, otherwise the fastest melee group in range.
- **Ranged damage halves** beyond half the attacker's range: 900 for archers.
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
| Archer towers | 3315 to 5200 (range 1300 +4.5% per wall level) | Hit the ranged group with the most attack power, else the fastest melee group. Half damage beyond half range. |

**What follows from this:**
- **Traps:** the total killed each round is the same however many groups are in the zone. More groups means a smaller share for each, so cheap fodder groups take kills that would otherwise fall on your main troops.
- **Trebuchets** always hit your main damage group, and kill a fixed number of its units each round, whatever the army's size. A decoy would need more attack power than the main group: about 23k catapults against 115k archers.
- **Rolling logs** only reach groups that walk past 3900. Archers do that in the last round, on their way to the wall.
- **Archer towers:** fast fodder (pikemen, swordsmen) reaches tower range first and gets shot. Archers that reach range 3400 kill the towers in one volley.

## The defense factor

Each troop type's defense is turned into a factor:

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
