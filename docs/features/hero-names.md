# Hero names

**Status:** phase 1 built 2026-10-23 (`shared/core/src/hero-names.ts`, migration 0029). TODO.md: done (2026-10-23, *Better hero names*).

**The aim:** heroes whose names sound like they come from the state their city stands in: a Konrad from Swabia, a Borivoj from Bohemia, a Matilde from Tuscany, with now and then a traveller from another state. Names should rarely repeat, read differently from each other, and fit the world's place and time (the Holy Roman Empire's lands, about 950–1250).

## Where things stand

- **The generator:** `randomHeroName` (`shared/core/src/heroes.ts`) picks one of 40 first names (30 men's, 10 women's, mostly German and English) and one of 18 epithets: "Aldric the Bold". That's 720 names in all, so with a few heroes a city they repeat often, and they all read alike.
- **Who uses it:**
  - The Inn's offers: `createRandomHero` from `fillTavern` (`backend/packages/game/src/services/heroes.ts`), and the admin's hero grant (`services/admin.ts`). The Inn keeps its offers until the player pays to refresh it; that stays as it is.
  - The guard heroes of NPC cities and valleys: `createGuardHero`, seeded per tile (`seededRng('guard:<heroSeed>')`, `engine/combat.ts`). They're made again whenever they're read, so a guard's name must come from its seed alone.
- **What the original did:** fixed names like "Test Name453160" (deviations.md, Fixed hero names), so there's nothing to keep.
- **Renaming:** players rename heroes freely (`renameHero`): 1 to 20 characters, letters (any script), digits, spaces and `_ . ' -` (`cleanName`), and no bad words (`assertClean`). On the dev stack players use names to carry stats ("ATK - 68"), so many heroes never keep their generated name.
- **Portraits:** each hero gets one of 30 faces (`logoUrl`, `faceA1` … `faceA30`), but the client doesn't show them. Heroes have no gender.
- **Translation:** names given by the game aren't translated (AGENTS.md, Translations).
- **The world it should fit:** 16 zones (states), Friesland to Romagna (`data-zones`). They're held by five NPC factions (`shared/core/src/factions.ts`): the Saxon League, the Lotharingian Crown, the Franconian Heartland, the Bohemian Crown and the Italian League.

## Options looked at

Libraries on npm (checked 2026-10-23):

| Library | What it gives | Verdict |
|---|---|---|
| `@faker-js/faker` 10.6 (MIT, 2.9 MB, maintained) | Modern first and last names per locale (German, Czech, Italian, French …), with its own seed | Wrong era (Kevin, Jessica), heavy, and it can't use our `Rng` |
| `chance` 1.1 (MIT, 2.1 MB) | Modern English and Italian names, with its own seeded generator | Wrong era, same problems |
| `unique-names-generator` 4.7 (MIT, last release 2022) | Joins words from dictionaries with a seed | The mechanism is a few lines; its dictionaries (modern names, animals, colours) are no use to us |
| `fantastical`, `fantasy-name-generator` (MIT / ISC, 2022) | Fantasy names by race (elves, dwarves, orcs) | Wrong flavour, unmaintained, `^` lodash dependencies |
| `foswig` 3.0 (MIT, 15 kB, no dependencies, 2022) | Markov-chain words learnt from a list of examples | Not needed now that places are real ones (below) |

**Sources of names, not code:** lists of the period's rulers and nobles (the dukes of Saxony and Bavaria, the Přemyslids, the margraves of Tuscany), the period's place names in each zone, and scholarly name lists such as the Medieval Names Archive. Single names are facts, so we write our own curated lists from them and copy no one's list whole. Behind the Name's API has terms that rule out bulk use, so we don't use it.

## Decided

- **No library** (2026-10-23): a generator of our own in core, with curated lists and our seeded `Rng`. Every library above either has the wrong era or would only save the few lines of the joining logic.
- **Names follow the state the city stands in** (2026-10-23): an Inn in Tuscany offers mostly Italian names, one in Bohemia Czech ones. A guard hero takes its tile's state.
- **Patterns** (2026-10-23):
  - **No epithets.** "the Bold" and the like go: they're English words in every locale, and the names read better without them.
  - **First name and place:** "Gero von Meissen".
  - **First name and father's name:** "Ugo di Guido".
