# Historical cities: seats of power

**Status:** design only, nothing built. The rule change it waits on (traps and ranged groups against walls) is done (2026-10-20). Moved out of [market-and-factions.md](market-and-factions.md) on 2026-10-24, where it was first worked out as the factions' seats of power. TODO.md item: *Historical cities.*

**The aim:** big NPC cities above today's level 10, as prizes for strong players and alliances. **A historical city is the seat of power over an area of the map.** An NPC faction holds it until a player takes it. The bigger the city, the bigger its area and the more it brings its holder.

## Where things stand

- NPC cities go from level 1 to 10: 51,217 on the 800 × 800 map, 990 of them at level 10 (counted 2026-10-19; [market-and-factions.md](market-and-factions.md), Where things stand). One at full strength keeps nothing in the database (`tiles.troops`, `forts` and `state` stay null until it is touched).
- A barbarian city loses 10 to 15 loyalty for each win against it and is captured at 0 if the attacker's title allows another city, keeping its buildings. Players' cities have no loyalty and can't be captured (*(design change)*, deviations.md).
- The five NPC factions hold the 16 states (zones), from level 5 up, as fixed data (`shared/core/src/factions.ts`), and trade with each other and with players (market phases 2 and 3). Standing with a faction (reputation, market phase 4) isn't built yet.
- How Age 2 placed and used its historic cities, at every level: [reference/historic-cities.md](../reference/historic-cities.md). Their garrisons against our NPC cities' are in [reference/npc-cities.md](../reference/npc-cities.md). Age 2's colonies are a model for a holder's powers: [reference/colonies.md](../reference/colonies.md). Age 1 had none of this.

## Decided

- **A design of its own** (2026-10-24): moved out of the market and factions design. It ties into the factions (seats move borders, taking one costs standing), but it is a feature in its own right, mostly about combat and holding land, and can be built apart from the market's later phases.
- **The ballista rule change first** (2026-10-20, done the same day): traps hit only ground troops, and ranged groups stop once the wall is in range ([reference/ballista-farming-and-wall-range.md](../reference/ballista-farming-and-wall-range.md); deviations.md). Taking a seat is a fight against fortifications, so the rule had to be settled first.
- **Its place in the market's phases** (2026-10-20, changed 2026-10-22): first planned straight after the faction data, since most of a seat's value (capture, the daily draft, the title, bigger armies) doesn't need NPC trade. On 2026-10-22 NPC trade and reputation moved ahead of it. NPC trade is built, so a seat's tribute from trade and its market rights can come with it. Whether it waits for reputation is open (below).

## The design (proposed)

### Where they stand

**One area per seat, nested in a grid,** following the original game where it had them: Age 2's historic cities. Areas are worked out from coordinates, like faction membership, with nothing stored per tile.

| Seat | How many | Area it rules | Where | From |
|---|---|---|---|---|
| Level 18 | 1, Atlantis | the whole world, lightly | (0, 0), in Friesland. The map wraps, so this is where the corners of Friesland, Bohemia, Burgundy and Romagna meet | Age 2 |
| Level 16 | 16, one per state | its state, 200 × 200 tiles | the middle of each state, (x0 + 100, y0 + 100): (100, 100), (300, 100) … (700, 700) | Age 2, exactly |
| Level 14 | 128, eight per state | its cell of a 3 × 3 grid over the state, about 66 × 66 tiles (the middle cell is the level 16's) | (x0 + a, y0 + b) for a and b in {33, 99, 165}, except (99, 99) | Age 2, exactly |
| Level 12 | 1,920, 120 per state | its 18 × 18 cell (Age 2's draft area, 4 drafts a day) | every 18 tiles from offset 9 across and down, (x0 + 9, y0 + 9) … (x0 + 189, y0 + 189), leaving out (99, 99) beside the capital | Age 2's rule; the list is our reading of it |

- Every position is the original's (Age 2), and they already fit our map: the same 16 states on the same 200 × 200 grid (`stateOf`).
- **1,920 level 12s is a lot,** against 51,217 ordinary NPC cities. In Age 2 they were the common first prize and a stepping stone towards the bigger cities. We could keep them all, or use fewer (every other place), which leaves a level 12's draft area 36 × 36 instead.
- One source marks two of Romagna's level 14 places "Atlantis", which doesn't fit Atlantis at (0, 0) (reference note). We'd place all 128.
- **What Age 2 gave the holder** (reference note): a level 12 drafts 4 times a day from its 18 × 18 area, and every historic city raises the largest army its holder can send from it: 125,000 from a level 12, 150,000 from a level 14, 200,000 from a level 16 (a quarter more with a War Ensign). A captured historic city became the player's own city.
- The seats are new NPC cities at levels above today's 10, placed by a migration over whatever tile is there.
- Historic cities aren't in Age 1, so adding them is a deviation (*(design change)* in deviations.md, pointing to the reference note).

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

- **The seats:** all four levels follow Age 2 (proposed). Keep all 1,920 level 12s, or fewer?
- **Capture:** does a captured seat become the player's city, as in Age 2, and so count against the city limit? How hard is it to take (its garrison and fortifications against a level 10's)?
- **The draft:** what share of each city's troops (50%?), how often (once a day, or Age 2's 4 for a level 12), and what happens to drafted troops when the seat is lost?
- **Drafting players:** Age 2 let a historic city's holder draft other players' cities in range. Leave that out (the proposal), or allow it with protection (reinforcements, beginners)?
- **The benefits:** what does each seat bring, and how much? What does the level 18 bring?
- **A state's NPC members** when a player holds its level 16: still the faction's, paying tribute to the player, or the player's own?
- **Holding:** what limits it (upkeep, one level 16 per player, unrest)? Are benefits shared with the holder's alliance?
- **Before or after reputation?** Only taking a seat's cost in standing and "better prices with the factions that like you" need it. Seats could come first, with those added once reputation exists.
- **Famous guards:** famous historical heroes (TODO.md) guarding the seats, once that feature exists.

## Phases

1. **The seats on the map:** the historical cities placed by a migration, with their areas (from coordinates) and garrisons, shown on the map with their own tile art. deviations.md gets its entry.
2. **Capturing and holding them:** the loyalty rule at their levels, the daily draft, titles and the larger armies, and what holding costs.
3. **Tribute and market rights,** on top of NPC trade (built).
4. **Seats deciding which faction holds a state,** with the market's relations and retaliation (market phase 6), and the standing a seat costs once reputation (market phase 4) is built.

Each phase records its rule changes in deviations.md (*(design change)*) and its numbers in `BALANCE`.
