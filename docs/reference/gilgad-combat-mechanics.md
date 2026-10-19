# Gilgad's Combat Mechanics Guide v2 (Evony Age 2)

**Credit:** *Gilgad's Combat Mechanics Guide v2*, by **Gilgad** (forum name "The Real Gilgad"), posted on the official Evony forums (Game Guides & FAQs) on 13–15 September 2013. With thanks to the author, who credits a player called Blah for help with the casualty formulas. The original thread, archived by the Wayback Machine: <https://web.archive.org/web/20160506164054/https://bbs.evony.com/showthread.php?209647-Gilgad-s-Combat-Mechanics-Guide-v2>

**What this note is:** a restatement of the guide's content in our own words and order, for our reference. It isn't a copy, and the guide's screenshots of battle reports aren't reproduced. All the game facts (rules, numbers, formulas) are kept, with the author's own caveats. The archive holds page 1 of the thread's 5, so the "Healing bugs" and "Calculators" sections listed in its contents are missing, and the section on mixed research levels breaks off.

**Version:** Evony Age 2. How this compares with our Age 1 engine, including errors found in the guide: [combat-guides.md](combat-guides.md).

## The shape of a battle

- A battle report is up to **100 rounds**, and each round has **three phases**: movement, combat, and removing the dead.
- Combat is in three steps: close (melee) combat, then a range check, then shooting.
- The dead are removed twice a round, after close combat and after shooting. But a unit killed in a round has already struck that round, so everything gets its attack.

## Field size ("battlefield range")

**The rule:** the field is 200 yards longer than the longest *base* range of a range setter present on either side, where the range setters are missile units (archers, ballistae, catapults) and wall defences (traps, abatis, defensive trebuchets, archer towers). **Rolling logs never set the range.**

| Name | Field | Set by (base range) | Needs |
|---|---|---|---|
| Long range | 5200 | trap, abatis or defensive trebuchet (5000) | at least one of the three, on the wall |
| Narrow range | 1400 | archer (1200) | no traps, abatis, trebuchets, ballistae or catapults; at least one archer |
| Compact defence | 1500 | archer tower (1300) | no traps, abatis, trebuchets, archers, ballistae or catapults; at least one archer tower. Rare |
| Close range | 1600 | ballista (1400) | no traps, abatis, trebuchets or catapults; at least one ballista |
| Wide range | 1700 | catapult (1500) | no traps, abatis or trebuchets; at least one catapult |

- One trap, abatis or trebuchet is enough to make a long-range battle.
- The missile unit setting the range may be on either side.
- Players call all the short fields (1400–1700) "short range" or "compact".

The author proved the short fields with battle reports:
- **1600:** cavalry with Horseback Riding 10 move 1500 and reach 100, so they strike to 1600. They killed archers when the defence held a ballista.
- **1700:** they killed nothing when it held a catapult instead.
- **Under 1800:** archers with Archery 10 (range 1800) hit the other side in round 1 on that 1700 field.

## Troop characteristics

**Base values:**

| Unit | Attack | Defence | Range | Speed | Load | Life | Food | Population |
|---|---|---|---|---|---|---|---|---|
| Worker | 5 | 10 | 10 | 180 | 200 | 100 | 1 | 1 |
| Warrior | 50 | 50 | 20 | 200 | 20 | 200 | 1 | 1 |
| Scout | 20 | 20 | 20 | 3000 | 5 | 100 | 2 | 1 |
| Pikeman | 150 | 150 | 50 | 300 | 40 | 300 | 3 | 1 |
| Swordsman | 100 | 250 | 30 | 275 | 30 | 350 | 3 | 1 |
| Archer | 120 | 50 | 1200 | 250 | 25 | 250 | 4 | 2 |
| Cavalry | 250 | 180 | 100 | 1000 | 100 | 500 | 9 | 3 |
| Cataphract | 350 | 350 | 80 | 750 | 80 | 1000 | 17 | 6 |
| Transporter | 10 | 60 | 10 | 150 | 5000 | 700 | 5 | 4 |
| Ballista | 450 | 160 | 1400 | 100 | 35 | 320 | 25 | 5 |
| Battering ram | 250 | 160 | 600 | 120 | 45 | 5000 | 50 | 10 |
| Catapult | 600 | 200 | 1500 | 80 | 75 | 480 | 125 | 8 |

**At research level 10,** the guide's second table multiplies:
- speed by 2 for foot units and by 1.5 for mounted units and siege engines (Compass, Horseback Riding);
- load by 2;
- attack, defence and life by 1.5 (Military Tradition, Iron Working, Medicine).

So cavalry move 1500, archers 500, pikemen 600 and swordsmen 550. Missile range is ×1.5: archers 1800, ballistae 2100, catapults 2250.