- **The local word, not English** (2026-10-23): "von" for German names, "di" for Italian, "de" for French, and so on, never "of".
- **Plain spellings** (2026-10-23): names use the letters A to Z only, so players can type them: Borivoj, Beatrice, Grosse, not Bořivoj, Béatrice, Große. A test checks every list.
- **Half the heroes are women** (2026-10-23), so every culture needs as many women's names as men's.
- **Real places** (2026-10-23): the places in names are real towns, castles and abbeys of each state (Meissen, Quedlinburg, Canossa), not made up.
- **Famous figures are left out** (2026-10-23). They're worth doing, as their own feature: unique heroes with better stats, as in the original game (TODO.md, Famous historical heroes). That feature also covers their nicknames ("Otto der Grosse") and famous guards in the historic cities. This work names ordinary heroes only, and its lists leave out the well-known people that feature will want.
- **Fathers' names everywhere** (2026-10-23), in every culture's own form, for variety, though in the period Germans, Czechs and the French went more by a place. A name may have a place, a father's name, or both where they fit in 20 characters.
- **Heroes get a gender** (2026-10-23): a column on `heroes` and a migration, so portraits and text can match later. Half of all new heroes are women.
- **Travellers** (2026-10-23): an Inn sometimes offers a hero from another state's culture, so a player whose cities are all in one state still sees variety.
- **The Inn's refresh doesn't change** (2026-10-23): offers stay until the player pays to refresh them.
- **Heroes made before the change** (2026-10-23): hired heroes keep their names. Heroes still waiting in an Inn get a new name and gender from the new generator, and keep their stats.
- **Gender isn't shown** (2026-10-23): the name implies it. It's stored for later (portraits, text), not sent to the client, and players can't change it.
- **Travellers: about 1 in 5** (2026-10-23), mostly from the neighbouring states, but from any state now and then.
- **Fathers' names in each culture's form** (2026-10-23), as in the table below: Gero Liudolfs, Thierry fiz Gozelo, Jaromir Borivojuv and Jitka Borivojova, Ugo di Guido, Popko Ubbena.

## Design

What's decided above, put together, as built.

- **Cultures by zone:**

  | Culture | Zones | For example | Place | Father's name |
  |---|---|---|---|---|
  | Frisian | Friesland | Radbod, Popko, Sicco; Ymke, Foelke | von Stavoren | Popko Ubbena |
  | Saxon and Thuringian | Saxony, North March, Thuringia | Liudolf, Gero, Wichmann, Ekkehard; Oda, Hathui | von Meissen | Gero Liudolfs |
  | Franconian, Swabian and Bavarian | Franconia, Swabia, Bavaria | Konrad, Welf, Arnulf, Luitpold; Gisela, Kunigunde, Imma | von Ulm | Imma Arnulfs |
  | Lotharingian and Burgundian | Lower and Upper Lorraine, Burgundy | Gozelo, Godefroy, Thierry, Rainier; Ermengarde, Ida, Beatrice | de Verdun, d'Arlon | Thierry fiz Gozelo (sons only) |
  | Czech | Bohemia, Moravia | Borivoj, Vratislav, Bretislav, Sobeslav; Ludmila, Dobrava, Jitka | z Vysehradu | Jaromir Borivojuv, Jitka Borivojova |
  | Carinthian | Carinthia | Adalbero, Markwart, Engelbert; Hemma | von Gurk | Hemma Markwarts |
  | Italian | Lombardy, Tuscany, Romagna | Arduino, Berengario, Bonifacio, Guido; Matilde, Willa, Berta | da Lucca, d'Asti | Ugo di Guido |

  Each place is stored in the form it takes after its word, since Czech changes the ending (Vysehrad, z Vysehradu); French and Italian elide before a vowel (d'Arlon, d'Asti). Each culture builds a father's name its own way: Czech by whether the hero is a man or a woman, and dropping the e of Vitek (Vitkuv); none from a German name ending in s, x or z, or a Czech one ending in a vowel; and for Lotharingian daughters none at all, since the period's *fiz* is for sons, so they go by a place. A father is never the hero's namesake (no Tjalling Tjallinga).
