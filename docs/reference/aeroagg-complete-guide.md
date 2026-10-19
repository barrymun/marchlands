# Age 2 Complete Guide, Beginner to Advanced, with AeroCalc v2.2 (Evony Age 2)

**Credit:** *Age 2 – Complete Guide – Beginner to Advanced + AeroCalc v2.2*, by **AeroAgg06**, posted on the official Evony forums (Game Guides & FAQs) on 28 December 2010. With thanks to the author, who in turn thanks the players Spawn, Satan, Birtles, Asmo, Woldere and X~Calibur, and points to Birtle's *Combat Calculator* post for the attack equation. The original thread, archived by the Wayback Machine: <https://web.archive.org/web/20241111130609/https://bbs.evony.com/showthread.php?163619-Age-2-Complete-Guide-Beginner-to-Advanced-AeroCalc-v2-2>

**What this note is:** a restatement of the guide in our own words and order, for our reference. It isn't a copy. The game facts are kept: rules, numbers, troop counts and the author's methods. Advice about Facebook posts and spending money is summarised briefly, since Marchlands has neither. The archive holds page 1 of the thread's 12. The AeroCalc spreadsheet (Excel, 10.5 MB), its instructions and the pictures (a speed and range table, layering examples) aren't in it.

**Version:** Evony Age 2. How it compares with our Age 1 engine and rules: [combat-guides.md](combat-guides.md).

## Getting started