That table also multiplies the *melee* units' reach by 1.5, which contradicts the guide's own rule that Archery doesn't extend melee reach. Read melee reach from the base table.

**Defending at wall 10:** the guide's third table gives defending archers 2400 range and ballistae 2800, from its wall rule under Shooting below. It leaves catapults at 2250, and lists the catapult's population as 3000, an obvious slip.

## Movement

- **Where they start:** the attacker at 0, moving up the field; the defender at the far end (1400 … 5200), moving down.
- **Order:** the fastest unit in the whole battle moves first, then the next fastest, and so on. On equal speed the defender moves first.
- **How far:** each unit moves its full speed, or until it meets an enemy. It never passes one: two forces that meet stop and fight.
- **Scouts and transporters** don't move until everything else in their army is dead, on either side. Then they advance.
- **Missile units stand and shoot:** an archer, ballista or catapult with an enemy in range doesn't move that round; otherwise it moves at its normal speed.

**Worked example.** All research 10, on a 5200 field:
- 1 cavalry against 1 cavalry:
  - Round 1: the defender's cavalry moves first, to 3700, then the attacker's moves to 1500.
  - Round 2: the defender's moves to 2200, and the attacker's moves only 700, to 2200, where they meet and fight.
- With 1 pikeman and 1 swordsman added to each side:
  - After round 1: the attacker's cavalry, pikeman and swordsman are at 1500 / 600 / 550, and the defender's at 3700 / 4600 / 4650.
  - After round 2: the attacker's are at 2200 / 1200 / 1100, and the defender's at 2200 / 4000 / 4100.

## Close combat

**Reach:** a melee unit can hit anything within its position plus its range. Melee units are workers, warriors, scouts, pikemen, swordsmen, cavalry, cataphracts, transporters and battering rams. Archery doesn't add to a melee unit's range.

**Who a melee unit hits** (the guide's order):
1. The enemy missile group (archers, ballistae, catapults) with the highest total attack (attack × count).
   - The author's evidence: 10,000 cavalry, against 300k warriors, 100k pikemen, 100k swordsmen and 100k archers, hit the archers, though the warriors and pikemen had more total attack.
   - **The author warns this may be wrong:** he suspected it came from the cavalry's damage bonus against archers. (Our engine doesn't do it; see [combat-guides.md](combat-guides.md).)
2. Otherwise, the melee group with the highest total attack.
   - Shown with 2,001 warriors (150,075) against 1,000 swordsmen (150,000): the warriors were hit.
   - With 999 warriors (74,925) against 500 swordsmen (75,000): the swordsmen.
3. On an exact tie, the author guessed (without proof) that the faster unit is hit.

**Striking:**
- Both sides strike in a fight, not just one.
- When several groups on one side are locked in combat, the fastest strikes first. A slower group picks its target only after the faster one has struck, so if the faster one wiped out its target, the slower one moves on to the next.

## Shooting

- **Missile units:** only archers, ballistae and catapults. **Battering rams are melee,** despite their reach of 600.
- **Defenders' range:** defending missile units get **+5% range per wall level** (wall 10 with Archery 10: archers 2400).
- **Standing:** any missile unit with an enemy in range stands and shoots.
- **Several shooters on one target:** the fastest fires first. If the target is killed, the next shooter looks for another target in range.
- Long-range battles follow the same speed rules as short ones.

**Who a missile unit hits,** attacking or defending alike:
1. Archer towers.
2. The enemy missile group with the highest total attack.
   - Shown with 100k archers against 1 ballista and 1 catapult: the archers.
   - With 1,000 ballistae against 100 catapults: the ballistae.
   - Defending archers against 1k each of archers (180k total), ballistae (675k) and catapults (900k) hit the catapults, then the ballistae, then the archers.
3. The fastest enemy unit, scouts included.
   - Shown with cataphracts, then pikemen, then swordsmen as each was taken away.
   - The guide's recap says "besides scouts" in one place and "including scouts" in another.

## Casualties (the version 2 formulas)

Kills in one volley or strike, for one round:

- **Casualties** = Attack / Effective life
- **Attack** = base attack × War Horn (1.2) / 100 × ((hero attack + Excalibur bonus) / 2 + Military Tradition × 5 + 100) × number of troops
- **Excalibur bonus** = a quarter of the hero's *base* attack (without gear or stars)
- **Effective life** = Life / (1 − Defence)
- **Life** = (Medicine × 5 + 100) / 100 × (base life × star-set multiplier + hero Intelligence)
- **Defence** = (Iron Working × 5 + 100) / 100 × (base defence × Corselet (1.2)) / 1000
- **Star-set multiplier** for troop life: ×2 with a 9- or 12-star set, ×3.2 with a 15-star set.
- **Range falloff:** within half its range (the "rapid fire" range: under 900 for archers at 1800), a shot does full damage; beyond, half. The guide adds a table: 1–49% of range full, 50–99% half, exactly 100% a quarter.