- **How many:** 40 men's and 40 women's names per culture, and 20 to 22 places per state. Fathers come from the same culture's men's names. Bitche (Upper Lorraine) was left out: the bad-word filter refuses it.
- **Patterns,** with weights in the module: first name and place (45%), first name and father's name (35%), both (10%), the first name alone (the rest). Both fit in 20 characters only with short names, so that pattern picks a place short enough ("Udo Imads von Bremen", "Ugo di Azzo d'Ivrea"), falling back to the place or the father alone; about 1 name in 250 has both.
- **Gender:** a `sex` column on `heroes`, 0 a man and 1 a woman, as the player's own (`ChangeGenderBody`). Each new hero is a woman or a man by a coin toss, and gets a name to match. A guard hero's gender comes from its seed, like the rest of it. Renaming leaves it as it is. It stays out of the API until something shows it.
- **Travellers:** about 1 Inn offer in 5 comes from another state: 3 travellers in 4 from a state next to the city's (as `BALANCE.stateGrid` lays them out), the rest from any other state. The traveller takes that state's culture, so a Saxon city's traveller may still be a Saxon-named hero from Thuringia (the same culture).
- **Length:** at most 20 characters, the rename limit, and every name passes `cleanName` and `assertClean` (a test checks every list and a sample of names). A pattern that would run long falls back to a shorter one: a shorter place, or the first name alone.
- **Repeats:** an Inn offer doesn't share its name with the player's other heroes or the city's other offers (a few re-rolls, then accept). Guards aren't checked: they come from their seed alone.
- **Where the code lives:** the name lists in a module of their own in core (`shared/core/src/hero-names.ts`, `heroName`; the build checked that the client's bundle has none of them). The client imports `heroes.ts` (`experienceItemGain`), and a module the client imports comes into its bundle whole, so the lists mustn't sit in `heroes.ts`. The weights (how often each pattern, how often a famous figure) are cosmetic, so they go in that module, as the animations' do, not in `BALANCE`.
- **Existing heroes:**
  - A migration adds `sex` (not null, 0 by default) and marks as women the heroes whose names start with one of the old list's 10 women's names (Adela … Sibylla). Every other existing hero is a man: renamed heroes ("ATK - 68") give nothing to go on, and since the gender isn't shown it costs nothing.
  - Heroes waiting in an Inn are renamed by the worker at start-up (`innNamesJob`), as it re-applies gear: each one whose name is still an old one (an old first name and epithet) gets a new name and gender for its city's state, and keeps its stats. It's idempotent, since new names never have an epithet. SQL can't run the generator, so the migration doesn't do it.
  - Hired heroes keep their names. Guards are made afresh whenever they're read, so they change at once; the name comes from its own generator seeded by two draws, as many as the old name took, so a scouted guard keeps the level and stats the scout reported.
- **Hero boxes** name their hero as the city's Inn would.

## Open questions

None for now.

## Answered

Both rounds of questions (2026-10-23) are recorded under Decided: no epithets, the local word, plain spellings, half women, real places, famous figures as a feature of their own, fathers' names everywhere and in each culture's form, a gender column that isn't shown, travellers 1 in 5, and how heroes made before the change are treated.

## Phases

1. **The generator** (built 2026-10-23): the cultures, places and fathers' names, gender (the column and its migration), travellers, renaming the heroes waiting in Inns, the length rule and the repeat check, for Inn offers, the admin's grant and guards; tests for every list and the length and character rules. deviations.md's line on hero names (Fixed hero names) says what the generator now does.
2. **Maybe later:** matching portraits, if the client ever shows faces. Famous historical heroes are a feature of their own (TODO.md).
