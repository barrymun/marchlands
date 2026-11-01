# Famous historical heroes (spike)

**Status:** spike written 2026-11-01; nothing is built. The maintainer asked for the spike only (2026-11-01): this note sets out how famous heroes could work, and proposes a first roster, for the maintainer to choose from. TODO.md item: *Famous historical heroes*. Reference: [reference/famous-historical-heroes.md](../reference/famous-historical-heroes.md) (how Age 2 did it, and all 636 of its heroes with their attributes).

**The aim:** real people of the Marchlands' lands and period as unique heroes, better than the Inn's, worth fighting for. Age 2 had them; Age 1, which Marchlands ports, didn't.

## Where things stand

- **Heroes come from the Inn** (`services/heroes.ts`, `tavern`): a hero's three base attributes (power, management, stratagem) are rolled by `randomStat` (`shared/core/src/heroes.ts`): 15–34 two times in three, 60 or more about one time in a hundred, 75–78 one in four hundred. Levels go to 100 (`BALANCE.heroMaxLevel`), each level giving points to spend, and gear adds its own (`BALANCE.heroGear`).
- **Names** come from a generator by the city's state ([hero-names.md](hero-names.md)), which keeps clear of the well-known people a famous roster would want (decided 2026-10-23).
- **The historic cities' guards** are generated level 100 heroes with the level's Attack and Intelligence (`historicGuard`, `BALANCE.historic.hero`), the same for every visit, under a generated name of the state. Famous guards were noted as an idea there ([historical-cities.md](historical-cities.md), Open questions).
- **Nothing in a hero marks it unique,** and nothing stops two players having heroes of the same name.

## What makes a hero famous

Whatever way they're won, a famous hero would be:

