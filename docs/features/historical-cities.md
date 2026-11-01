# Historical cities: seats of power

**Status:** design only, nothing built. The rule change it waits on (traps and ranged groups against walls) is done (2026-10-20). Work started 2026-11-01 with the spikes below (Phases): the art, a way to find any tile on the map, simulations of breaking one, and landing armies at a chosen second ([camp-times.md](camp-times.md)). Moved out of [market-and-factions.md](market-and-factions.md) on 2026-10-24, where it was first worked out as the factions' seats of power. TODO.md item: *Historical cities.*

**The aim:** big NPC cities above today's level 10, as prizes for strong players and alliances. **A historical city is the seat of power over an area of the map.** An NPC faction holds it until a player takes it. The bigger the city, the bigger its area and the more it brings its holder.

## Where things stand

- NPC cities go from level 1 to 10: 51,217 on the 800 × 800 map, 990 of them at level 10 (counted 2026-10-19; [market-and-factions.md](market-and-factions.md), Where things stand). One at full strength keeps nothing in the database (`tiles.troops`, `forts` and `state` stay null until it is touched).
- A barbarian city loses 10 to 15 loyalty for each win against it and is captured at 0 if the attacker's title allows another city, keeping its buildings. Players' cities have no loyalty and can't be captured (*(design change)*, deviations.md).
- The five NPC factions hold the 16 states (zones), from level 5 up, as fixed data (`shared/core/src/factions.ts`), and trade with each other and with players (market phases 2 and 3). Each player has a standing with each faction (reputation, market phase 4, 2026-10-31), which an attack on a member lowers.
- **NPC garrisons refill on a clock:** 10% of the full troops and fortifications every 6 game minutes (`BALANCE.npcRegenMs`, `regenerateNpc` in `shared/core/src/world.ts`), and 1 loyalty every 6 real minutes. Age 2's historic cities refilled at the same rate (reference, Regeneration).
- **Armies can't be timed:** an army leaves the moment it's sent, and armies due at the same moment land in no fixed order ([camp-times.md](camp-times.md), Where things stand).
- How Age 2 placed and used its historic cities, at every level: [reference/historic-cities.md](../reference/historic-cities.md). Their garrisons against our NPC cities' are in [reference/npc-cities.md](../reference/npc-cities.md). Age 2's colonies are a model for a holder's powers: [reference/colonies.md](../reference/colonies.md). Age 1 had none of this.

## Decided

- **A design of its own** (2026-10-24): moved out of the market and factions design. It ties into the factions (seats move borders, taking one costs standing), but it is a feature in its own right, mostly about combat and holding land, and can be built apart from the market's later phases.
- **The ballista rule change first** (2026-10-20, done the same day): traps hit only ground troops, and ranged groups stop once the wall is in range ([reference/ballista-farming-and-wall-range.md](../reference/ballista-farming-and-wall-range.md); deviations.md). Taking a seat is a fight against fortifications, so the rule had to be settled first.
- **Garrisons refill every second** (2026-11-01): a historic city's troops and fortifications come back a little every second, at 10% of the full garrison every 6 minutes in all (about 311 warriors a second at level 12), as Age 2's seem to have done, not in our NPC cities' 6-minute steps. Every second between waves then costs the attacker, so landing waves together matters ([camp-times.md](camp-times.md)).
- **Historic cities have research** (2026-11-01, from the simulations): every research at 10 but Archery, which stays at 0, with Age 2's garrisons, fortifications and heroes as they were. Without research the garrison barely fought back and a level 12 fell to one wave of archers; with Archery 10 too, its catapults and ballistae outranged every attacker and a level 16 could only be taken on a day with rams ([battle-sims/historic-cities.md](../battle-sims/historic-cities.md), Tuning).
- **Every NPC city and valley refills every second too** (2026-11-01, the maintainer): one rule for all of them, little by little, with the historic cities harsher only because their garrisons are bigger. A rule change of its own, built before the seats (TODO.md, *NPC garrisons refill every second*), and recorded in deviations.md then. Today an NPC city gains 10% of its troops and fortifications every 6 game minutes in one step, and a valley rolls a whole new garrison 6 minutes after its last one (`valleyDefenders`, `engine/combat.ts`). To settle when it's built:
  - the valleys' rate: 10% a 6 minutes like the cities (full in an hour, where today it's whole again after 6 minutes), or whole in 6 minutes, a little at a time;
  - whether resources (1/80 a 6 minutes) and loyalty (1 a 6 real minutes) go by the second too, or only troops and fortifications;
  - farming changes: a level 10 hit again a few minutes later meets a part-refilled garrison rather than the same one ([battle-sims/npc-level-10.md](../battle-sims/npc-level-10.md) to re-check), and the medal trick of hitting a valley the moment it rolls a new garrison ([reference/aeroagg-complete-guide.md](../reference/aeroagg-complete-guide.md), Medals and gems) goes.
