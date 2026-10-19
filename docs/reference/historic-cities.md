# Historic cities in Evony Age 2

**Version:** Evony Age 2. Age 1, which Marchlands follows, had no historic cities, so adding them is itself a deviation (record it in [deviations.md](../deviations.md) when they're built).

**Sources** (all read 2026-10-19; facts below are in our own words):

1. *Maps / Coordinates of Historic Cities*, EvonyAge2 fan site: <https://age2evony.weebly.com/the-map.html>. Each state's level 14 and 16 cities as a picture with coordinates.
2. *Evony Age 2 Map – Beginners Guide*, Evony Age 2 blog (18 May 2015): <https://evony-age2.blogspot.com/2015/05/evony-age-2-map.html>. The states' bounds and capitals, Atlantis, and the spacing rules for level 14 and level 12 cities.
3. *Capture Level 12 Historic City – Advanced Guide*, same blog: <https://evony-age2.blogspot.com/2015/05/capture-level-12-historic-city-advanced.html>. A level 12's draft area, garrison, and how players took one.
4. *Level 14 and 16 Historic City Map – Advanced Guide*, same blog: <https://evony-age2.blogspot.com/2015/05/level-14-and-16-historic-city-map.html>. A single picture: a grid of all 144 level 14 and 16 cities, each with its coordinates and a name (real-world cities, such as Troia and Algiers). The names aren't transcribed here.
5. A player's summary, passed on by the maintainer: Atlantis is the only level 18 historic city and Evony's main capital, at (0, 0) in Friesland.
6. *Avoid Drafting with Troop Exchange – Advanced Guide*, same blog as 2: <https://evony-age2.blogspot.com/2015/05/avoid-drafting-with-troop-exchange.html>. Players being drafted by level 14, 16 and 18 holders, and how they avoided it.
7. *Draft*, Evony Wiki (Fandom, CC BY-NC-SA): <https://evony.fandom.com/wiki/Draft>. Who can draft whom (a stub).
8. *Historic City*, Evony Wiki: <https://evony.fandom.com/wiki/Historic_City>. A short list of named historic cities (a stub).

## The map and its states

The Age 2 map has the same 16 states as ours, in the same places on the same 800 × 800 grid. Each is a 200 × 200 square, and the state with origin (x0, y0) holds the tiles x0 … x0 + 199 and y0 … y0 + 199. This matches `stateOf` in `shared/core/src/world.ts` exactly. The map wraps at its edges, so each state's neighbours include states on the far side (source 2 describes Burgundy as north of Friesland, for example).

## Atlantis: level 18

- The single level 18 historic city, Evony's main capital, at **(0, 0)**, the corner of Friesland (sources 2 and 5).
- With the wrap-around, (0, 0) is where Friesland, Bohemia, Burgundy and Romagna meet.
- Source 1 labels two of Romagna's level 14 places "Atlantis" rather than giving coordinates (below). That doesn't fit sources 2 and 5, which agree on (0, 0); it may have been a mistake on that page, or particular to one server.

## Level 16: the state capitals

One per state, at the state's exact middle, **(x0 + 100, y0 + 100)** (sources 1 and 2). Each has a name:

| Id | State | Origin | Capital | At |
|---|---|---|---|---|
| 0 | Friesland | (0, 0) | Washington DC | (100, 100) |
| 1 | Saxony | (200, 0) | Beijing | (300, 100) |
| 2 | North March | (400, 0) | Loyang | (500, 100) |
| 3 | Bohemia | (600, 0) | Moscow | (700, 100) |
| 4 | Lower Lorraine | (0, 200) | Prague | (100, 300) |
| 5 | Franconia | (200, 200) | Berlin | (300, 300) |
| 6 | Thuringia | (400, 200) | Vienna | (500, 300) |
| 7 | Moravia | (600, 200) | London | (700, 300) |
| 8 | Upper Lorraine | (0, 400) | Paris (spelled "Perris") | (100, 500) |
| 9 | Swabia | (200, 400) | Rome | (300, 500) |
| 10 | Bavaria | (400, 400) | Athens | (500, 500) |
| 11 | Carinthia | (600, 400) | Cairo | (700, 500) |
| 12 | Burgundy | (0, 600) | Ottawa (spelled "Ottowa") | (100, 700) |
| 13 | Lombardy | (200, 600) | Jerusalem | (300, 700) |
| 14 | Tuscany | (400, 600) | Canberra | (500, 700) |
| 15 | Romagna | (600, 600) | Islamabad | (700, 700) |

## Level 14

**Eight per state, 128 in all,** every 66 tiles from offset 33 (sources 1 and 2): at (x0 + a, y0 + b) for a and b in {33, 99, 165}, every pairing except the middle (99, 99), where the state capital stands instead. They lie on a 3 × 3 grid of cells about 66 tiles wide, with the capital in the middle cell.

| Id | State | Level 14 x | Level 14 y |
|---|---|---|---|
| 0 | Friesland | 33, 99, 165 | 33, 99, 165 |
| 1 | Saxony | 231, 297, 363 | 33, 99, 165 |
| 2 | North March | 429, 495, 561 | 33, 99, 165 |
| 3 | Bohemia | 627, 693, 759 | 33, 99, 165 |
| 4 | Lower Lorraine | 33, 99, 165 | 231, 297, 363 |
| 5 | Franconia | 231, 297, 363 | 231, 297, 363 |
| 6 | Thuringia | 429, 495, 561 | 231, 297, 363 |
| 7 | Moravia | 627, 693, 759 | 231, 297, 363 |
| 8 | Upper Lorraine | 33, 99, 165 | 429, 495, 561 |
| 9 | Swabia | 231, 297, 363 | 429, 495, 561 |
| 10 | Bavaria | 429, 495, 561 | 429, 495, 561 |
| 11 | Carinthia | 627, 693, 759 | 429, 495, 561 |
| 12 | Burgundy | 33, 99, 165 | 627, 693, 759 |
| 13 | Lombardy | 231, 297, 363 | 627, 693, 759 |
| 14 | Tuscany | 429, 495, 561 | 627, 693, 759 |
| 15 | Romagna | 627, 693, 759 | 627, 693, 759 |

For Friesland that's (33, 33), (99, 33), (165, 33), (33, 99), (165, 99), (33, 165), (99, 165), (165, 165). Source 1 shows Romagna's (693, 759) and (759, 759) as "Atlantis" (see Atlantis, above).

## Level 12

**Every 18 tiles from offset 9** (source 2), so at offsets 9, 27, 45, 63, 81, 99, 117, 135, 153, 171 and 189 within a state, across and down.

Our reading of that rule (the source gives only the rule, not a list):
- It makes 11 × 11 = 121 places per state, 1,936 on the map.
- Exactly one of them, (99, 99) in each state, sits next to the state capital at (100, 100). The game most likely had no level 12 there, which would leave 120 per state, 1,920 in all.
- Others come within 6 tiles of a level 14, for example (27, 27) by (33, 33), but none lands on one.

**Holding one** (source 3):
- **Draft area:** 18 × 18 tiles, given in the guide's draft range as 19 × 19, 9 tiles in any direction (about 12.7 to the corners). That's the cell round the city, so the level 12 cells tile each state.
- **Four drafts a day.**
- **A launching point:** players used them to attack the bigger historic cities.

**The largest army a historic city could send** (source 3; the War Ensign item adds a quarter):

| Launched from | Army | With War Ensign |
|---|---|---|
| Level 12 | 125,000 | 156,250 |
| Level 14 | 150,000 | 187,500 |
| Level 16 | 200,000 (implied) | 250,000 |

**Garrison of a level 12** (source 3). It changed daily at random: warriors and archers always, and pikemen or swordsmen on alternate days.

| Troops | | Fortifications | |
|---|---|---|---|
| Warrior | 1,120,000 | Traps | 22,000 |
| Pikeman or Swordsman | 162,666 | Abatis | 11,000 |
| Archer | 42,807 | Archer Tower | 6,666 |
| Cavalry or Cataphract | 108,444 | Rolling Logs | 6,000 |
| Battering Ram, Ballista or Catapult | 14,640 | Defensive Trebuchet | 5,000 |

**Taking one** (source 3, in short):
1. Players sent dozens of small waves first to use up the traps.
2. Then one or more large waves broke the garrison: ballistae, or pikemen and archers.
3. Then 30–40 or more small "loyalty" waves brought its loyalty to zero and captured it.

Stronger heroes, a War Ensign and launching from a bigger historic city meant fewer waves. A captured historic city became the player's own city: players launched attacks from it and teleported other cities next to it. This is the same loyalty-to-zero capture Marchlands keeps for barbarian cities (deviations.md).

## Drafting

What a historic city's holder drafted, and from whom (sources 3, 6 and 7):

- **From players as well as NPCs.** A holder could draft from other players' cities within the city's range, and from NPC cities there too, taking a share of the troops in each. Players were routinely drafted by the holders of level 14s, 16s and Atlantis.
- **The range grows with the city's level.** A level 12's is its 18 × 18 cell, with 4 drafts a day (source 3). The sources give no range or count for the bigger cities.
- **Reinforcements are safe.** Troops sent to reinforce another city can't be drafted. Players hid their armies by swapping them with a nearby ally, which also kept them close enough to recall quickly for an attack.
- **Colonies were drafted the same way,** by the player who had colonised them; see [colonies.md](colonies.md).

## More named historic cities

Source 8 names two more, with their coordinates but not their levels:
- St. Gallen at (369, 657), in Lombardy;
- Vigevano at (567, 747), which falls in Tuscany by the coordinates (the wiki lists its state as "Vigevano").

Neither lies on a level 14 place, nor on the level 12 grid as we read it (offsets 9, 27 … 189). So either they are level 12s and the "every 18 tiles" rule was only approximate, or the coordinates are wrong. Treat the level 12 list above as a pattern to start from, not a record of the real game.

## From the combat guides

[combat-guides.md](combat-guides.md), Other material, adds:
- the heroes a combat calculator gave historic cities: Attack / Intelligence 110 / 500 at level 12 up to 300 / 1,650 at level 18;
- the troop types in their garrisons by level;
- a 24-hour truce after one is captured.

## Not covered yet

- The draft range and drafts a day of a level 14, 16 or 18, and what share of the troops a draft took.
- Whether holding one gave tribute or a title.
- The weebly site's front page has a document on "undraftable numbers" (probably how many troops are safe from a draft), an embedded file that hasn't been read.
- evonyage2help.com, linked from source 2's blog as a strategy guide, no longer loads.
- The garrisons of level 14, 16 and 18 cities.
