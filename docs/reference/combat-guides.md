# Combat guides (Evony Age 2) compared with our battle engine

**Version:** Evony Age 2 player guides, compared with Marchlands' battle engine. That engine is Age 1, ported from the original server (`shared/core/src/battle/simulator.ts`) and bit-exact against the original calculator's 36,567 regression cases (`shared/core/test/battle.test.ts`). Where the guides and the engine disagree, the engine stays the reference unless a finding below says otherwise. Players' guides can be wrong, and Age 2 changed some rules.

**Sources:** two archived threads from the official Evony forums, read 2026-10-19. Each has its own note restating it in full in our own words, with the author credited and a link to the archive:

1. *Age II Gilgad's Combat Mechanics Guide v2*, by Gilgad (2013): [gilgad-combat-mechanics.md](gilgad-combat-mechanics.md). Page 1 of the thread's 5; the "Healing bugs" and "Calculators" sections are missing. Report structure, field size, movement, targeting, damage formulas and tactics, with screenshots of battle reports (not readable as text).
2. *Age 2 – Complete Guide – Beginner to Advanced + AeroCalc v2.2*, by AeroAgg06 (2010): [aeroagg-complete-guide.md](aeroagg-complete-guide.md). Page 1 of the thread's 12. Play from beginner to advanced, battle mechanics in prose, and AeroCalc, an Excel combat calculator. The calculator itself and its formulas aren't included.

How to read this note: [battle-sims/mechanics.md](../battle-sims/mechanics.md) explains our engine in practice, and [spec/battle.md](../spec/battle.md) gives its rules from the original code. This note records only what the guides add, confirm or contradict.

## Confirmed by the guides

Both guides agree with our engine on:

- **The field:** 200 + the longest base range present on either side. That's 1400 with archers, 1600 with a ballista, 1700 with a catapult, and 5200 with any trap, abatis or trebuchet (`simulator.ts:257-260`).
- **Field size decides round 1:** cavalry at Horseback Riding 10 reach archers on a 1600 field but hit nothing on a 1700 one. One catapult in a city denies cavalry their first strike.
- **Speeds and research:** cavalry 1500 at Horseback Riding 10, archers 500 at Compass 10. Archery adds 5% range per level to ranged units only.
- **Movement:**
  - The attacker starts at 0 and the defender at the far end.
  - A group never passes an enemy, and stops when anything is in range.
  - Melee reach is the position after moving plus its range.
  - On equal speed the defender goes first.
  - The attacker's scouts and transporters stay back while the rest of the army lives.
- **Simultaneous strikes:** damage uses each group's count at the start of the round, so a group wiped out that round still strikes back.
- **Targeting:**
  - Melee groups hit the nearest enemy, then the largest attack × count.
  - Ranged groups hit the enemy ranged group with the largest attack × count, then the fastest melee group, scouts included.
  - Each group hits one target a round, which is why layering ("rainbows") works.
- **Ranged damage is halved beyond half range.**
- **The archer tower's range** is 2535 at wall 10 and Archery 10: 1300 × 1.95, +4.5% per wall level (`simulator.ts:250`).
- **Abatis** hit only cavalry and cataphracts. Towers fire every round, and the other fortifications are used up as they fire.
- **The defence factor:** the guide's `1 − D` matches ours. Iron Working 10 with a Corselet and no Intelligence gives an archer 0.91 in both.
- **NPC respawn:** the guide's continuous 1/3600 of the full count per second is our 10% every 6 minutes, the same rate in steps.
- **Taking an NPC city:** one big wave, then about 8 more to bring loyalty to zero, fits our loyalty 90 minus 10-15 per win.

## Where they differ

