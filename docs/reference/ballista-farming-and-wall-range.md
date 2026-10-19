# Ballista farming and the wall's range bonus (Evony Age 1)

**Version:** Evony Age 1 player reports (the Evony Wiki's farming pages and blogs from 2009-2010), compared with Marchlands' battle engine (`shared/core/src/battle/simulator.ts`). This note follows up two open rows of [combat-guides.md](combat-guides.md), Where they differ: the Age 2 guide's 500-ballista farm, and the wall's range bonus for defending troops. It changes nothing in the engine; the recommendations are for the maintainer to decide.

**Sources** (read 2026-10-19 and 2026-10-20, facts in our own words):

1. Evony Wiki, [NPC Ballista Count](https://evony.fandom.com/wiki/NPC_Ballista_Count): about 150 players' reports of ballista attacks on barbarian cities of levels 1-5, each with Archery, Horseback Riding (HBR), Military Tradition, hero attack, losses and **the number of rounds**.
2. Evony Wiki, [Talk:NPC/Farming research](https://evony.fandom.com/wiki/Talk:NPC/Farming_research): players' notes on the same, with a battle log dated 2009-09-19. One note is marked as Age II; the rest are Age 1.
3. Lord RC's blog, [Farming Level 5 NPC's](https://lordrc.wordpress.com/2010/08/09/farming-level-5-npcs/) (2010-08-09), and the *Evony Ultimate Guide Age I*, [NPC farming](http://evonyuguide.blogspot.com/p/npcs.html): ballista counts and the "safe" research pairs.
4. Evony Wiki, [Trap](https://evony.fandom.com/wiki/Trap), [Range](https://evony.fandom.com/wiki/Range), [Archer's Tower](https://evony.fandom.com/wiki/Archer's_Tower) and [Balmoth's tip](https://evony.fandom.com/wiki/Balmoth's_tip).
5. The calculator we port, [sonya75/EvonyAge1BattleCalc](https://github.com/sonya75/EvonyAge1BattleCalc): its README.

An official forum thread, *Defender's Wall Range Bonus* (bbs.evony.com, thread 16998, 2009), would bear on question 2, but the forum now sits behind a bot check and couldn't be read.

## Summary

| Question | Finding | Recommendation |
|---|---|---|
| Can 500 ballistae farm a level 5 barbarian city without losses? | **Yes, in Age 1.** It was the standard farm: 300-550 ballistae, no losses, 45-100 rounds. Our engine loses all 500 to traps in 5 rounds. Two rules of the calculator we port differ from the live game: which troops traps hit, and whether a ranged group stops once the wall is in range. Not an Age 2 change, and not a guide error | Change both rules together, as a documented rule change. None of the 36,567 regression cases is affected |
| Do defending archers and ballistae get a range bonus per wall level? | **Unsettled.** One Age 1 source says yes, without numbers; the Age 1 wiki's tables give it to towers only. Both Age 2 guides have it | Leave the engine as it is until firmer evidence turns up |

## 1. Ballista farming

### What our engine does

`npm run sim -- compare --troops ballista=500 --level 5 --research 10`: won 0%, all 500 killed by traps in about 5 rounds. Round by round (`npm run sim -- trace --troops ballista=500 --level 5 --research 10 --seed 1`):

| Round | Ballistae | What happens |
|---|---|---|
| 0 | 500 at 150 | They walk (speed 150 with HBR 10). The trap zone starts at 200, so nothing fires |
| 1 | 360 at 300 | In the zone. 6% of the 3,750 traps fire (225), killing 225 × 0.625 = 140 |
| 2 | 220 at 300 | They stop to shoot the light cavalry, now in range (2,100), and are trapped again |
| 3-4 | 80, then 0 | Walking on towards the wall; the traps kill 140 a round |

- **The traps alone decide it.** Each fired trap kills 0.625 troops of whatever groups are in the zone, and the zone runs from 200 to 5200 (`simulator.ts:396-409`): anything that has moved. Over a battle all 3,750 traps fire, killing about 2,340 troops of any type. That is the "5,000 ballistae win but lose about 2,300": the traps' whole stock.
- **The wall makes them walk in.** The defender stays alive while the wall stands (`simulator.ts:514`), so the ballistae have to come within 2,100 of it (position 3,100 or more, 21 rounds of walking), all of it in the trap zone.
- **And once there, they keep walking.** The wall and towers don't stop a group (`simulator.ts:308-317`), so once the defending troops are dead the ballistae walk into the towers' range (about 1,590 at a level 5 wall) and are shot. Without traps, 500 or 1,000 ballistae still lose everything to the towers; 2,000 kill them on the way in and lose nothing.
- **`fixes` makes no difference here:** the fixes touch abatis, rolling logs, trebuchets and Iron Working, not traps or movement.

### What Age 1 players reported

- **The farm was standard and loss-free.** Ballistae (20 for a level 1 city, then 50, 170, 250, and 300-550 for level 5) with transporters for the loot, Archery 8-10, and no losses when the research was right; level 5 was the best return without losses (sources 1, 3). Levels 6 and up have trebuchets, which always cost some ballistae.
- **The battles were long:** 40-100 rounds at level 5. More ballistae or hero attack meant fewer rounds (1,000 ballistae with attack 149: 44 rounds; 325 with attack 105: 76). Too few ballistae ran to **100 rounds without a loss**: a failed attack that cost nothing.
- **The towers were what had to be killed,** all of them, before the towers could shoot back. Below about 320 ballistae, battles passed 75 rounds and small losses began (source 2).
- **Speed mattered in an odd way.** Only some Archery × HBR pairs were safe: Archery 8 with HBR 5 or 6; Archery 9 with HBR 3, 8 or 9; Archery 10 with HBR 0 or 5-10 (source 3). At HBR 7 or 8 the ballistae were said to move too fast, reaching tower range before the towers were gone (source 2). Outside the safe pairs, losses were small (30-80) or total (637 of 637).

Two things in this can't happen in our engine:

1. **A battle that runs 100 rounds without a loss** means the ballistae stood outside the towers' range all battle, firing. Ours always walk on to the wall, into the towers' range.
2. **Several hundred ballistae walking 20 rounds through the trap zone without a loss** means the traps didn't hit them. The wiki's Trap page says traps only stop workers, warriors, scouts, archers and swordsmen, i.e. infantry (it leaves out pikemen, probably by oversight), and its example has the traps killing an even share of each infantry group. Mounted troops have the abatis; siege engines face only the towers and trebuchets.

### Replaying the reports

Each report run through our engine over 40 seeds (the hero's attack as `1 + attack/100 + 5% per Military Tradition level`; the city's `npcTemplate` garrison, fortifications and wall; a guard hero with Intelligence 45), as it is and with two rule changes made in a patched copy of `simulator.ts` (not committed):

- **(a) traps hit only ground troops** (types 0-5, the same set as the rolling logs);
- **(b) an attacking ranged group stops** when the wall is in its range (`location + range ≥ fieldSize`) while the wall or a tower stands, as it stops for an enemy group.

| City | Ballistae | Archery, HBR, MT, hero attack | Reported (losses / rounds) | Ours as it is | Ours with (a) and (b) |
|---|---|---|---|---|---|
| 5 | 400 | 8, 5, 5, 88 | 0 / 71 | all lost / 4 | 0 / 61 |
| 5 | 325 | 9, 8, 9, 105 | 0 / 76 | all lost / 3 | 0 / 63 |
| 5 | 1,000 | 9, 8, 9, 149 | 0 / 44 | all lost / 8 | 0 / 36 |
| 5 | 300 | 10, 9, 10, 120 | 0 / 74 | all lost / 3 | 0 / 61 |
| 4 | 200 | 8, 6, 6, 71 | 0 / 73 | all lost / 3 | 0 / 61 |
| 3 | 120 | 8, 2, 9, 66 | 0 / 100 (failed) | all lost / 3 | 0 / 83, won |
| 2 | 80 | 9, 8, 9, 37 | 0 / 37 | all lost / 2 | 0 / 31 |
| 5 | 637 | 8, 8, 8, 99 | all lost / 49 | all lost / 6 | 0 / 47 |

- **With both changes, all 23 reports replayed are won without losses** (the Age 2 guide's 500 at research 10 too), and the round counts follow the reports: fewer with more ballistae or attack, typically 10-20% fewer than reported. The 325 ballistae, for example, walk for about 30 rounds, then stand at 3,220, out of the towers' reach, and kill about 46 towers a round at half damage for 27 rounds, then break the wall in 4. That only works if they stop.
- **Either change alone isn't enough:** without (b) the ballistae walk into the towers; without (a) the traps kill them on the way.
- **Not reproduced:** the losses outside the "safe" research pairs. They depend on where the ballistae's last step lands against the towers' range, and under rule (b) no single tower range reproduces the reported pairs exactly. The closest fit puts a level 5 city's towers at about 1,870-1,950, against our 1,592, which hints that barbarian cities' towers outrange ours (a bigger wall bonus, or research). Too uncertain to act on.

### Why the calculator differs

The calculator's README says it is based on an Age 2 calculator and players' observations, and that **the effects of heroes, research and fortifications weren't fully tested**. Its 36,567 regression cases are troop-against-troop battles with no research, fortifications or walls (`shared/core/test/fixtures/battlecalc-testdata.txt.gz`), so they say nothing about traps or the wall. Even its trap kill power is an input (`trapKillPower`, default 1.25) rather than a known value.

So the mismatch is **a difference between the calculator and the live Age 1 game**: not Age 1 against Age 2 (the Age 1 reports agree with the Age 2 guide), not a guide error, and not a porting bug (we match the calculator).

### Recommendation

Make both changes together, as one rule change documented in [deviations.md](../deviations.md) *(design change, matching Age 1 players' reports)*:

1. **Traps hit only ground troops** (worker, warrior, scout, pikeman, swordsman, archer). Mounted troops, transporters and siege engines walk past them. Kills per round stay `fired × 0.5 × trapKillPower`, split over the ground groups in the zone.
2. **An attacking ranged group (archers, ballistae, catapults) stops when the wall is in its range** while the wall or a tower stands, and shoots the towers, then the wall, from there.

Their effect:

- **The 36,567 regression cases:** none changes (they have no fortifications or walls).
- **The 300 golden battles** (`battle-research-walls.jsonl.gz`, our own outputs pinning research, fortifications and walls): 280 change, and 8 of them change winner. They'd be regenerated in the same change.
- **Farming:** ballistae and catapults can farm barbarian cities of levels 1-5 without losses, as in Age 1. The level 10 archer farm ([npc-level-10.md](../battle-sims/npc-level-10.md)) hardly moves: archers are still trapped (they are ground troops), and they stop at 3,400, inside the towers' range anyway. The wiki's level 10 rainbow (2.1k workers, 2.1k warriors, 2.8k scouts, 91k archers) loses about 11.4k archers now and 10.6k with the changes, against 4-7k reported.
- **Players' cities:** traps no longer stop cavalry, cataphracts, rams or siege engines, so a wall of traps is weaker against them (abatis still hit cavalry and cataphracts). Ranged attackers can besiege a city's towers from out of their range; the defender's answer is wall levels (tower range) and troops.
- **The 100-round limit:** a ranged army too small to finish the towers now draws (both alive after 100 rounds) instead of dying, as in Age 1.

## 2. The wall's range bonus for defending troops

**Ours:** only the archer tower gets it: range `1300 × (100 + 5 × Archery + 4.5 × wall level) / 100` (`simulator.ts:250`, `BALANCE.battle.wallTowerRangePct`), 2,535 at wall 10 with Archery 10. Defending archers, ballistae and catapults get Archery only (`simulator.ts:197-199`).

**Age 1 evidence:**

- **For the troops:** Balmoth's tip (source 4) says the defender's troops shoot further with a higher wall. No numbers or reports.
- **For the towers only:** the wiki's Range page (after a forum post by Darwin) says the wall gives the *city's defences* more range, and tabulates it for archer towers only. The Archer's Tower page gives the tower's range as `1300 × (1 + 0.05 × (wall level + Archery))`. Neither mentions defending troops.
- **The rate:** both wiki pages use **5% per wall level** (2,600 at wall 10 and Archery 10), not our 4.5%. The 4.5% and the 2,535 are what the two Age 2 guides give ([combat-guides.md](combat-guides.md)), and the calculator we port was built from an Age 2 one, so the tower's 4.5% may itself be Age 2.
- **Not read:** the forum thread above, said (in search results) to hold two battle reports showing 5% a level, and a guide comment from 2010 said to deny any effect on a defender's range. Neither could be checked.

**What it would change:** only battles on a field longer than the archers' own range, that is with any trap, abatis, trebuchet, ballista or catapult present (the field is set by *base* ranges, `simulator.ts:257-260`). Without them, archers start within range of each other and the bonus does nothing. With a single trap on the wall, 50,000 archers attacking 50,000 behind a level 10 wall (all research 10) destroy each other in 42 rounds today; with the bonus at 4.5%, the defenders shoot first for several rounds and keep 27,792.

- **The 36,567 regression cases:** none changes.
- **The 300 golden battles:** 196 change at 4.5% a level, 12 of them winner (205 and 14 at 5%).
- **Barbarian cities:** almost nothing. They have no research, so their archers reach 1,740 at level 10, short of attacking archers' 1,800.

**Recommendation:** leave the engine as it is. The Age 1 evidence for it is one sentence without numbers, against two tables that give the bonus to towers alone, and it would let defending archers outrange every attacking archer in player wars, so it's worth adopting only on firmer evidence: the forum thread, or an Age 1 battle report showing a defending archer's range. The tower's own rate (4.5% against the Age 1 wiki's 5%) is noted here too; a wiki table alone isn't reason enough to change it.

## Other observations

- **Scouts as decoys:** in the wiki's level 10 rainbow, players lost 1.8-2.8k of 2.8k scouts. Ours never lose any, because attacking scouts stay at 0 while the army has other troops (`simulator.ts:300-302`). The Age 2 guide's "decoy scouts soak ranged fire" points the same way. Worth checking against more reports before acting.
- **A barbarian city's towers** may outrange ours (above). The level 5 safe research pairs would be the test case.
