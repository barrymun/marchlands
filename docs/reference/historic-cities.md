# Historic cities in Evony Age 2

**Version:** Evony Age 2. Age 1, which Marchlands follows, had no historic cities, so adding them is itself a deviation (record it in [deviations.md](../deviations.md) when they're built).

**Sources** (1–8 read 2026-10-19, 9–13 on 2026-11-01; facts below are in our own words):

1. *Maps / Coordinates of Historic Cities*, EvonyAge2 fan site: <https://age2evony.weebly.com/the-map.html>. Each state's level 14 and 16 cities as a picture with coordinates.
2. *Evony Age 2 Map – Beginners Guide*, Evony Age 2 blog (18 May 2015): <https://evony-age2.blogspot.com/2015/05/evony-age-2-map.html>. The states' bounds and capitals, Atlantis, and the spacing rules for level 14 and level 12 cities.
3. *Capture Level 12 Historic City – Advanced Guide*, same blog: <https://evony-age2.blogspot.com/2015/05/capture-level-12-historic-city-advanced.html>. A level 12's draft area, garrison, and how players took one.
4. *Level 14 and 16 Historic City Map – Advanced Guide*, same blog: <https://evony-age2.blogspot.com/2015/05/level-14-and-16-historic-city-map.html>. A single picture: a grid of all 144 level 14 and 16 cities, each with its coordinates and a name (real-world cities, such as Tirana and Algiers), transcribed under Names.
5. A player's summary, passed on by the maintainer: Atlantis is the only level 18 historic city and Evony's main capital, at (0, 0) in Friesland.
6. *Avoid Drafting with Troop Exchange – Advanced Guide*, same blog as 2: <https://evony-age2.blogspot.com/2015/05/avoid-drafting-with-troop-exchange.html>. Players being drafted by level 14, 16 and 18 holders, and how they avoided it.
7. *Draft*, Evony Wiki (Fandom, CC BY-NC-SA): <https://evony.fandom.com/wiki/Draft>. Who can draft whom (a stub).
8. *Historic City*, Evony Wiki: <https://evony.fandom.com/wiki/Historic_City>. A short list of named historic cities (a stub).
9. *Historic Cities*, H 'n' T's Evony Age II Guide (8 October 2010): <https://evonyageii.wordpress.com/2010/10/08/historic-cities/>. The only source with the garrisons of levels 14, 16 and 18, each level's area of power, and a wave plan for a level 12. A second post on the same blog, *Taking a HC12 in 30 Seconds or Less* (29 December 2010), is password-protected and wasn't read.
10. *Historical City*, Evony Archive wiki (Fandom): <https://evony-archive.fandom.com/wiki/Evony.wikia.com/wiki/Historical_City>. Two short paragraphs: fields, areas of power, Atlantis.
11. *HC Breaking and Taking*, Evony Helper (undated, levels 12–18 so Age 2): <https://evonyhelper.weebly.com/hc-breaking-and-taking.html>. The daily rotation, regeneration, a stage-by-stage plan, and the rules of holding.
12. *Camp Time / Lag Time*, same site: <https://evonyhelper.weebly.com/camp-time-lag-time.html>. How players timed an arrival to the second.
13. *How to cap level 12 historic city*, All About Evony (4 December 2012, edited 31 August 2014): <https://allaboutevony.blogspot.com/2012/12/how-to-cap-level-12-historic-city.html>. Wave plans by hero attack, regeneration per second, the draft's share.

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

**Eight per state, 128 in all,** every 66 tiles from 33 across the whole map (sources 1 and 2): x and y in {33, 99, 165, 231 … 759}, three to a state each way, every pairing except a state's middle place ((99, 99), (297, 297) …, by the capital), where a level 12 stands instead. So only in Friesland are they at a state's own offsets 33, 99 and 165; in Saxony they're 31, 97 and 163 in (the table). They lie on a 3 × 3 grid of cells about 66 tiles wide in each state, with the capital in the middle cell. *(Corrected 2026-11-01: this note first read the rule as offsets 33, 99 and 165 within every state, which the table below contradicts.)*

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

For Friesland that's (33, 33), (99, 33), (165, 33), (33, 99), (165, 99), (33, 165), (99, 165), (165, 165). Source 1 shows Romagna's (693, 759) and (759, 759) as "Atlantis" (see Atlantis, above). Source 9 lists Carinthia's eight, which match the grid (one, (629, 429), is surely a slip for (627, 429)).

**Flags:** source 9 gives each level a flag colour: red at level 12, green at 14, blue at 16 and gold at 18.

## Level 12

**Every 18 tiles from 9 across the whole map** (sources 2, 9 and 11): x and y in {9, 27, 45 … 783}, 44 × 44 = **1,936** on the map, 121 a state. *(Corrected 2026-11-01: first read as offsets within each state; the whole-map grid is the one that puts a level 12 in each state's middle place of the level 14 grid, as source 9 says, and the wiki's two named cities on it, below.)*

- **One stands beside each capital:** (99, 99), (297, 297), (495, 495) and (693, 693), and the other middle places of the level 14 grid, (99, 297) and so on, next to the capitals at (100, 100) …, are level 12s. Source 9 says so, and source 11 counts 1,936.
- Others come within 6 tiles of a level 14, for example (27, 27) by (33, 33), but none lands on one.
- Source 13 says "every 9 miles", which is probably a slip for the 9-tile draft radius.

**The largest army a historic city could send** (source 3; the War Ensign item adds a quarter). Source 13 says holding a historic city raised the Rally Spot's limit by a quarter, which is where 125,000 comes from (100,000 × 1.25); 150,000 and 200,000 fit a half and double.

| Launched from | Army | With War Ensign |
|---|---|---|
| Level 12 | 125,000 | 156,250 |
| Level 14 | 150,000 | 187,500 |
| Level 16 | 200,000 (implied) | 250,000 |

## Garrisons

**Troops** by level (source 9; level 12 also sources 3, 11 and 13). Every type is 2.5 times the level below, and level 18 twice level 16, except the archers, 4 times from level 12 to 14:

| Troops | Level 12 | Level 14 | Level 16 | Level 18 (Atlantis) |
|---|---|---|---|---|
| Warrior | 1,120,000 | 2,800,000 | 7,000,000 | 14,000,000 |
| Swordsman or Pikeman | 162,666 | 406,666 | 1,016,665 | 2,033,330 |
| Archer | 42,807 | 171,228 | 428,070 | 856,140 |
| Cavalry or Cataphract | 108,444 | 271,111 | 677,777 | 1,355,555 |
| Battering Ram, Ballista or Catapult | 14,640 | 36,600 | 91,500 | 183,000 |

Source 9 prints the level 14 archers as 171,288 and the level 12 cavalry as 108,404; both are surely slips (171,228 × 2.5 is its level 16 figure exactly, and the other sources give 108,444).

**Fortifications** are the same at every level (source 9): 22,000 traps, 11,000 abatis, 6,666 archer towers, 6,000 rolling logs and 5,000 defensive trebuchets. No source gives the walls' level.

**The hero:** a level 12 is defended by a level 100 King or Queen (source 11); a combat calculator gave them Attack / Intelligence from 110 / 500 at level 12 to 300 / 1,650 at level 18 (Other material, below).

**The daily rotation** (sources 3, 9 and 11): at each daily maintenance three swaps happen independently: swordsmen or pikemen, cavalry or cataphracts, and the siege engine (ram, ballista or catapult). Warriors and archers never change, so there are 12 garrisons. Players scouted once a day and attacked on a weak day: pikemen, cavalry and rams (sources 3, 11 and 13; source 9 preferred swordsmen and rams).

## Regeneration

- **Troops come back at 10% of the full garrison every 6 minutes** (source 11), so a wiped city is full again within an hour. Source 13's table for a level 12 is exactly that, per second: about 311 warriors, 45 swordsmen or pikemen, 12 archers, 30 cavalry or cataphracts and 4 siege engines. That's the same rule as ordinary NPC cities (and ours, `regenerateNpc`). Whether it came back in 6-minute steps or a little every second isn't stated, but AeroAgg's wave table ([aeroagg-complete-guide.md](aeroagg-complete-guide.md), Historic city waves) spreads the archer waves against a level 16 or 18 "over several seconds to land on respawns", which suggests troops came back every second.
- **Fortifications** (source 11, unclear): traps, rolling logs and defensive trebuchets are used up when they fire, archer towers aren't, and abatis only harm cavalry. It also says the walls' fortifications repair "at 18%" without saying how often, and doesn't square that with the ones used up.
- **Loyalty:** no source says whether or how fast it recovers.

## Taking one

### The waves

Every plan has the same shape: wear down the traps, break the garrison with large waves, then send many small waves to bring loyalty to zero.

- **Source 9** (2010): 4–5 heroes with 125+ leadership and 300+ attack, from 3–6 cities a few tiles away.
  1. 30–50 waves of 5,000–10,000 warriors, against the traps.
  2. Four waves of about 120,000 archers with thin layers of other troops, then a 92,000 wave to make sure: the first kills the cavalry, the archers and half the swordsmen, the next ones the warriors.
  3. Loyalty waves of 5,000 archers and 10,000 warriors.
  In all 330,000–580,000 warriors and 575,000 archers.
- **Source 11** (all research at 10; 11 heroes, 5 of them level 100 with 300+ attack; Excalibur, Penicillin, a horn):
  1. 30 waves of 3,000 warriors (35 with weaker heroes), all lost, scouting until about 500 traps are left.
  2. 2 waves of 90,000 pikemen and 10,000 warriors, against the cavalry.
  3. 1 wave of 80,000 archers with thin layers, against the pikemen.
  4. 3 waves of 95,000 archers, against the archers.
  5. Waves of 95,000 archers with thin layers until the warriors are gone.
  6. Loyalty waves.
  The troops it fought in order: traps, cavalry, pikemen, archers (with the towers), warriors, siege engines.
- **Source 13** (level 100 heroes, every gear piece at 9 stars):
  - **300–350 attack:** 15 heroes; 5 waves of 76,000 warriors and 24,000 pikemen (the cavalry die), 2 of 96,000 archers, 8 of 95,000 archers with 1,000-troop layers of every type (broken), then loyalty waves of 20,000 archers and 20,000 warriors. An army of 1M archers, 500,000 warriors and 125,000 pikemen. **400 attack:** the same with one pikeman wave fewer.
  - **500+ attack** (12-star gear advised): one wave of 117,000–125,000 ballistae breaks it, 3 waves of 95,000 archers clean up, then the loyalty waves. Ballistae are lost to the defensive trebuchets and archer towers (the towers outrange them): about 12,000 with 12-star gear, 25,000–35,000 with 9 stars at 450 attack.
  - No trap-clearing waves.
- **Source 3:** from a level 16 with a War Ensign and 800+ attack (9 stars at least), 250,000 pikemen then 250,000 archers break a level 12 in two waves (about 7,000 archers lost), and several level 12s can be taken in a day.

**Loyalty:** no source gives its starting value or what a win takes. 30 to 40 or more loyalty waves were needed once the garrison was broken (source 3: send at least 40, and have a city ready to teleport near for more). Sizes: 10,000 archers and 20,000 warriors (source 3), 20,000 and 20,000 (source 13), 50,000 and 50,000 falling to 20,000 and 20,000 (source 11), the warriors as a shield and no cavalry. Hero strength doesn't matter for them (source 3). Since the garrison keeps refilling (311 warriors a second at level 12), loyalty waves had to keep winning against it, hence their size.

### Timing

- **Waves land seconds apart:** 1–3 seconds (source 9), at least 1 and at most 20 seconds (source 13). Source 9's lost post claims a whole level 12 in under 30 seconds. With 10% of the garrison back every 6 minutes, a pause lets it refill.
- **Source 11 disagrees:** it scouts after every stage and heals between them by hand. Either each stage was a burst of its own, or its method is looser.
- **Camp time** (source 12): the send dialog showed when an army would arrive, and players set a *camp time*, minutes to wait before marching, so it arrived at a chosen clock time (all waves for 20:00:00, say). They first measured the server's lag by hitting a nearby valley or NPC city and comparing the expected arrival with the battle report's time (3 seconds late in the example), and set their times that much earlier. Precision was to the second, from several cities near the target, each timing its own waves.
- **The clock:** the landing time the game showed followed the player's own computer clock, not the server's ([aeroagg-complete-guide.md](aeroagg-complete-guide.md), Camp time), one more reason to measure the lag first.
- No source mentions an alliance rally.

### Requirements

- **A title:** source 11 says a King or Queen title was needed, which needed a captured level 10 NPC city first. Players grew a throwaway city to level 10 beside the historic city and abandoned it to make one. Keep two free city slots (the NPC city and the historic one).
- A level 10 Rally Spot (source 11). Source 9 says to unmount all heroes, without saying why.

## Holding one

- **A 24-hour truce** on capture, at every level (source 11, and the combat guides). A player's own truce never covers a historic city, and it can't be teleported (source 11). After the truce only its troops defend it, and it can be taken back the same way (sources 11 and 13).
- **Inside:** no buildings once captured (source 9). Its fields are empty but for one of each resource at the city's level; the rest can be built up to its level (sources 9, 10 and 13). Its own loot is only like a level 10 NPC city's (source 13).
- **Its area of power** (sources 3, 9, 10 and 13):

  | Level | Area |
  |---|---|
  | 12 | 9 tiles in every direction, an 18 × 18 cell (sources 3 and 13; source 9 says 22 × 17) |
  | 14 | its 66-tile cell (source 9) |
  | 16 | its state (source 9) |
  | 18 | the whole map (sources 9 and 10) |

- **Policies in the area** (sources 9 and 13), against every city in it, the colony powers ([colonies.md](colonies.md)): draft, disarm, sow discord, move population, and levying food or gold. Four policies a day in all, and the holder needed the rank of Princess.

### Drafting

What a historic city's holder drafted, and from whom (sources 3, 6, 7 and 13):

- **From players as well as NPCs.** A holder could draft from other players' cities within the city's area, and from NPC cities there too. Players were routinely drafted by the holders of level 14s, 16s and Atlantis, who could draft from any city on the map (source 10).
- **The share:** a draft took 5% of the target city's largest troop type (source 13). A player's city could be drafted once a day; an NPC city several times (4 drafts of 5% from a level 10's 400,000 warriors is about 80,000 a day). In place of a draft, a policy could take 10% of a city's food or gold.
- **Reinforcements are safe.** Troops sent to reinforce another city can't be drafted. Players hid their armies by swapping them with a nearby ally, which also kept them close enough to recall quickly for an attack.
- **Colonies were drafted the same way,** by the player who had colonised them; see [colonies.md](colonies.md).

## Names

Source 4's picture names every level 14 and 16 city and Atlantis, with its coordinates (read 2026-11-01, transcribed here). Level 12s have no names. In the picture Atlantis's label fills the cells of Romagna's last two level 14s, (693, 759) and (759, 759), so those two have none (source 1 labels them "Atlantis" too). A few of the picture's spellings are corrected here: Bujumburu (Bujumbura), Andora La Vella (Andorra la Vella), Santa Fe De Bogata (Santa Fe de Bogota), Bandir Seri Begawan (Bandar Seri Begawan), Anman (Amman), Valetta (Valletta), kigali (Kigali). Its other choices stay: Loyang, Maynila, Berne, Ulan Bator, Saint John. The game's names are in `client/web/src/locales/<locale>/data-historic.json`, keyed by place.

| State | Level 16 (and Atlantis) | Level 14s |
|---|---|---|
| Friesland | Atlantis (0, 0); Washington, D.C. (100, 100) | Tirana (33, 33), Algiers (99, 33), Kabul (165, 33), Saint John (33, 99), Port Moresby (165, 99), Sarajevo (33, 165), Gaborone (99, 165), Thimphu (165, 165) |
| Saxony | Beijing (300, 100) | Buenos Aires (231, 33), Abu Dhabi (297, 33), Muscat (363, 33), Nassau (231, 99), Brasilia (363, 99), Bujumbura (231, 165), Pyongyang (297, 165), Malabo (363, 165) |
| North March | Loyang (500, 100) | Baku (429, 33), Addis Ababa (495, 33), Dublin (561, 33), Minsk (429, 99), Brussels (561, 99), Copenhagen (429, 165), Dili (495, 165), Lome (561, 165) |
| Bohemia | Moscow (700, 100) | Tallinn (627, 33), Andorra la Vella (693, 33), Luanda (759, 33), Lima (627, 99), Warsaw (759, 99), Roseau (627, 165), Quito (693, 165), Asmara (759, 165) |
| Lower Lorraine | Prague (100, 300) | Maynila (33, 231), Suva (99, 231), Helsinki (165, 231), Astana (33, 297), Djibouti (165, 297), Moroni (33, 363), Pristina (99, 363), Kuwait City (165, 363) |
| Franconia | Berlin (300, 300) | Praia (231, 231), Brazzaville (297, 231), Kinshasa (363, 231), Bishkek (231, 297), Bissau (363, 297), Zagreb (231, 363), Nairobi (297, 363), Riga (363, 363) |
| Thuringia | Vienna (500, 300) | Santa Fe de Bogota (429, 231), St. George's (495, 231), Tbilisi (561, 231), Accra (429, 297), Phnom Penh (561, 297), Maseru (429, 363), Vientiane (495, 363), Vilnius (561, 363) |
| Moravia | London (700, 300) | St. Peter Port (627, 231), Havana (693, 231), Georgetown (759, 231), Harare (627, 297), Doha (759, 297), Monrovia (627, 363), Tripoli (693, 363), Vaduz (759, 363) |
| Upper Lorraine | Paris (100, 500) | Luxembourg (33, 429), Kigali (99, 429), Bucharest (165, 429), Palikir (33, 495), Chisinau (165, 495), Oslo (33, 561), Lisbon (99, 561), Stockholm (165, 561) |
| Swabia | Rome (300, 500) | Antananarivo (231, 429), Male (297, 429), Valletta (363, 429), Rabat (231, 495), Maputo (363, 495), Berne (231, 561), Apia (297, 561), Belgrade (363, 561) |
| Bavaria | Athens (500, 500) | Bamako (429, 429), Skopje (495, 429), Port Louis (561, 429), Mexico City (429, 495), Kathmandu (561, 495), Freetown (429, 561), Dakar (495, 561), Nicosia (561, 561) |
| Carinthia | Cairo (700, 500) | Nouakchott (627, 429), Ulan Bator (693, 429), Dhaka (759, 429), Niamey (627, 495), Alofi (759, 495), Victoria (627, 561), Riyadh (693, 561), San Marino (759, 561) |
| Burgundy | Ottawa (100, 700) | Bratislava (33, 627), Ljubljana (99, 627), Khartoum (165, 627), Port Vila (33, 693), Bandar Seri Begawan (165, 693), Damascus (33, 759), Yerevan (99, 759), Sana'a (165, 759) |
| Lombardy | Jerusalem (300, 700) | Paramaribo (231, 627), Mogadishu (297, 627), Dushanbe (363, 627), Kampala (231, 693), Montevideo (363, 693), Baghdad (231, 759), Tehran (297, 759), Amman (363, 759) |
| Tuscany | Canberra (500, 700) | Bangkok (429, 627), Nuku'alofa (495, 627), Port of Spain (561, 627), Tashkent (429, 693), El Aaiun (561, 693), Hanoi (429, 759), Lusaka (495, 759), N'Djamena (561, 759) |
| Romagna | Islamabad (700, 700) | Tunis (627, 627), Ankara (693, 627), Ashgabat (759, 627), Singapore (627, 693), Budapest (759, 693), Bangui (627, 759) |

## More named historic cities

Sources 8 and 10 name Atlantis at (0, 0) and two more, with their coordinates but not their levels:
- St. Gallen at (369, 657), in Lombardy;
- Vigevano at (567, 747), which falls in Tuscany by the coordinates (the wiki lists its state as "Vigevano").

Both lie on the level 12 grid (369 = 9 + 18 × 20, 657 = 9 + 18 × 36; 567 = 9 + 18 × 31, 747 = 9 + 18 × 41), so both are surely level 12s, which supports reading that grid across the whole map.

## Other material

[combat-guides.md](combat-guides.md), Other material, adds:
- the heroes a combat calculator gave historic cities: Attack / Intelligence 110 / 500 at level 12 up to 300 / 1,650 at level 18;
- the troop types in their garrisons by level;
- a 24-hour truce after one is captured.

Atlantis: only two Age 2 servers had seen it taken by October 2010, each by a whole alliance (source 9); players saw holding it as the end of a server (source 10).

## Not covered yet

- Loyalty: its starting value, what a win takes, and whether it recovers.
- The walls' level and the King or Queen's attributes.
- The policies a day of a level 14, 16 or 18 (beyond their areas).
- What happens to a historic city that is released or abandoned.
- The weebly site's "undraftable numbers" document and its historic heroes spreadsheet, both files that weren't opened.
- evonyage2help.com, linked from source 2's blog as a strategy guide, no longer loads.