| Guide (Age 2) | Our engine | Judgement |
|---|---|---|
| **500 ballistae take a level 5 NPC city with no losses,** given high research (source 2) | `npm run sim -- compare --troops ballista=500 --level 5 --research 10`: **won 0%,** all 500 killed by traps in about 5 rounds. 5,000 ballistae win but lose about 2,300 | **Adopted 2026-10-20** ([ballista-farming-and-wall-range.md](ballista-farming-and-wall-range.md), [deviations.md](../deviations.md)): Age 1 players farmed exactly this way (300-550 ballistae, no losses, 45-100 rounds), so it is neither Age 2 nor a guide error. The calculator we port differs from the live game: traps should hit only infantry, and a ranged group should stop once the wall is in range. Both are now game rules; no regression case is affected, and 500 ballistae win without losses |
| **Defending ranged troops get +5% range per wall level** (source 1: archers 2400, ballistae 2800 at wall 10; source 2 says 4.5%) | Only the archer tower gets a wall bonus (`simulator.ts:197-199`, `250`) | **Investigated** ([ballista-farming-and-wall-range.md](ballista-farming-and-wall-range.md)): one Age 1 source says so without numbers; the Age 1 wiki's tables give the bonus to towers only, at 5% a level rather than our 4.5%. Left as it is until firmer evidence. It only matters on a field longer than the archers' range (traps, abatis, trebuchets or siege engines present) |
| Ranged attackers hit **archer towers first** | A tower is picked only if its attack × count beats the best ranged group's (`simulator.ts:385`) | Age 1 rule as ported, or the guides simplifying |
| Melee units go for **the missile stack** first (source 1, which the author doubts) | Nearest, then largest attack × count | Ours is verified; the guide is probably wrong |
| Order of moving and striking follows each unit's **researched speed** | A fixed order by type (`simulator.ts:141-142`) | Age 1 as ported. Differs only with mixed research, e.g. warriors at Compass 10 (400) against pikemen without research (300) |
| Rolling logs **don't** set the field size | Logs' range 1300 sets 1500 (`simulator.ts:131, 260`) | Age 1 vs Age 2, or a guide error |
| Damage at 100% of range is a quarter | A quarter only at point-blank, against a melee unit within its own reach of the shooter (`simulator.ts:567`) | The guide likely misread the point-blank rule. The other guide's numbers fit ours (below) |
| The defender's scouts and transporters advance once the rest is dead | They never move (`simulator.ts:285`) | Age 1 as ported; minor |
| Hero **Intelligence adds to troop life,** without limit | It scales the defence factor, floored at 0.5 (`simulator.ts:175-185`), so archers gain nothing above about 455 | Age 1 vs Age 2 |
| Hero attack counts **half** (attack / 2 %), and the War Horn multiplies | `1 + softcap(attack)/100 + 0.05 × Military Tradition + 0.2`, the horn added (`battle/resolve.ts:62-67`) | Ours is a chosen formula ([spec/battle.md](../spec/battle.md)) and a design change ([deviations.md](../deviations.md)), about twice as strong per point below the 200 knee |
| Medicine raises every troop's life | Ground troops only (`simulator.ts:187-191`) | The guides' examples are ground troops only, so no contradiction shown |
| Star sets on gear multiply troop life (×2, ×3.2) | Gear stars add attribute points ([deviations.md](../deviations.md), hero gear) | Age 2 only; deliberate |
| Hero Leadership limits how many troops a hero leads well | Not modelled | Age 2 only |
| Spread damage: overkill spills over (believed from about 100×) | Overkill is lost (`simulator.ts:576-578`) | Age 2 only, and unproven even there |
| Wounded attackers heal 10-50% (less with more honour), 65% with an item | Medicine 5% a level, up to 50% ([deviations.md](../deviations.md), injured) | Age 2; ours borrows the idea differently |

The guides' own sums aren't reliable: source 1's worked casualty examples contain arithmetic slips (a factor of 100 dropped in one, wrong defence and Intelligence values in another). Their *results* are Age 2 formulas anyway, and ours differ by design (64,844 against the guide's 31,387 in its archer duel).

## Findings about our data

Two likely errors in our data, found through these guides. Both were checked against other sources and fixed (2026-10-20):