- **Spikes first, jump to coordinates the first of them** (2026-11-01; Phases).
- **Its place in the market's phases** (2026-10-20, changed 2026-10-22): first planned straight after the faction data, since most of a seat's value (capture, the daily draft, the title, bigger armies) doesn't need NPC trade. On 2026-10-22 NPC trade and reputation moved ahead of it. NPC trade is built, so a seat's tribute from trade and its market rights can come with it. Whether it waits for reputation is open (below).

## The design (proposed)

### Where they stand

**One area per seat, nested in a grid,** following the original game where it had them: Age 2's historic cities. Areas are worked out from coordinates, like faction membership, with nothing stored per tile.

| Seat | How many | Area it rules | Where | From |
|---|---|---|---|---|
| Level 18 | 1, Atlantis | the whole world, lightly | (0, 0), in Friesland. The map wraps, so this is where the corners of Friesland, Bohemia, Burgundy and Romagna meet | Age 2 |
| Level 16 | 16, one per state | its state, 200 × 200 tiles | the middle of each state, (x0 + 100, y0 + 100): (100, 100), (300, 100) … (700, 700) | Age 2, exactly |
| Level 14 | 128, eight per state | its cell of a 3 × 3 grid over the state, about 66 × 66 tiles (the middle cell is the level 16's) | (x0 + a, y0 + b) for a and b in {33, 99, 165}, except (99, 99) | Age 2, exactly |
| Level 12 | 1,936, 121 per state | its 18 × 18 cell (Age 2's draft area, 4 drafts a day) | every 18 tiles from offset 9 across and down, (x0 + 9, y0 + 9) … (x0 + 189, y0 + 189), one of them (x0 + 99, y0 + 99) beside the capital | Age 2's rule and count |

- Every position is the original's (Age 2), and they already fit our map: the same 16 states on the same 200 × 200 grid (`stateOf`).
- **1,936 level 12s is a lot,** against 51,217 ordinary NPC cities. In Age 2 they were the common first prize and a stepping stone towards the bigger cities. We could keep them all, or use fewer (every other place), which leaves a level 12's draft area 36 × 36 instead.
- One source marks two of Romagna's level 14 places "Atlantis", which doesn't fit Atlantis at (0, 0) (reference note). We'd place all 128.
- **What Age 2 gave the holder** (reference note): a level 12 drafts 4 times a day from its 18 × 18 area, and every historic city raises the largest army its holder can send from it: 125,000 from a level 12, 150,000 from a level 14, 200,000 from a level 16 (a quarter more with a War Ensign). A captured historic city became the player's own city.
- The seats are new NPC cities at levels above today's 10, placed by a migration over whatever tile is there.
- **Age 2's rules for holding one** (reference, Holding one): a 24-hour truce on capture; a player's own truce never covers it and it can't be teleported; no buildings inside, its fields empty but one of each resource; four policies a day in its area (draft, disarm, sow discord, move population, levy food or gold), a draft taking 5% of a city's largest troop type; a level 14's area its 66-tile cell, a 16's its state, Atlantis the whole map.
- Historic cities aren't in Age 1, so adding them is a deviation (*(design change)* in deviations.md, pointing to the reference note).

### Their garrisons (proposed)

**Age 2's garrisons** ([reference/historic-cities.md](../reference/historic-cities.md), Garrisons): troops 2.5 times larger a level (twice from 16 to 18), the same fortifications at every level.

| | Level 12 | Level 14 | Level 16 | Level 18 |
|---|---|---|---|---|
| Warriors | 1,120,000 | 2,800,000 | 7,000,000 | 14,000,000 |
| Swordsmen or pikemen | 162,666 | 406,666 | 1,016,665 | 2,033,330 |
| Archers | 42,807 | 171,228 | 428,070 | 856,140 |
| Cavalry or cataphracts | 108,444 | 271,111 | 677,777 | 1,355,555 |
| Ram, ballista or catapult | 14,640 | 36,600 | 91,500 | 183,000 |
| Fortifications (every level) | 22,000 traps, 11,000 abatis, 6,666 archer towers, 6,000 rolling logs, 5,000 defensive trebuchets | | | |

- **A daily rotation,** as in Age 2: swordsmen or pikemen, cavalry or cataphracts, and one of the three siege engines, changed each day, so scouting first pays (12 garrisons). Worked out from the date and the city's position, so nothing is stored.
- **Refilling:** 10% of the full garrison every 6 minutes, like our NPC cities and Age 2's, but a little every second rather than in steps (Decided).
- **Their research** (Decided): every research at 10 but Archery. **Loyalty** isn't in any source; the simulations take 100 and 3 a win. A level 10 NPC city starts at 90 loyalty and loses 10 to 15 a win (`BALANCE.npcLoyaltyStart`, `npcLoyaltyDamagePerAttack`), so about 7 wins take it; Age 2's level 12 took 30 to 40 or more loyalty waves.
- The walls and the hero are as Age 2's (the walls at the city's level, the hero AeroCalc's); the simulations found neither changes much.

### On the map

- **Their own sprites,** one per level, from the maintainer's screenshots of the original's (2026-11-01) as a reference for style, never traced or converted: a square stone fortress with red flags at level 12, a taller keep with green-roofed towers at 14, a larger keep with spires and blue flags at 16, and a grand gothic castle with gold flags at 18, its walls greener with moss each level. The flag colours are Age 2's (red, green, blue, gold; reference, Level 14). Drawn in `tools/art/tiles.ts` like the castles and barbarian camps (64×64, the tile's middle at (32, 46)), perhaps larger than one tile for the bigger ones (to decide).
- **Finding one:** the coordinates on the world map's toolbar open a box to jump to any x and y (built 2026-11-01). Later, perhaps, a list of the historic cities near you.

### Testing how they're broken

Before any of it is built, the battle simulations (`tools/battle-sim`, [docs/battle-sims](../battle-sims/README.md)) find out what breaking one takes in our engine, so the garrisons can be tuned before players meet them. A spike:

- **A siege in the simulator:** a list of waves, each with its troops, hero and landing time (seconds from the first), fought one after another against a historic city's garrison, which carries over between waves (troops and fortifications lost, traps used up) and refills on the clock between them. Each wave's report: what it lost, what's left of the garrison and the fortifications, and the loyalty.
- **Questions to answer,** per level and per daily garrison:
  - the cheapest plan that breaks it: how many trap-clearing waves, what main waves (archers, pikemen, ballistae), how many loyalty waves, and the troops lost;
  - the weakest attacker that can do it: hero attack and level, gear level and stars, research, items (War Ensign, horns);
  - how much the timing matters: the same plan with waves 1, 5, 20 and 60 seconds apart, and across a refill;
  - whether Age 2's plans (reference, Taking one) still work, and what a level 12 then is worth against a level 10 NPC city.
- **Findings** (2026-11-01, [battle-sims/historic-cities.md](../battle-sims/historic-cities.md)), with Age 2's garrisons refilling every second, the cities' research (Decided) and 3 loyalty a win:
  - **Every level can be broken with archer waves,** whatever the hero; gear and research only change the cost. The maintainer's account breaks a level 12 with 2 waves (123M lost), a 14 with 7, a 16 with 19 (2.1 billion, about 2M archers) and an 18 with 39 (4.4 billion); an ungeared hero takes about twice the waves. Each level is about 2.5 times the one below, like the garrisons.
  - **The daily garrison changes what to send:** pikemen waves first on a cataphract day, then archers.
  - **Timing pays in the loyalty phase:** waves a minute apart make the loyalty waves fail against the refill at levels 16 and 18, three minutes apart at 14.
  - **Loyalty sets how many cities a siege needs:** 34 wins at 3 a win is 4 cities' armies (10 each with Rally Spot 10) even at level 12; a level 18 takes 7 to 9.

### What holding a seat brings

Scaled by the seat's size. Each benefit applies to the seat's area:

- **Troops:** draft a share of the troops of the NPC cities in the area, once a day. So "neighbouring" (the TODO's first question) means the seat's area. In Age 2 a holder could also draft from *players'* cities in range, and players hid their troops by reinforcing allies, since reinforcements can't be drafted ([reference/historic-cities.md](../reference/historic-cities.md), Drafting). That would undo much of our decision that players' cities can't be captured, so the proposal is NPC cities only.
- **Tribute:** a share of what the area's NPC cities produce or earn by trading, paid in gold or resources. Age 2's colonies are a ready model: the suzerain took a share of production and one policy a day (draft, disarm, take population, sow discord), and the colony could rise up ([reference/colonies.md](../reference/colonies.md)).
- **Market rights:**
  - a share of the fees on trades in the area;
  - with regional prices, a say over the area's market: a toll or tax rate within limits, or an embargo on a faction or player;
  - better prices with the factions that like you.
- **Knowledge:** the area's forecasts sooner or more accurately. The NPC groups' stock and wants in the area are visible.
- **Relief:** spend to shield the area from acts of god (dykes against floods, granaries against drought). That's good for the holder and for every player there.
- **Prestige and title:**
  - A level 16 makes its holder that state's ruler, such as Duke of Saxony.
  - The level 18 makes its holder the ruler of the world, an Emperor-like title (a name to choose), with something across the whole map.

Forecasts, acts of god and regional prices are later phases of the market design ([market-and-factions.md](market-and-factions.md)); those benefits arrive with them.

### How it ties into factions

- **Seats are how borders move.** A state belongs to the faction that holds its level 16 seat. When a rival faction takes that seat, the state and its member cities change sides. That's the factions' "borders can move" mechanism, with an event on the map to show it.
- **Taking a seat from a faction** costs a lot of standing with that faction, and may gain some with its rivals. The faction tries to win the seat back, which is where retaliation (market phase 6) matters most.
- **When a player holds a state's level 16,** the NPC members in the state are cut off from their faction. They could stay members but pay their tribute to the player, or become the player's own for drafting and tribute. To decide.
- A faction a player has angered could send reinforcements to a member under attack, the reverse of the draft (an idea in the market design, Factions).

### Keeping it from snowballing

Seats are prizes for strong players and alliances, so one early player must not be able to take them all.

- **Holding costs something:** upkeep in gold and food that rises with every seat a player holds, and a garrison that has to stay.
- **Limits:** at most one level 16 per player, say. Seats would also count against the city limit if a captured seat is a city.
- **Unrest:** an area may rebel if neglected (no garrison, no relief after a disaster), and the faction attacks it.
- **Alliances:** a seat's benefits can be shared with its holder's alliance, which makes them alliance goals, as the big prizes in Evony were.

### How the database holds it

A seat is a tile like any NPC city. Its holder is the tile's existing `owner_city_id` and `owner_player_id`, and capturing it uses the barbarian cities' loyalty-to-zero rule (deviations.md). Its area is worked out from its coordinates. So a seat adds no new kind of storage beyond its benefits' timers, such as the daily draft.

## Open questions

- **The seats:** all four levels follow Age 2 (proposed). Keep all 1,936 level 12s, or fewer?
- **The garrisons:** keep the daily rotation (it changes what to send, not whether a city can be taken)?
- **Loyalty:** where it starts and what a win takes; it decides how many cities a siege needs.
- **Capture:** does a captured seat become the player's city, as in Age 2, and so count against the city limit? How hard is it to take (its garrison and fortifications against a level 10's)?
- **The draft:** what share of each city's troops (50%?), how often (once a day, or Age 2's 4 for a level 12), and what happens to drafted troops when the seat is lost?
- **Drafting players:** Age 2 let a historic city's holder draft other players' cities in range. Leave that out (the proposal), or allow it with protection (reinforcements, beginners)?
- **The benefits:** what does each seat bring, and how much? What does the level 18 bring?
- **A state's NPC members** when a player holds its level 16: still the faction's, paying tribute to the player, or the player's own?
- **Holding:** what limits it (upkeep, one level 16 per player, unrest)? Are benefits shared with the holder's alliance?
- **Famous guards:** famous historical heroes (TODO.md) guarding the seats, once that feature exists.

