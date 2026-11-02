# Historical cities: seats of power

**Status:** phases 1 and 2 built 2026-11-01: the seats stand on the map (tile type `HISTORIC`, `shared/core/src/historic.ts`), can be scouted, attacked, captured into a player's city and taken from its holder, and a held seat drafts from barbarian cities in its area and pays its holder a tribute in gold; the capitals and Atlantis bring a title and a share of market fees (phase 3 in part). Faction standing for seats, states under a player ruler (a held capital cuts its state off from its faction), and upkeep, unrest and alliance sharing built 2026-11-01. Left: the open questions below, and angry factions (TODO.md). The spikes before it (Phases) are done: the art, a way to find any tile on the map, simulations of breaking one, landing armies at a chosen second ([camp-times.md](camp-times.md)) and per-second refills. Moved out of [market-and-factions.md](market-and-factions.md) on 2026-10-24, where it was first worked out as the factions' seats of power. TODO.md item: *Historical cities.*

**The aim:** big NPC cities above today's level 10, as prizes for strong players and alliances. **A historical city is the seat of power over an area of the map.** An NPC faction holds it until a player takes it. The bigger the city, the bigger its area and the more it brings its holder.

**Names:** *HC* is short for historical city, as Age 2's players wrote it, and a level is put in front: an *L14 HC* is a level 14 one. The same thing is a *historic city* in the code and the game's text (`TileType.HISTORIC`, `historicLevel`, "Historic city" on the map) and a *seat* (of power) in this design. Player-facing text writes the name out in full; the abbreviation is for these docs, notes and talk between players, and (2026-11-02, the maintainer) the badge marking a held one in the city list and switcher: "HC" with a castle in its flags' colour, the level and full name in its title.

## Where things stand

- NPC cities go from level 1 to 10: 51,217 on the 800 × 800 map, 990 of them at level 10 (counted 2026-10-19; [market-and-factions.md](market-and-factions.md), Where things stand). One at full strength keeps nothing in the database (`tiles.troops`, `forts` and `state` stay null until it is touched).
- A barbarian city loses 10 to 15 loyalty for each win against it and is captured at 0 if the attacker's title allows another city, keeping its buildings. Players' cities have no loyalty and can't be captured (*(design change)*, deviations.md).
- The five NPC factions hold the 16 states (zones), from level 5 up, as fixed data (`shared/core/src/factions.ts`), and trade with each other and with players (market phases 2 and 3). Each player has a standing with each faction (reputation, market phase 4, 2026-10-31), which an attack on a member lowers.
- **NPC garrisons refill on a clock:** 10% of the full troops and fortifications every 6 game minutes (`BALANCE.npcRegenMs`, `regenerateNpc` in `shared/core/src/world.ts`), and 1 loyalty every 6 real minutes. Age 2's historic cities refilled at the same rate (reference, Regeneration).
- **Armies can be timed** (camp times, 2026-11-01): an army can be set to land at a chosen second, and armies landing together fight in the order sent ([camp-times.md](camp-times.md)).
- How Age 2 placed and used its historic cities, at every level: [reference/historic-cities.md](../reference/historic-cities.md). Their garrisons against our NPC cities' are in [reference/npc-cities.md](../reference/npc-cities.md). Age 2's colonies are a model for a holder's powers: [reference/colonies.md](../reference/colonies.md). Age 1 had none of this.

## Decided