1. **Wall space per fortification: fixed, with the wiki's values.**
   - **Was:** trap 1, abatis 1, archer tower 2, rolling logs 3, trebuchet 4, a guess listed under "Values chosen without a source" in [deviations.md](../deviations.md).
   - **The NPC table suggested trap 1, abatis 2, tower 3, logs 5, trebuchet 8.** The original server's NPC garrisons (`NPC_TABLE`, `shared/core/src/world.ts`) fill their walls almost exactly with these: at levels 7–10 each of the five types takes exactly a fifth of the wall (level 10: 11,000 traps = 5,500 abatis × 2 = 2,200 logs × 5 = 1,375 trebuchets × 8 = 11,000).
   - **The Evony wiki gives trap 1, abatis 2, tower 3, logs 4, trebuchet 5** ([Walls](https://evony.fandom.com/wiki/Walls); each fortification's own page agrees, and so do its quest sums, e.g. 20 rolling logs fill 80). Source 2's "18,333 archer towers fill a level 10 wall" and other guides confirm the tower's 3 but say nothing of logs or trebuchets.
   - **Decided:** the wiki's 1, 2, 3, 4, 5 (`BALANCE.fortSpace`), as what players saw in the game. Every NPC garrison still fits its wall (levels 6–10 about 85–89% full); a test checks this. The values now sit under Walls in deviations.md's Gaps filled.
   - **Walls left over capacity:** migration 0025 took down the forts that no longer fit, in proportion across types, returned their full cost to the city, used up their refund credit and sent the player a mail.
2. **Population of transporters, cavalry and cataphracts: confirmed and fixed.**
   - **Was:** 3, 6 and 4 (`shared/core/src/data/legacy/troops.json`).
   - **Now:** 4, 3 and 6, as source 1 and the Evony wiki's [troop table](https://evony.fandom.com/wiki/Troops) both give. It was rotated along with life to range in the dump. `tools/legacy-import/convert.mjs` now rotates population back with the rest ([deviations.md](../deviations.md), Data corrections). The wiki's training times for these three match the dump, so those columns were never rotated. No migration: troops store no population, so ones trained before the fix return today's population when disbanded or cancelled.

The level 4 trap count is also settled. Our `NPC_TABLE` has 4,500, and the blog in [npc-cities.md](npc-cities.md) has 2,500. With either set of space values, 4,500 fills the level 4 wall (9,900 of 10,000), so the blog's figure was the typo.

## Tests the guides make possible

All hold for Age 1, and all are now named scenarios in `shared/core/test/battle-scenarios.test.ts`, beside the regression cases in `battle.test.ts`. Each runs `simulateBattle` as the server does (`fixes: true`) and reads positions and kills from its trace. Where a test needed more setup than below:
- **3:** 100 cavalry on a field of 300, where both defending groups stand at the same distance.
- **4:** research 10 on both sides, so every group is in range from round 0. Without it the attacking archers walk into range first and are shot first. One more case: defending archers shoot the attacker's scouts first, though they stand at 0 behind the army, because they're the fastest (a decoy).
- **5:** read from a cavalry strike on archers, which multiplies by the factor: 0.925 without the Corselet, 0.91 with it, 0.8785 with Intelligence 35 too.
- **6:** the range isn't exported, so it's bracketed by where the towers first hit walking groups: catapults at 2668 (hit), rams at 2652 (missed), so between 2532 and 2548. One level less of Archery or wall and 2668 is missed.
- **8:** the full-damage volley is at 400, within half the archers' range; the point-blank one is cavalry at Horseback Riding 10 reaching the archers.

The scenarios:

1. **Movement, round by round:**
   - Setup: 1 cavalry, 1 pikeman and 1 swordsman a side, all research 10, the defender with 1 trap (field 5200; one trap never fires).
   - After round 0: attacker at 1500 / 600 / 550, defender at 3700 / 4600 / 4650.
   - After round 1: attacker at 2200 / 1200 / 1100, defender at 2200 / 4000 / 4100.
2. **Field size decides round 1:**
   - 1,000 cavalry at Horseback Riding 10 against 1,000 archers and 1 ballista: field 1600, cavalry at 1500, and 740 archers killed in round 0.
   - The same with 1 catapult instead of the ballista: field 1700, nothing killed.
3. **Melee target threshold:**
   - Cavalry against 2,001 warriors and 1,000 swordsmen: the warriors are hit.
   - Against 999 and 500: the swordsmen.
   - An exact tie (2,000 / 1,000): the warriors, by order.
4. **Ranged priority:**
   - Defending archers against 1,000 each of attacking archers, ballistae and catapults hit the catapults first.
   - Attacking archers hit a ballista before cataphracts, then cataphracts before pikemen before swordsmen.
5. **The defence factor:** Iron Working 10, Corselet and Intelligence 0 give an archer 0.91.
6. **Tower range:** 2535 at wall 10 with Archery 10.
7. **Speeds and fields:**
   - Cavalry 1500 at Horseback Riding 10, archers 500 at Compass 10.
   - Fields of 1400 (archers), 1600 (ballista), 1700 (catapult), 5200 (traps).
8. **An archer volley at full and close range:**
   - 99,000 archers at ×3.5 attack against cavalry with Iron Working 10 kill 60,707 by our formulas, close to source 2's "around 60,000".
   - With the point-blank quarter: 15,177, against the guide's 15,400.
   - This supports our point-blank rule over source 1's reading.

The 500-ballista farm is now a test too (traps and ranged groups). Not tests: the guides' Age 2 casualty figures, and source 1's "melee hits the missile stack".

## Gaps in our docs the guides point to

All now in [battle-sims/mechanics.md](../battle-sims/mechanics.md):
- the named field sizes;
- the fixed order of moving and striking, with defenders first;
- melee reach as move plus range;
- simultaneous strikes;
- the point-blank quarter;
- the troop-against-troop damage multipliers (`BALANCE`);
- that the defender's scouts and transporters never move;
- tie-breaks by order;
- practical points: decoy scouts soak ranged fire, and one catapult denies cavalry their first strike.

## Other material in source 2

For other reference notes:
- **Historic city heroes**, as AeroCalc set them, Attack / Intelligence by level: 12: 110 / 500, 14: 150 / 800, 16: 200 / 1,100, 18: 300 / 1,650. Leadership was treated as unlimited.
- **Historic city garrisons:** warriors and archers always. Levels 12–14 add swordsmen or pikemen, cavalry and rams; levels 16–18 add swordsmen or pikemen, cataphracts and catapults.
- **A captured historic city** got a 24-hour truce.
- **Achievements (Age 2):** rewards such as cheaper infantry for capturing 100 heroes, cheaper cavalry for 100 items won in war, and more healing for enemy kills.
- **Colonies:** see [colonies.md](colonies.md).