## Phases

**Spikes first** (2026-11-01), each its own TODO item, to settle the numbers and the tools before the seats are built:

- **A. Jump to coordinates** on the world map: done 2026-11-01 (the coordinates on the map's toolbar open a box to type any x and y).
- **B. The art:** the four historic city sprites (On the map, above).
- **C. Simulations of breaking one:** done 2026-11-01 (Testing how they're broken, above): `npm run sim -- siege`, its findings, and the cities' research tuned so every level and every day can be taken at a rising cost. Loyalty's numbers are still open.
- **D. Camp times** ([camp-times.md](camp-times.md), its phase 1): armies landing at a chosen second, in order. Needed before players can break one as the simulations do.

Then:

1. **The seats on the map:** the historical cities placed by a migration, with their areas (from coordinates), garrisons and daily rotation, shown on the map with their art. deviations.md gets its entry.
2. **Capturing and holding them:** the loyalty rule at their levels, the truce, the daily draft, titles and the larger armies, and what holding costs.
3. **Tribute and market rights,** on top of NPC trade (built).
4. **Seats deciding which faction holds a state,** with the market's relations and retaliation (market phase 6), and the standing taking a seat costs (reputation is built).

Each phase records its rule changes in deviations.md (*(design change)*) and its numbers in `BALANCE`.