- **A design of its own** (2026-10-24): moved out of the market and factions design. It ties into the factions (seats move borders, taking one costs standing), but it is a feature in its own right, mostly about combat and holding land, and can be built apart from the market's later phases.
- **The ballista rule change first** (2026-10-20, done the same day): traps hit only ground troops, and ranged groups stop once the wall is in range ([reference/ballista-farming-and-wall-range.md](../reference/ballista-farming-and-wall-range.md); deviations.md). Taking a seat is a fight against fortifications, so the rule had to be settled first.
- **Garrisons refill every second** (2026-11-01): a historic city's troops and fortifications come back a little every second, at 10% of the full garrison every 6 minutes in all (about 311 warriors a second at level 12), as Age 2's seem to have done, not in our NPC cities' 6-minute steps. Every second between waves then costs the attacker, so landing waves together matters ([camp-times.md](camp-times.md)).
- **Historic cities have research** (2026-11-01, from the simulations): every research at 10 but Archery, which stays at 0, with Age 2's garrisons, fortifications and heroes as they were. Without research the garrison barely fought back and a level 12 fell to one wave of archers; with Archery 10 too, its catapults and ballistae outranged every attacker and a level 16 could only be taken on a day with rams ([battle-sims/historic-cities.md](../battle-sims/historic-cities.md), Tuning).
- **Every NPC city and valley refills every second too** (2026-11-01, the maintainer): one rule for all of them, little by little, with the historic cities harsher only because their garrisons are bigger. Built 2026-11-01 (deviations.md, NPC cities), as settled with the maintainer that day:
  - a valley is whole again 6 minutes after a battle (its pace today), a little every second, and only then rolls a new garrison;
  - only troops and fortifications go by the second; resources (1/80 a 6 minutes) and loyalty (1 a 6 real minutes) keep their steps;
  - farming changes: a level 10 hit again within the hour meets a part-refilled garrison ([battle-sims/npc-level-10.md](../battle-sims/npc-level-10.md) notes it), and the medal trick of hitting a valley the moment it rolls a new garrison ([reference/aeroagg-complete-guide.md](../reference/aeroagg-complete-guide.md), Medals and gems) is gone.