The guide's worked examples apply its own formulas inconsistently. Their figures are kept here as given, but they don't all follow from the formulas above.

| Example | Inputs | Guide's result |
|---|---|---|
| 100k archers shoot 100k archers | both heroes 500 attack, 85 Intelligence, 9-star set; War Horn and Corselet; all research 10 | Defence 0.09, life 835, effective life 917.58, attack per archer 576. Its 576 × 100,000 is written as 576,000, giving 627 kills; done correctly, about 62,800 |
| 60k ballistae shoot 3.5M warriors, beyond rapid-fire range | attacker 832 attack, 85 Intelligence, 12-star set; defender 439 attack, 142 Intelligence, 9-star set; both War Horn and Corselet, research 10 | Attack 183,384,000; life 732 (with Intelligence 132, not 142); defence 0.1125 (warrior defence 75, not 50); 111,171 killed, or 74,520 with a 15-star set |
| 100k archers shoot 10M archers | attacker 921 attack (base 184), 85 Intelligence, Excalibur; defender 23 attack, 923 Intelligence, 15-star set; both War Horn and Corselet, research 10 | Attack 91,224,000; life 2,584.5; effective life 2,840.10; 32,119 within rapid-fire range, 16,059 beyond |

## Tactics

Named attacks, with the conditions the author gives:

- **Archer sniping with cavalry:**
  - Needs a field of 1600 or less, and an enemy with no cavalry.
  - Send 100k cavalry or more. Moving first, they reach the enemy at once and spend a round on the archers (by the targeting rule above).
  - The author's best: 450k archers killed for 35k cavalry lost, with 65% healing.
- **Cavalry Jaq:**
  - Needs a field of 1600 or less, and an enemy with only missile units (no cavalry, cataphracts, pikemen, swordsmen, warriors, workers or rams).
  - Send ballistae, archers and scouts in a 1 : 3 : 5 ratio, and cavalry for the rest, enough to avoid spread damage.
  - Catapults would stretch the field to 1700. The enemy's missiles shoot the ballistae, archers and scouts first, buying the cavalry rounds against the archers.
- **Archer sniping with archers:**
  - Needs a 5200 field, and an enemy with no cavalry, cataphracts, pikemen or swordsmen.
  - Send 1k cavalry and 99k archers. The cavalry draw the defending archers' fire while the attacking archers close the 600-yard range gap.
  - The author reports 20k–150k archers killed in one hit, depending on hero and star set.
- **Impure Jaq:**
  - Needs a field of 1600 or less, and an enemy with no cavalry, cataphracts or catapults.
  - Send ballistae, archers and scouts at 1 : 3 : 5, 10k cavalry, and cataphracts for the rest.
  - The cavalry hold the enemy while the cataphracts get one round on the archers. The author reports up to 850k archers.
- **Pure Jaq:**
  - Needs a field of 1700 or less, and an enemy with no melee units (and ideally no archer towers, which cost a round).
  - Send catapults, ballistae, archers and scouts at 1 : 1 : 3 : 5, and cataphracts for the rest.
  - Each missile type the enemy has costs the cataphracts rounds, because the enemy shoots one of the attacker's missile groups (then the scouts) each round first. That's four rounds against archers alone, about one against archers, ballistae, catapults and towers. The guide traces it round by round.
- **Ram smack:** against infantry.
  - Needs a field of 1700 or less, and an enemy with no missile units.
  - Send 1k each of workers, warriors, pikemen, swordsmen, cavalry and cataphracts as layers; 30k ballistae and catapults together; and 89k or more rams; with a high-attack hero.
  - The layers hold the enemy while the rams (reach 600) strike from a distance. The ballistae and catapults clear the enemy's small groups first, since those are the fastest targets.
- **Four-second kill:** an alliance attack landing in four consecutive seconds:
  1. scout and cavalry waves to clear the traps, abatis and trebuchets, making it a short field;
  2. pikemen to kill the cavalry;
  3. archer waves, each with 10k cavalry, to kill the towers and missile units;
  4. a ram smack from a player holding a level 14, 16 or 18 historic city.

## Tips

- **Keep at least one catapult** in a city: on a 1700 field, cavalry can't strike in round 1.
- **Protect food** by sending it to a valley with transporters, then recalling it.
- **Against a rainbow attack,** keep small layer groups (about 500 each of warriors, pikemen and swordsmen and 250 each of cavalry and cataphracts) camped at a valley on a timer. Recall one when attacked, so you lose only that.
- **Teleporting in as a group:** capture NPC cities and use a random teleport on them to free spots for allies.
- **Mixed research:** Compass at 8 rather than 10 is sometimes chosen to change the timing against players who copy standard attacks. Different research levels may also make historic cities easier to take. The thread breaks off mid-section.