- **Free speed-ups:** a building whose *base* build time is under 5 minutes finishes at once, for nothing, with the Speed Up button.
- **The first city** is all-purpose: about two mills and two mines for every farm and quarry. Each Town Hall level adds 3 field slots. Keep a resource field building early on.
- **Research early:** the combat technologies (Iron Working, Military Tradition, Compass, Horseback Riding, Archery, Metal Casting, Medicine).
- **Cottages:** at most seven in a city; the space is better used for barracks.
- **Skippable quests:** the "Wealthy Society" stone quests. Once the walls are level 10, quarries can be turned into mines or mills.
- **Facebook gifts** (Age 2 only). The useful ones:
  - an upkeep cut of 5%, stacking to 10;
  - free cavalry;
  - War Horns (+20% attack for 24 hours);
  - Holy Water (reset a hero's attributes: one per 10 hero levels);
  - Speech Texts (clear grievance, loyalty to 100);
  - Penicillin (+30% wounded for a week);
  - Uprising (+3% attack, +5% defence and +3 leadership for 8 hours, stacking to 10);
  - Beginner Guidelines (a 15-minute speed-up), useful to build up a newly captured historic city before its **24-hour truce** ends.
- **Chasing historic heroes on a new server:** the author spent money on teleports and titles, so this is only summarised. Find the hero through the Inn's hearsay, teleport next to the level 1–2 NPC city holding him, capture him, then start a new city and abandon the old one to regain beginner protection.

## Heroes

- **Picking heroes:** (main attribute − level) of at least 50–55 early on, rising to 60 and then 65. After taking a level 10 NPC city, look for attack heroes with high Intelligence: ((Attack + Intelligence) − level) ≥ 120.
- **What each attribute does as mayor:**
  - Attack: speeds up troop training; also lead attacks with it.
  - Politics: speeds up building and raises production; the usual mayor.
  - Intelligence: speeds up research. Send it with attacks that win in one round, because in Age 2 Intelligence is a flat bonus to every troop's life.
- **Levelling heroes:**
  - Levels 1–70: wearing Wiseman's gear, against level 8 NPC cities, with 1k transporters and 89k or more warriors.
  - Levels 70–100: wearing attack gear, against level 10s, with 2k warriors and workers, 6k scouts, 1.8k transporters and 88.2k archers (more from a historic city).

## Titles and cities

- **More cities:** each title raises the city limit by one, up to 10 at the top title (the guide calls it "prinzessin"; names varied by server). Titles are bought with medals.
- **Specialised cities after the first:**
  - A farm city has 40 farms at Town Hall 10 and ten level 9–10 lakes as valleys.
  - A lumber city has 40 mills (level 9) and ten level 9–10 forests.
  - Iron cities likewise.
- **City layout:** one each of Embassy, Feasting Hall, Rally Spot, Relief Station, Academy, Workshop and Beacon Tower, with 17–20 barracks. Cottages by city type: iron 8, lumber 6, farm 5. Only one city needs a Marketplace and an Inn.

## Taking NPC cities

- **Ballistae for farming:** the author farmed level 5 NPC cities with about 600 ballistae plus transporters (fewer as Archery and Military Tradition rise, and fewer transporters as Logistics rises). The guide says 500 ballistae take a level 5 city with no losses at high research. Our engine disagrees ([combat-guides.md](combat-guides.md)).
- **Making an NPC city next to you:** take a level 8 (or 10) flat beside one of your cities, build a city on it and abandon it. The abandoned city becomes an NPC city of that level, until the server's overnight maintenance removes it.
- **Taking a level 8:**
  - Do it with the Queen or King quest active, heroes in Wiseman's gear.
  - Open with one wave of 90k–100k warriors (the Rally Spot's limit), then about 8 waves of 20k warriors, 20–30 seconds apart, until its loyalty reaches 0.
- **Taking a level 10:**
  - Do it with combat research at 10 (Compass at 9 until the heroes pass 250 attack).
  - Open with 2k warriors and workers, 4k scouts and 92k archers, then about 8 waves of 10k warriors and archers, 20–30 seconds apart.
  - The quest reward is the Queen or King hero.

## Battle mechanics

Age 2 rules, as the author describes them:

- **Rounds:** move, attack, remove the dead.
- **Order:** the fastest *melee* unit moves first (on a tie the defender).
- **Moving:** each unit moves its full speed or until it bumps into an enemy. A unit already in contact doesn't move.
- **Scouts and transporters** wait until everything else is dead (or there was nothing else).
- **Missile units stand and shoot** whenever anything is in range. They don't move to reach a better target.
- **The field** is 200 more than the longest base range on either side (1400 with archers); any trap, abatis or defensive trebuchet makes it 5200.
- **Melee targets:** the nearest enemy, and among equally near ones the highest total attack. That's why layering works.
- **Missile targets:**
  1. archer towers in range, however few;
  2. otherwise, the enemy missile group in range with the highest total attack;
  3. otherwise, the fastest unit in range.
- **Everyone strikes:** a group wiped out in a round still gets its last attack.
- **Defenders' range:** about +4.5% per wall level, added like Archery's bonus. With wall 10 and Archery 10, archer towers reach 2535 and defending archers 2340.
- **NPC respawn:** an NPC city's troops come back at 1/3600 of their full number per second, so all of them in an hour, counted from the full number, not from what was killed.
  - Clearing 100,000 warriors and coming back 45 seconds later finds 1,250.
  - Killing 125k of 200k cavalry and coming back a minute later finds the 75k left plus 3,333.
  - This matters most against historic cities.
- **Healing in battles between players:** no respawn; between 10% and 50% of the dead can be healed, the more honour, the less.
- **Layering ("rainbow"):** one group can attack only one group a round. A thin layer of another type therefore holds an enemy for a round, buying the troops behind it another volley.
  - The author's example: 99k archers with a 200-attack, 100-leadership hero against 100k cavalry.
  - With a layer of pikemen: about 60,000 cavalry killed in the extra round.
  - Without one: the cavalry reach the archers, which then kill only about 15,400 (shooting point-blank), while the cavalry kill all 196,000.
  - Layers of 1–2k rather than single units, because traps kill a lone unit and because of spread damage.
- **Spread damage:** a strike with overwhelming overkill (about 100× is the accepted rule) is believed to reach a second group.
- **Scouting** depends on:
  - enough scouts to beat the defender's scouts;
  - the hero's Intelligence;
  - the Beacon Tower's level in the city scouting;
  - above all, Informatics.

## Walls

- **Archer towers:** they can't move, are the first target of any missile unit that can reach them, and are the only wall defence that attacks every round without being rebuilt. They're best in a compact defence.
- **Traps and abatis:** the author found them unpredictable but among the best: they take the least wall space, kill a lot, and stretch the field to 5200. He filled his long-range cities' walls with mostly abatis, since only cavalry can break them.
- **Defensive trebuchets and rolling logs:** the author found them close to useless. He kept 500 trebuchets as a range setter.
- **Defences the author used:**
  - **Long range (5200):** abatis, some traps and trebuchets. Keep no cavalry or cataphracts there. Add one catapult so the field stays at 1700 if the wall is cleared.
  - **Compact:** no traps, abatis, trebuchets, ballistae or catapults. This is where the cavalry and cataphracts live, with 18,333 archer towers filling a level 10 wall (implying 3 wall spaces a tower; [combat-guides.md](combat-guides.md)).
- **Suicide waves:** 1k warriors and 1k cavalry, with a poor hero, to use up traps and abatis.

## AeroCalc

An Excel battle calculator (version 2.2, 10.5 MB, not in the archive). The guide doesn't give its formulas. The settings it suggests for historic city heroes, as Attack / Intelligence by level, with Leadership set to 100,000 so large garrisons fight at full strength:

| Level | 12 | 14 | 16 | 18 |
|---|---|---|---|---|
| Attack / Intelligence | 110 / 500 | 150 / 800 | 200 / 1,100 | 300 / 1,650 |

For battles between players, the author used the real values from the enemy's statistics page.

## Historic city waves

Wave make-ups for each kind of garrison, for killing one troop type at a time. "Max" means as many as the Rally Spot allows and the hero can lead. Larger waves help only against archers, so the best-leading heroes go with archer waves.

| Cities | Garrison | Target | Wave |
|---|---|---|---|
| 12 and 14 | swords, cavalry, rams | cavalry | 76k warriors, 24k pikemen |
| | | archers | max archers alone |
| | | swordsmen | 2k workers and warriors, max archers |
| | | warriors or rams | 2k each of workers, warriors, pikemen and swordsmen, 25 rams, max archers |
| 12 and 14 | pikes, cavalry, rams | cavalry | 76k warriors, 24k pikemen |
| | | pikemen, warriors or rams | 2k each of workers, warriors, pikemen and swordsmen, 25 rams, max archers |
| | | archers | 2k warriors, max archers |
| 16 and 18 | swords, cataphracts, catapults | cataphracts | max pikemen |
| | | archers or warriors | 2k layers (workers, warriors, pikemen, swordsmen for warriors), max archers, spread over several seconds to land on respawns |
| | | swordsmen | 2k workers and warriors, max archers |
| | | catapults | max scouts alone |
| 16 and 18 | pikes, cataphracts, catapults | cataphracts | max pikemen |
| | | pikemen | 2k warriors and pikemen, 4k cavalry, max archers |
| | | archers or warriors | 2k layers, max archers, spread over several seconds |
| | | catapults | max scouts alone |

## Medals and gems

- **Gems:** keep sending ballista waves at the nine nearest level 5 NPC cities, even every 15 minutes.
- **Cross, Rose and Lion medals:** level 1–3 valleys. Take and abandon a valley between waves landing about 10 seconds apart, so it respawns each time.
- **Honor medals:** level 4 NPC cities.
- **Courage, Wisdom and Freedom medals:** level 5s.
- **Justice and Nation medals:** level 10s. Open with a levelling wave, then 100k warriors every 4 minutes. Sooner lowers the drop rate; later costs more troops.

## Gear and stars

Age 2 only:
- **Levelling gear** costs materials (wood, iron ore, gemstone, thoroughbreds, fabric) and, past level 2, a Lost Armor Script per level. It has a cool-down; full level 10 takes about three weeks.
- **Stars:** don't add any until the gear is level 10, since each level lost costs a star.
- **Gems for stars:** 1 delicate gem for stars 1–3, 4 delicate for 4–6, 4 flawless for 7–15.
- **Keep pieces level:** within one star of each other, and don't try for a star without enough gems to recover from a failure. The author distrusted the posted success rates.

## Achievements

Age 2 only:
- **The Captive** (capture 100 heroes): infantry cost 25% less. The quickest way is colonising inactive players and winning their heroes with Sow Discord.
- **Booty** (100 items won in war, medals and gems included): cavalry cost 25% less.
- **Medal Acquisition** (all 45 medal achievements): siege engines cost less.
- **Colonize** (400 cities): treasure drops +10%. Colonise small (under 1,000 prestige) towns, recall before the suppression battle, repeat.
- **Enemy Killing:** more of your losses can be healed.

## Colonies

See [colonies.md](colonies.md).
- **As a suzerain,** keep the suppression setting low to protect your army.
- **If colonised,** one way out:
  1. Tear down the Academy, Workshop, Beacon Tower and wall defences.
  2. Leave the alliance.
  3. Have a strong ally colonise you, wiping out the suzerain's army.
  4. Rise up, and rejoin.

## Camp time

- **Coordinating attacks:** camp time lets attacks from cities near and far land within seconds of each other. From far away it's good for one set of waves only.
- **Landing times:** the time shown follows the player's own computer clock, not the server's.
- **Measuring lag:** send a single scout to any target, then compare its expected and actual landing times.