- **Unique:** one in the world. While a player has them, nobody else can. Released, dismissed or lost, they go back to where they're won from.
- **Named, and keeping the name:** they can't be renamed. Their name has the period's local form, with a nickname where the period gave one (*Heinrich der Löwe*, *Matilde di Canossa*, *Břetislav I*), and shows in every locale as it is (names aren't translated; AGENTS.md, Translations).
- **Stronger at base:** base attributes from 55 to 95, above almost any Inn hero, with a clear strength and weakness each (a ruler strong in management, a war leader in power, a scholar in stratagem). Levels give them the same points as anyone's, so the gap is their head start. This is a rule change (deviations.md), and its numbers would live in `BALANCE`.
- **From Age 2's numbers where Age 2 had the person:** Politics → management, Attack → power, Intelligence → stratagem, Leadership dropped (Marchlands has no troop cap per hero). Others get ours.

## How a player could win one

**A. Guards of the seats** (recommended to start). Each state's capital (level 16) and Atlantis is guarded by a famous hero of its land: 17 heroes.
- They fight in the seat's defence as `historicGuard` does today (their attributes in place of the level's).
- **The win that captures the seat captures its guard:** the hero joins the captor, in the seat city, as a captured hero joins a city today (like a seized hero, but theirs at once, or released or kept as the maintainer prefers).
- **Losing the seat:** the hero stays with their player (a seat's next holder meets a new guard, below), or goes with the seat (the hero is the seat's, not the player's). The second keeps each hero in one place in the world and makes them part of what's fought for.
- **A seat without its famous guard** (taken earlier, held by a player) is guarded by a generated guard, as now.
- Ties into what's built: the seats, their capture, and their per-state names. Small: a table of 17 heroes, a column marking a hero famous, and the capture.
- Could go on to the level 14s (128 more heroes) once there's a roster for them.

**B. Rumours at the Inn, as Age 2** ([reference](../reference/famous-historical-heroes.md), How they worked). From Inn level 5 the Inn hears rumours; paying gold gives the hero's place on the map and a quest; capturing them there wins them.
- Needs a famous hero to stand somewhere on the map (a new kind of tile, or a camp on one), a quest kind, and a race between players. Bigger, and the best fit for a larger roster than the seats need.
- Age 2's paid currency doesn't exist here: the details would cost gold.

**C. Quests.** A quest chain ends in a famous hero. Simple, but every player could earn the same hero, so they wouldn't be unique; fine for lesser figures, not for an emperor.

**D. Bought with medals or gold.** Rejected: it makes them a purchase, not a prize.

A and B fit together: the 17 seat guards first, then a larger roster found through the Inn.

## A first roster: the 17 seat guards

One per state, a ruler or figure of that land in the period (9th to 13th century), and Charlemagne for Atlantis, the Empire's founder. Attributes as power / management / stratagem: Age 2's where it had the person (marked *A2*), ours otherwise (*ours*), for the maintainer to adjust.

| Seat | Hero | Who | Power / Mgmt / Strat |
|---|---|---|---|
| Atlantis (0, 0) | Karl der Große | Charlemagne, Emperor | 65 / 94 / 78 *A2* |
| Friesland | Radbod | King of the Frisians | 85 / 55 / 60 *ours* |
| Saxony | Otto der Große | Otto I, Emperor | 80 / 70 / 90 *A2* |
| North March | Albrecht der Bär | Albert the Bear, first Margrave of Brandenburg | 80 / 75 / 55 *ours* |
| Bohemia | Přemysl Otakar II | Ottokar II, the Iron and Golden King | 85 / 80 / 60 *ours* |
| Lower Lorraine | Godefroy de Bouillon | Godfrey of Bouillon, leader of the First Crusade | 70 / 45 / 88 *A2* |
| Franconia | Konrad II | Conrad II, first Salian emperor | 70 / 85 / 65 *ours* |
| Thuringia | Ludwig der Springer | Count of Thuringia, founder of the Wartburg | 75 / 70 / 60 *ours* |
| Moravia | Břetislav I | Duke of Bohemia, the Bohemian Achilles | 88 / 60 / 65 *ours* |
| Upper Lorraine | Gérard d'Alsace | first hereditary Duke of Lorraine | 65 / 80 / 60 *ours* |
| Swabia | Friedrich Barbarossa | Frederick I, Duke of Swabia, Emperor | 60 / 89 / 56 *A2* |
| Bavaria | Heinrich der Löwe | Henry the Lion, Duke of Saxony and Bavaria | 70 / 89 / 40 *A2* |
| Carinthia | Bernhard von Spanheim | Duke of Carinthia, crusader | 75 / 65 / 60 *ours* |
| Burgundy | Rodolphe II | Rudolph II, King of Burgundy and of Italy | 65 / 80 / 65 *ours* |
| Lombardy | Adelaide di Borgogna | Adelaide of Italy, Empress, regent | 45 / 90 / 80 *ours* |
| Tuscany | Matilde di Canossa | Matilda of Tuscany, the Great Countess | 70 / 85 / 85 *ours* |
| Romagna | Pier Damiani | Peter Damian, reformer, cardinal of Ostia | 35 / 70 / 95 *ours* |

- Henry the Lion was Duke of Bavaria as well as Saxony, so he guards Bavaria here and Otto the Great Saxony.
- Two women and a churchman among the 17, as the period's rulers allow (Adelaide, Matilda, Peter Damian); more for the level 14s later, such as Hildegard von Bingen and Elisabeth of Thuringia.
- Age 2's Frederick Barbarossa appears twice with different numbers; this takes the first.

## Open questions

- **Which way first:** A (seat guards), B (Inn rumours), or both in turn?
- **Their numbers:** base 55–95 as proposed, or nearer Age 2's spread (20–99)? Do they grow faster per level, or only start higher?
- **Capture:** does the win that takes the seat win its guard at once, or only by a chance? Is a captured famous hero theirs at once or a prisoner to persuade?
- **Losing the seat:** does the hero stay with their player or go with the seat?
- **Release and leaving:** back to their seat (or rumour pool), whole, at level 1 or at the level they reached?
- **The roster:** these 17 as they are, or other people? Level 14 guards later?
- **Their art:** a portrait each (the heroes have a figure, not portraits), or a mark on the usual figure?

## Phases (proposed)

1. **The roster and their rules** in core: the 17 heroes (id, name, attributes, seat), `BALANCE.famousHeroes`, deviations.md.
2. **Seat guards:** the seats fight with their famous guard; the capture wins it; a `famous_id` on heroes keeps each unique.
3. **The client:** a famous hero's mark and nickname on its card, the seat's guard on its tile card.
4. **Later:** level 14 guards; Inn rumours for a larger roster.