- **The seats as decided with the maintainer** (2026-11-01): all 1,936 level 12s (Age 2's grid), and loyalty starting at 100 with 3 taken a win (about 34 loyalty waves, as Age 2's 30 to 40).
- **Capturing and holding one** (2026-11-01, the maintainer):
  - **A captured seat becomes the player's city,** counting against the title's city limit. Inside, every building is level 10, the layout of a captured level 10 barbarian city (`npcCityBuildings(10)`); its fields go up to the seat's level (a level 14 has level 14 farms), with yields carried on in proportion past level 10. Its level can't be raised for gold as a barbarian city's can. (Our reading of the maintainer's "players cannot upgrade historical cities like NPCs".)
  - **Its Rally Spot sends a quarter more a level step**, without items: 125,000 troops from a level 12, 150,000 from a 14, 175,000 from a 16 and 200,000 from Atlantis. A War Ensign adds its quarter on top (our reading, as Age 2's table did: 156,250 from a level 12).
  - **Holding limits:** at most 3 level 12s, 2 level 14s, 1 level 16 and 1 level 18 per player, each also needing a free city slot.
  - **Drafting** from barbarian cities in its area only, never players' cities, at 20% (Age 2 took 5%) of the largest troop type; Atlantis drafts from anywhere. Later: there's a fair amount of work to it.
  - **The daily draft** (2026-11-01, the maintainer): 4 drafts a UTC day per seat, each taking 20% of a barbarian city's largest troop type into the seat (the barbarian city refills it as usual). **Automatic by default**: the seat drafts by itself, one draft each 6 hours of the day (from 00:00 UTC), starting at the next 6-hour mark after it was captured or switched to automatic, without making up the marks before (2026-11-01, the maintainer: a seat captured at 22:22 had made the day's 4 drafts in 4 minutes), from the highest-level barbarian cities in its area; among several it scouts them all (needing at least one scout in the seat; our reading: none is sent or lost, and no scout reports) and drafts from the one with the most troops, at random between equals; with no scouts it picks at random among them. The player can switch a seat to **manual** and choose each draft from a barbarian city's tile card instead.
  - **Four different cities a day, and lower seats too** (2026-11-02, the maintainer): a seat's 4 drafts a day each take from a different city: one it has drafted today is refused (`city.draftedToday`), skipped by its own pick (drafting by itself, Draft now) and greyed out on the map (`cities.drafted_tiles` with `draft_day`, migration 0041; core `draftedToday`). And a seat drafts from historic cities nobody holds of a lower level in its area as well as barbarian cities (core `canDraftFrom`): a level 12 from barbarian cities only, a 14 from level 12s too, a 16 from 12s and 14s, Atlantis from all three; the draft takes 20% of the lower seat's largest troop type from its garrison, which refills by the second as it does after a battle. Its own pick aims at the highest level first, so a level 14 or above drafts from the lower seats in its area before barbarian cities. Players' cities, held seats included, are still never drafted. To watch: a lower seat's garrison is far bigger than a barbarian city's (a level 12's 2.8 million warriors give 560,000 a draft), so the higher seats' drafts are worth much more than before.
  - **Titles, tribute and market rights** (2026-11-01, the maintainer):
    - **Titles** for the two highest seats only, worded neutrally: holding a state's capital (16) makes a player **Ruler of** that state, holding Atlantis **Sovereign of Atlantis**; shown beside the player's name (their highest), on the map's city cards, their own bar and the rankings.
    - **Tribute:** each seat pays its holder gold by the hour into the seat city, growing with level (`BALANCE.historic.tribute`: 2,000 at 12, 6,000 at 14, 20,000 at 16, 60,000 at Atlantis), per real hour.
    - **A share of market fees:** the holder of a state's capital gets 20% of the market fees cities in that state pay, Atlantis's holder 10% of every fee (`BALANCE.historic.feeShare`; our numbers), delivered to the seat as gold shipments.
  - **A held seat is taken the same way** (2026-11-01, the maintainer): its own loyalty falls 3 with each rival's win once its truce is over, and at 0 it goes to the winner; the city changes hands whole but for its troops, its old holder's heroes and armies going to their other city.
  - **Standing with the factions** (2026-11-01, the maintainer; built the same day): an attack on an unheld seat costs what attacking a member does (0.3 a level, so 3.6 at 12 to 5.4 at Atlantis) with the faction whose state it stands in, a capture 20 more, doubled for a state's capital or Atlantis; on a capture the factions bordering that one (its rivals, `factionRivals`) each give the captor half the capture's cost; each draft costs 1 with the drafted city's faction. Atlantis, at (0, 0), counts as the Saxon League's (our reading). Taking a seat from a player costs no standing: the faction lost it already. Numbers in `BALANCE.reputation.seat`.
  - **A state under a player ruler** (2026-11-01, the maintainer): while a player holds a state's capital, the state's barbarian cities are cut off from their faction: they don't trade, attacking or drafting them costs no standing, and the ruler gets a share of what they would have traded as tribute. When the capital goes back to the map (a restart, a deleted player, a rebellion), the state goes back to its faction.
  - **Retaliation stays prices only for now** (2026-11-01, the maintainer): an angered faction's worse prices and refusal to trade (built with reputation). Reinforcing its members, raiding players' cities and wars between factions are noted in TODO.md for later, not built.
  - **Holding costs and rewards** (2026-11-01, the maintainer; built the same day, our numbers in `BALANCE.historic`):
    - **Upkeep** in gold and food every real hour out of the seat (`upkeep`: 1,000 gold and 100,000 food at 12, 3,000 and 250,000 at 14, 10,000 and 600,000 at 16, 30,000 and 1.5M at Atlantis), all of a player's seats costing a quarter more for each other seat they hold (`risePerSeat`).
    - **Unrest:** a seat with fewer troops at home than its garrison (`unrest.garrison`: 5,000 at 12, 10,000 at 14, 20,000 at 16, 50,000 at Atlantis; our reading of "no troops", so one militia doesn't hold a city), or out of gold or food for its upkeep, loses a loyalty point every 12 real minutes for each and doesn't recover (100 to 0 in 20 hours, 10 with both). None under its truce after capture, while its holder brings troops in. At 0 it rises up: its holder leaves it as when it's taken (`evacuateSeat`), and it stands again, whole, as a historic city nobody holds, with a Historic City Rebelled report.
    - **Alliance sharing:** a quarter of the seat's tribute and a capital's state tribute (`allianceShare`) goes to the holder's alliance: the holder's own income is lower by that, and every whole real hour the share is split between the other members, into each one's oldest city. Out of an alliance, or alone in one, the holder keeps it all.
  - **Famous guards: a spike only** (2026-11-01, the maintainer): the famous historical heroes spike writes up how they could be won and guard the seats; nothing is built until the maintainer chooses.
  - Age 2's rules kept unless changed: a 24-hour truce on capture that a player's own truce never covers, no teleporting, and it can be taken back the same way.
- **Spikes first, jump to coordinates the first of them** (2026-11-01; Phases).
- **Its place in the market's phases** (2026-10-20, changed 2026-10-22): first planned straight after the faction data, since most of a seat's value (capture, the daily draft, the title, bigger armies) doesn't need NPC trade. On 2026-10-22 NPC trade and reputation moved ahead of it. NPC trade is built, so a seat's tribute from trade and its market rights can come with it. Whether it waits for reputation is open (below).

## The design (proposed)

### Where they stand

**One area per seat, nested in a grid,** following the original game where it had them: Age 2's historic cities. Areas are worked out from coordinates, like faction membership, with nothing stored per tile.

| Seat | How many | Area it rules | Where | From |
|---|---|---|---|---|
| Level 18 | 1, Atlantis | the whole world, lightly | (0, 0), in Friesland. The map wraps, so this is where the corners of Friesland, Bohemia, Burgundy and Romagna meet | Age 2 |
| Level 16 | 16, one per state | its state, 200 × 200 tiles | the middle of each state, (x0 + 100, y0 + 100): (100, 100), (300, 100) … (700, 700) | Age 2, exactly |
| Level 14 | 128, eight per state | its cell of a 3 × 3 grid over the state, about 66 × 66 tiles (the middle cell is the level 16's) | every 66 tiles from 33 across the whole map, x and y in {33, 99 … 759}, except each state's middle place by its capital | Age 2, exactly |
| Level 12 | 1,936, 121 per state | its 18 × 18 cell (Age 2's draft area, 4 drafts a day) | every 18 tiles from 9 across the whole map, x and y in {9, 27 … 783}, one of them beside each capital, (99, 99) … | Age 2's rule and count |

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

- **A daily rotation,** as in Age 2 (kept: the simulations found it changes what to send, not whether a city can be taken): swordsmen or pikemen, cavalry or cataphracts, and one of the three siege engines, changed each day, so scouting first pays (12 garrisons). Worked out from the date and the city's position, so nothing is stored.
- **Refilling:** 10% of the full garrison every 6 minutes, like our NPC cities and Age 2's, but a little every second rather than in steps (Decided).
- **Their research** (Decided): every research at 10 but Archery. **Loyalty** isn't in any source; the simulations take 100 and 3 a win. A level 10 NPC city starts at 90 loyalty and loses 10 to 15 a win (`BALANCE.npcLoyaltyStart`, `npcLoyaltyDamagePerAttack`), so about 7 wins take it; Age 2's level 12 took 30 to 40 or more loyalty waves.
- The walls and the hero are as Age 2's (the walls at the city's level, the hero AeroCalc's); the simulations found neither changes much.

### On the map

- **Their own sprites,** one per level (drawn 2026-11-01, `client/web/src/assets/tiles/historic-12.png` … `historic-18.png`, `historic` in `tools/art/tiles.ts`), from the maintainer's screenshots of the original's as a reference for style, never traced or converted: a square stone fortress with corner towers and red flags at level 12, green-roofed towers and a green-roofed keep at 14, slate spires and blue flags at 16, and pale spires round a gold-domed keep under gold flags at 18, moss growing up the walls more each level. The flag colours are Age 2's (red, green, blue, gold; reference, Level 14). One tile each, but **taller than anything else on the map** (asked 2026-11-01), each level taller than the last and Atlantis at (0, 0) tallest: first 96×96, then (asked 2026-11-02, "even larger", but kept within their tile, "just taller") 128×128 with walls, towers and keep about half as tall again or more (Atlantis's spire 83 pixels high), the tile's middle at (64, 94), where `spriteBox(128)` puts it, so the map draws them with `size: 128`. Drawing them wider than their tile was tried the same day and dropped: it spread over the neighbouring tiles. Only the level 12's red flags are animated for now (the town's flapping banner is red).
- **Their names** (2026-11-01): level 14s, 16s and Atlantis are named as in Age 2 (reference, Names), shown as the tile card's title and in the map's hover text (`historicName`, `client/web/src/lib/game-data.ts`, from the `data-historic` namespace keyed by place, `x,y`); level 12s, and Romagna's last two level 14s, which the source leaves nameless, are called Historic city.
- **A held one keeps its name** (2026-11-02, the maintainer: a level 14, 16 or 18 keeps its name when captured and can't be renamed). Capturing or taking a named seat gives the city its own name (`seatName`, `engine/combat.ts`, from core's `HISTORIC_NAMES` / `historicNameAt`), renaming it is refused (`city.historicKeepsName`; its logo can still change), and the city settings show why instead of the rename box. A seat without a name, every level 12, is named after its holder (`<name> Keep`) and renamed as any city. Migration 0040 gave the seats held before this their names back. As a city's name it isn't translated, like any name the game gives a city; the map's label for an unheld one stays in the player's language (`data-historic`), its en-GB kept equal to core's names by a test (`locales/data-world.test.ts`).
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

- **More benefits:** forecasts and relief from acts of god, when the market's later phases bring them.
- **A state's NPC members** when a player holds its level 16: still the faction's, paying tribute to the player, or the player's own?
- **Famous guards:** famous historical heroes guarding the seats: proposed in the spike, [famous-heroes.md](famous-heroes.md), with a roster of 17 for the capitals and Atlantis.

## Phases

**Spikes first** (2026-11-01), each its own TODO item, to settle the numbers and the tools before the seats are built:

- **A. Jump to coordinates** on the world map: done 2026-11-01 (the coordinates on the map's toolbar open a box to type any x and y).
- **B. The art:** done 2026-11-01, the four historic city sprites (On the map, above).
- **C. Simulations of breaking one:** done 2026-11-01 (Testing how they're broken, above): `npm run sim -- siege`, its findings, and the cities' research tuned so every level and every day can be taken at a rising cost. Loyalty's numbers are still open.
- **D. Camp times:** done 2026-11-01 ([camp-times.md](camp-times.md), its phase 1): armies landing at a chosen second, in order, so players can break one as the simulations do.

Then:

1. **The seats on the map** (built 2026-11-01): a tile type of their own, `TileType.HISTORIC` (13), its level 12 to 18. `historicLevelAt` / `historicCities` (`shared/core/src/historic.ts`) place them; a new world gets them in `ensureWorld`, an existing one from migration 0031 (a data migration alone can't do both: on a fresh database it runs before the world is seeded). Whatever stood on a place goes; a player's city or held tile there would move the seat to the nearest free tile within 5 (none did on the dev world). Their state (`historicState`): the day's garrison (`historicDay`, by tile and UTC day, whole again each new day), refilling by the second, loot and loyalty regenerating like a level 10 barbarian city's, research (`historicResearch`) and hero (`historicGuard`). Scouting one reports it like a barbarian city; an attack (`attackHistoric`, `engine/combat.ts`) fights it as of the landing time, plunders its loot and takes 3 loyalty a win, stopping at 0 until capture exists. The map sends a historic city's level halved in its one hex digit (`mapLevelDigit` / `mapLevelOf`, levels above 15 don't fit), and draws its 96-pixel sprite (`HISTORIC_SPRITE`); the tile card offers attack and scout. Not yet: factions behind them, medals from them, their areas shown on the map.
2. **Capturing and holding them** (built 2026-11-01, as Decided, Capturing and holding one): the win that leaves a seat at 0 loyalty captures it (`captureHistoric`, `engine/combat.ts`) when the attacker has a free city slot and is under the limit for its level (`canHoldHistoric`); otherwise it stays at 0 for the next win. The city keeps its level (`cities.historic_level`) and a truce of its own (`cities.truce_until`, `BALANCE.historic.truceMs`), checked when an army is sent and when it lands instead of its holder's protection; its buildings are `historicCityBuildings` (fields producing by `fieldFactorAt`), its Rally Spot sends more (`maxArmyTroops` with the seat's level), it can't be moved (`moveCity`) nor its high fields demolished, and it keeps its historic sprite on the map (`MapCastle.historicLevel`). A restart or a deleted player puts it back on the map as a whole historic city. **Taking a held seat** (built 2026-11-01, Decided): once its truce is over, each rival's win takes 3 off its loyalty (`cities.loyalty`, back a point every 6 real minutes, `seatLoyalty`), and at 0 it goes to the winner (`takeSeat`), its old holder's heroes, armies, orders and shipments moving to their oldest other city. Battle reports show its loyalty, and the old holder gets a Historic City Lost report. **The daily draft** (built 2026-11-01, Decided): `engine/draft.ts` (`pickDraftTarget`, `draft`), `jobs.ts` `draftJob` (the worker, every minute; the next draft's time in `cities.draft_next_at`, core `nextAutoDraftAt`, shown on the seat's tile card) and `services/historic.ts` (`draftNow`, `setDraftAuto`; `POST /cities/{cityId}/draft`, `/draft/mode`); a draft report (`kind: 'draft'`), and on the map a Draft button on barbarian cities (and lower historic cities) in a seat's area and the seat's auto switch with its drafts today (`tile-card/seat-draft/`). **Draft now** (2026-11-02, the maintainer: a seat's own card had no way to draft): on the seat's card, `draftNow` without a tile drafts at once from the barbarian city `pickDraftTarget` would pick drafting by itself, as one of its drafts today; with none left in its area it is refused (`city.noDraftTarget`). **Titles, tribute and fee shares** (built 2026-11-01, Decided): `BALANCE.historic.tribute` in the seat's gold income (`computeCityStats`, shown in the resource bar's gold breakdown); `payFeeShares` (`engine/market.ts`) wherever a player buyer pays a fee; `seatTitle` (core) and `seatTitles` (`engine/seats.ts`) on the player's info, the map's city entries and the rankings, shown beside the player's name and on city cards. **Standing with the factions** (built 2026-11-01, Decided): `seatStanding` and `draftStanding` (core `reputation.ts`) in `attackHistoric` and `draft`, the battle report's `standing` and `rivals` and the draft report's `standing`. **Upkeep, unrest and alliance sharing** (built 2026-11-01, Decided): the upkeep and the alliance's share in `computeCityStats` (core `economy.ts`, with the seats a player holds and whether they share in the economy context, `seatsOf` in `city.ts`); unrest, rising up and the hourly payouts in `engine/unrest.ts` (`tendSeat`, the worker's `seatsJob` every minute; `cities.shared_at`, migration 0036); the seat's loyalty and what it lacks on its tile card (`tile-card/seat-status/`), its upkeep in the resource bar's breakdowns.
3. **Tribute and market rights,** on top of NPC trade (built). In part built 2026-11-01 (phase 2, Titles, tribute and fee shares): a tribute in gold by the hour, and a share of market fees for the capitals and Atlantis. Still to come: a say over an area's market (tolls, embargoes, better prices with the factions), and the knowledge and relief benefits, which wait on the market's regional prices, forecasts and acts of god.
4. **Seats deciding which faction holds a state,** with the market's relations and retaliation (market phase 6), and the standing taking a seat costs (reputation is built). **A state under a player ruler** built 2026-11-01 (Decided): while a player holds a state's capital (`stateRulers`, `engine/seats.ts`) the state's barbarian cities answer to no faction (`stateFaction`, `npcFaction` with the ruled zones; core `factions.ts`): its groups leave the factions' trade (`npcTradeTick`), and attacking, plundering or drafting them changes no standing; the ruler's capital gets `stateTribute` gold a real hour (5 a member level, about 42,000 for Tuscany; `cities.state_tribute`, migration 0035, set each tick), shown in the gold breakdown. `GET /factions/rulers` lists the ruled states; the Factions panel names them, the map leaves them untinted and a member's tile card says who rules it. When the capital goes back to the map the state is its faction's again. Not built (TODO.md, Angry factions): factions winning capitals back, so borders between factions don't move by themselves yet.

Each phase records its rule changes in deviations.md (*(design change)*) and its numbers in `BALANCE`.
