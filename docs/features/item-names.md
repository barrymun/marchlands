# Item names

**Status:** spike written 2026-11-08; nothing is built. The maintainer asked for a research spike on renaming every item (2026-11-08): this note sets out why, what "the game's style" means for item names, the options, and a full proposed list with alternatives, for the maintainer to choose from. TODO.md item: *Rename the items*.

**The aim:** item names of our own that keep the original's style (a famous person's possession or a famous book for the best items, a plain tool for the everyday ones) but belong to the Marchlands' world: the Holy Roman Empire's lands, about 950–1250 ([hero-names.md](hero-names.md), The world it should fit).

## Where things stand

- **53 items** (`ItemId`, `shared/core/src/item-ids.ts`), every name the original game's ([reference/items.md](../reference/items.md)), but for the four Marchlands added: Vesta's Grand Blessing and the Quartermaster's Seal and Charter, and Bernini's Hammer, which is in the Age 1 data but not on the wiki.
- **What's wrong with them:**
  - **Out of period.** Half the famous names are centuries after the setting: Napoleon's Diary (about 1800), Penicillin (1928), The Wealth of Nations (1776), On War (1832), Civil Code (1804), Bernini (the 1600s). The City Teleporter is science fiction. The Art of War (Sun Tzu) was unknown in medieval Europe, and Vesta is a Roman goddess. Two medals are modern ideas (Freedom, Nation).
  - **Borrowed.** Every name but four is Evony's, so the item list reads as Evony's. The heroes, places, factions and seats are already our own.
  - **Clumsy ladders.** Abbreviations and filler words ("Adv Tax Policy", "Adv Quarrying Tools", "Ultra Corselet"), and two ladders in different words for the same idea: Beginner, Primary, Intermediate, Senior, Master, Ultimate for the Guidelines, and Junior, Medium, Senior for the medal boxes.
  - **American spelling in the British source:** "Plowshares" (en-GB says ploughshare).
- **Where the names live** (checked 2026-11-08):
  - **Player-facing:** `data-items.json` in every locale (en-GB, en-US, ja-JP, ar, es), read through `itemName` / `itemShortName` (`lib/game-data.ts`); the server sends ids, never names. Four texts name an item outside it: `hero-points-dialog` (Holy Water, twice), `military-panel` (Quartermaster, twice), `send-army-dialog` (War Ensign) and quest 28's name in `data-quests` (Guidelines).
  - **Code:** the `ItemId` names (608 uses in 53 files), the icons' file names, which follow them (`itemArtFile`: `napoleons-diary.png`), the drawings in `tools/art/items/` and their map in `tools/art/items.ts`, comments in `balance.ts`, `construction.ts`, `economy.ts` and `messages/buff.ts`, and test titles. Core's item rows still carry the original's English `name` (`data/legacy/items.json`, and the added items' `EXTRA_ITEMS` in `data/index.ts`), which nothing shows.
  - **Stored data:** inventories store the ids (`player.troop.1.b`), which never change. A rename needs no migration.
  - **Docs:** deviations.md, reference/items.md, item-art.md and a dozen others name items in passing.

## What "the style of the game" means

Two styles meet here, and the proposal keeps both.

- **The original's** (Evony's), in three kinds of name:
  - **Famous people's things and famous books** for the strongest or rarest items: Napoleon's Diary, Archimedes' Note, Bernini's Hammer, Vesta's Blessing, Excalibur, The Art of War, Anabasis. A name carries a story, so a player remembers it.
  - **Plain tools** for the everyday boosts: Plowshares, Arch Saw, Blower, War Horn, Corselet.
  - **Tier words** for items in steps: Beginner … Ultimate, Junior … Senior.
- **The Marchlands' own**, set by the heroes, places and seats so far: real people and places of the Empire's lands about 950–1250, in their own words where that reads well ("von", "di"), plain spellings players can type, no English-only flourishes.

**Other games** (checked 2026-11-08): Travian (Ointment, Scroll, Small Bandage, Tablet of Law), Forge of Empires (Self-Aid Kit, Mass Self-Aid Kit), Stronghold Kingdoms (cards in bronze, silver, gold) and Tribal Wars all use plain names. Famous names are what set Evony's items apart, so keeping them in our own period is worth it.

## Options

| | Option | For | Against |
|---|---|---|---|
| A | Keep the original names | No work | Everything under *What's wrong with them* |
| B | Plain names throughout ("Harvest Boost", "Builder's Notes III") | Clearest, easiest to translate | Loses the style the maintainer wants kept; reads like any other game |
| C | **The original's three kinds of name, from our world and period** | Keeps the style, fits the setting, ours alone; ties into the seats and the famous heroes (Charlemagne's sword, Henry I's castles) | Some names are unfamiliar (Theriac, Burgward); needs research per name, and some icons redrawn |
| D | C, but every ladder in plain tier words, famous names only for one-off items | Ladders read at a glance | Fewer famous names; the top step loses its flourish |

**Recommended: C,** with D's rule where it matters: a ladder whose order isn't plain from its words keeps a plain ladder (the construction speed-ups, the medal boxes), and only its top step, if any, gets a famous name.

## Proposed rules

1. **Period:** people, books and objects of about 950–1250 in or near the Empire, or older ones the period knew and read (Vegetius, Isidore). Nothing after 1300.
2. **Famous names for the best and the one-off items,** plain tools for the one-day boosts, a better or newer tool or machine for the seven-day ones (hand-powered, then water-powered).
3. **Ladders read in order:** words whose order everyone knows (apprentice, journeyman, master; bronze, silver, gold), the icon growing with them (item-art.md, Steps show as more, or finer).
4. **Short and plain:** at most about 20 characters in English, letters A–Z (no ß or accents, as hero names), English forms where they exist (Imperial Banner, not Reichssturmfahne).
5. **Translated, not transliterated, when it has a meaning** (Truce of God is *Tregua de Dios*, 神の休戦); **a proper name in each language's usual form** (Joyeuse is *Joyosa* in Spanish, ジョワユーズ in Japanese).
6. **Careful with what could offend** an international audience (the game is in Arabic too):
   - No crusaders by name (Godfrey of Bouillon).
   - No miracles claimed: a saint's alms, not her miracle.
   - Nothing from the 20th century's use of the period (Ostsiedlung's framing, "Reich-" names).
   - The Song of Roland's objects (Durendal, the Olifant) are named as objects, never with the poem's story.
7. **Names that echo the old ones** where that works (Bernward's Hammer for Bernini's), so players of the original still find their way.

## Proposed names

Each item with the recommended name first, then alternatives. *Icon* says whether its drawing ([item-art.md](item-art.md)) still fits: **keep**, **touch** (a detail changes) or **redraw**. Sources for every historical claim are under *Research*.

### Construction and research speed-ups

The current icons are piles of books, one more per step. A plain ladder of craft ranks, everyone knows the order, and the top step, a percentage rather than a time, gets the famous name.

| Now | Does | Proposed | Alternatives | Icon |
|---|---|---|---|---|
| Beginner Guidelines | 15 min off | **Novice's Notes** | Builder's Notes I | keep |
| Primary Guidelines | 1 h off | **Apprentice's Notes** | Builder's Notes II | keep |
| Intermediate Guidelines | 2½ h off | **Journeyman's Notes** | Builder's Notes III | keep |
| Senior Guidelines | 8 h off | **Master's Notes** | Builder's Notes IV | keep |
| Master Guidelines | 10–30 h off | **Grandmaster's Notes** | Builder's Notes V | keep |
| Ultimate Guidelines | 30% off | **Villard's Sketchbook**: Villard de Honnecourt's portfolio of buildings and machines, about 1230 | Grandmaster's Codex; Codex Gigas (Bohemia, the largest medieval book, but nicknamed the Devil's Bible) | touch: an open sketchbook of arches |

Quest 28, *Guidelines*, becomes *Notes* (or whatever the ladder's word is).

### Troop and fortification speed-ups

| Now | Does | Proposed | Alternatives | Icon |
|---|---|---|---|---|
| Napoleon's Diary | 30% off a troop batch | **Otto's Muster Roll**: Otto II's levy of armoured horsemen from his bishops and abbots, 981 | Indiculus Loricatorum (its Latin name) | redraw: a long scroll of names |
| Archimedes' Note | 30% off a fortification batch | **Burgward Ordinance**: Henry I's order of 926 that every ninth man of the countryside garrison a fort | Henry's Castle Law | touch: a scroll with a plan of a fort |

### Production and gold

A hand tool for one day, the period's new machine or method for seven:

| Resource | One day now → proposed | Seven days now → proposed | Icons |
|---|---|---|---|
| Food | Plowshares → **Ploughshare** (en-US Plowshare) | Iron Rake → **Heavy Plough**: the wheeled plough (carruca), widespread from about 1000 | keep; redraw the seven-day (a wheeled plough) |
| Lumber | Arch Saw → **Bow Saw** | Double Saw → **Water Saw**: the water-powered saw Villard drew | keep; redraw the seven-day (a saw on a water wheel); alternative Pit Saw keeps it |
| Stone | Quarrying Tools → **Mason's Pick** | Adv Quarrying Tools → **Treadwheel Crane** | keep; redraw the seven-day |
| Iron | Blower → **Hand Bellows** | Blast Furnace → **Water Bellows**: water-driven bellows spread in the 12th–13th centuries | keep; touch the seven-day (bellows on a wheel); alternative Bloomery |
| Gold (tax) | Tax Policy → **Toll Right** | Adv Tax Policy → **Mint Right**: rights the emperor granted a town, with the market right (Otto III to Villingen, 999) | keep: a decree, then a sealed one with gold |

Alternative for gold: **Market Right** for one day, **Mint Right** for seven.

### Military

| Now | Does | Proposed | Alternatives | Icon |
|---|---|---|---|---|
| War Horn | +20% attack, 1 day | **War Horn** (kept) | | keep |
| Ivory Horn | +20% attack, 7 days | **Olifant**: the period's word for a carved ivory horn | Ivory Horn (kept) | keep |
| Corselet | +10% defence, 1 day | **Gambeson**: the padded coat worn under or instead of mail | Leather Jerkin | touch: quilted lines |
| Ultra Corselet | +20% defence, 7 days | **Hauberk**: a coat of mail | Mail Hauberk | redraw: mail |
| War Ensign | +25% troops in an army | **Imperial Banner** | Carroccio (Milan's war cart carrying the city's banner, about 1037; known in Lombardy, unknown elsewhere) | keep |
| Bernini's Hammer | a second building queue | **Bernward's Hammer**: Bernward, bishop of Hildesheim, builder of St Michael's and its bronze doors (1015) | Master Gerhard's Square (Cologne Cathedral, 1248) | touch: a mason's hammer and chisel on stone, not marble |
| Vesta's Blessing | troop upkeep halved, 1 day | **Elizabeth's Bread**: St Elizabeth of Thuringia's alms in the famine of 1226 | Barbarossa's Camp Law (his 25 camp rules of 1158, prices included) | redraw: a basket of loaves |
| Vesta's Grand Blessing | troop upkeep halved, 7 days | **Elizabeth's Granary** (she opened the castle's stores) | | redraw: sacks of grain |
| Quartermaster's Seal | training 25% cheaper, 1 day | **Marshal's Seal**: the marshal ran the horses and the army ("quartermaster" is a later, naval word) | Steward's Seal | keep |
| Quartermaster's Charter | training 25% cheaper, 7 days | **Marshal's Charter** | Steward's Charter | keep |

Military's two training notes say "(Marshal)" in place of "(Quartermaster)"; the send-army dialog's capacity line names the new banner.

### City

| Now | Does | Proposed | Alternatives | Icon |
|---|---|---|---|---|
| Truce Agreement | 12 hours' peace | **Truce of God** (Treuga Dei): the Church's truce from 1027, in the Empire from the 1080s | King's Peace; Landfriede, the Empire's public peace (from 1103) | keep: a white flag |
| City Teleporter | moves the city | **Locator's Charter**: the locator recruited settlers and laid out a new town under a charter | Charter of Foundation | touch: a charter with a seal over the map |
| Civil Code | adds population | **Magdeburg Rights**: the town law that drew settlers to new towns (from about 1160; oldest charter 1188) | Sachsenspiegel (law book, about 1225) | keep: a tablet of laws (or a sealed charter) |
| Penicillin | heals the city's injured | **Theriac**: the period's cure-all, made in Venice from the 12th century | Hildegard's Physica (her book of remedies, 1150s) | touch: a jar, not a modern flask |

### Boxes

| Now | Proposed | Alternatives | Icon |
|---|---|---|---|
| Junior Medal Box | **Bronze Coffer** | Small Medal Chest | keep (wood bound in bronze) |
| Medium Medal Box | **Silver Coffer** | Medal Chest | keep |
| Senior Medal Box | **Gold Coffer** | Great Medal Chest | keep |
| Hero Package | **Oath of Fealty**: a hero who swears to serve | Letter of Recommendation; Accolade | redraw: a sealed letter |
| Welcome Package | **Founder's Gift** | Settler's Bundle | keep |

### Heroes

| Now | Does | Proposed | Alternatives | Icon |
|---|---|---|---|---|
| Holy Water | resets a hero's points | **Holy Water** (kept: period and plain) | | keep |
| Excalibur | +25% power, 1 day | **Joyeuse**: Charlemagne's sword (Charlemagne is Atlantis's guard in [famous-heroes.md](famous-heroes.md)) | Imperial Sword (the regalia's sword, about 1200); Durendal | keep |
| The Art of War | +25% intelligence, 1 day | **Stratagems**: Frontinus' book of ruses of war, copied from the 9th century | Vegetius' Epitome | redraw: a book, not bamboo slips |
| The Wealth of Nations | +25% politics, 1 day | **Mirror of Kings**: Godfrey of Viterbo's book of rule for the young Henry VI, about 1183 | Policraticus (John of Salisbury, 1159) | touch: a mirror on the cover |
| Anabasis | +1,000 experience | **Waltharius**: a Latin epic of a hero's escape, 10th century | Deeds of the Saxons (Widukind, about 967) | keep |
| Epitome of Military Science | +10,000 experience | **Epitome of Military Science** (kept: Vegetius was among the most copied books of the period) | | keep |
| On War | +100,000 experience | **Nibelungenlied** (about 1200) | Deeds of Frederick (Otto of Freising, 1157–60) | keep |

### Medals

"Medal" stays the word: the gear, reports and statistics all say it, and players know what it means. Cross, Rose and Lion are heraldic charges, and Honour, Courage, Wisdom and Justice are virtues of the period (the cardinal virtues and the courtly ones), so they stay. Only the two modern ideas go:

| Level | Now | Proposed | Icon |
|---|---|---|---|
| 1–6 | Cross, Rose, Lion, Honour, Courage, Wisdom | kept | keep |
| 7 | Freedom | **Fidelity** (*triuwe*, the knight's loyalty: apt for a medal that raises a hero's loyalty) | touch: a new emblem |
| 8 | Justice | kept | keep |
| 9 | Nation | **Crown** | touch: a crown emblem |

Alternatives, if the medals should change more:

- **The courtly virtues**, rising to loyalty:
  - Bronze: Courtesy, Measure, Largesse.
  - Silver: Constancy, Valour, Honour.
  - Gold: High Spirit, Fidelity, Loyalty.
- **Knightly objects**, ending in the regalia:
  - Bronze: Spur, Sword-belt, Shield.
  - Silver: Lance, Banner, Seal.
  - Gold: Sceptre, Orb, Crown.

The Nine Worthies (Hector, Alexander, Caesar; Joshua, David, Judas Maccabeus; Arthur, Charlemagne, Godfrey) fit three tiers of three exactly. They're left out because Godfrey led the First Crusade.

### In all

Of 53 items, the recommendation renames 43 and keeps 10:

- **Kept:** War Horn, Holy Water, Epitome of Military Science, and the medals Cross, Rose, Lion, Honour, Courage, Wisdom and Justice.
- **Icons:** 9 redrawn and 10 touched. The rest still fit.

## Items that don't earn their place

An audit of every item (2026-11-08): how a player gets it, what it does, what it costs against the alternatives, and how much it was used. It matters to the rename, since an item merged or dropped needs no name.

**How it was checked:**
- **How items are got and priced:** from core (`itemGoldPrice`, `heroItemGoldPrice`, `speedupItemGold`, `goldForSpeedup`, `QUEST_CATALOGUE`, `BALANCE.items`, `BALANCE.goldShop`).
- **How much they're used:** from the dev stack's statistics (`player_stats`: `items.used`, `items.gained`) and inventories, read only.
- **How far to trust the usage:** the dev stack has one player (the maintainer's), at `GAME_SPEED=60` and with a lot of gold, so the usage is a hint. The price comparisons hold anywhere.

**Every item can be got:**
- **The shop:** 43 are sold for gold, every item but the Welcome Package and the 9 medals.
- **Medals** come from battle, the medal boxes and two quests.
- **Quests** also give Primary Guidelines, Plowshares and Civil Code.
- **The Welcome Package** gives Beginner and Primary Guidelines.
- **At the moment of use:** the speed-ups (Napoleon's Diary and Archimedes' Note included), the hero items, Holy Water and the Truce Agreement can be bought then.

### Findings

1. **The speed-up books in the shop cost what gold would.**
   - Beginner to Senior Guidelines are priced to the gold exactly what finishing the same time at once costs: 40,000 for 15 minutes, 85,000 for an hour, 165,000 for 2½ hours, 415,000 for 8 hours (`speedupItemGold` against `goldForSpeedup`). Buying one is the same as pressing *finish for gold* later.
   - Master Guidelines (665,000 for 10–30 hours) are cheaper than gold for the same time (about 1,165,000 for 20 hours).
   - Ultimate Guidelines (1,000,000 for 30% of the whole time) pay only on a job of 60 hours or more.
   - The player used none: 1.19 million gold went on finishing at once instead.
   - As gifts (the Welcome Package, quests) they're worth having. As things to buy they add a step and nothing else.
2. **The experience books overlap.**
   - Bought at the moment of use, every book costs 1 gold per point of experience (`BALANCE.heroItemGold.perExp`). From the shop they always cost more, from 1.3 to 65 gold a point (On War is 835,000 for 100,000 to 640,000 experience).
   - So no one should buy one in the shop. At the moment of use, On War, a whole level at least, does what the other two do in one press.
   - The player used On War 1,268 times, Anabasis 3 and the Epitome never.
3. **Bernini's Hammer was about ten times too cheap** (*fixed 2026-11-08:* 1,000,000 gold in `BALANCE.goldShop`). 40,000 gold bought a third building queue for 7 days: the original's 5 cents carried over (`goldForCents`), with no set price in `BALANCE.goldShop`. A day of +25% gold (Tax Policy) costs 375,000, and a day of 25% cheaper training 250,000.
4. **Medals pile up, so the medal boxes have no use.**
   - The player holds about 33,000 medals (2,600 to 5,300 of each kind) and has used about 60.
   - Medals are spent in three places: hero loyalty (capped at 100), the gear (2 a star, 6 Nation Medals for the tenth: 336 for every piece at full stars, once) and titles (15 a promotion, 9 promotions). Captured heroes, which the original also persuaded with medals, are gone (deviations.md).
   - Battle drops (`BALANCE.medalDrops`, up to 3 a won attack) far outrun that, so the medal boxes, 665,000 to 2,000,000 gold, buy what anyone attacking already has thousands of.
   - This is a balance question in its own right: fewer drops, or a new use for medals.
5. **The one-day boosts are rarely worth it.**
   - Every seven-day boost costs about 6 to 6.4 times its one-day twin for 7 times the time (production 65,000 and 415,000; gold 375,000 and 2,335,000; attack and defence 85,000 and 500,000; upkeep 150,000 and 950,000; training 250,000 and 1,600,000).
   - The player only ever used the seven-day ones. A one-day boost is still a cheaper way in, and the original had the same pairs, so this is the mildest finding.
6. **Not usable for now, by design:** the Truce Agreement, while PvP is off (the Items panel hides it; docs/backlog.md).
7. **Open elsewhere:**
   - Penicillin heals a city's injured at once (1,000,000 gold), where the original cut losses for 7 days: [rules-check.md](../rules-check.md), finding 11.
   - The Welcome Package now holds 5 Beginner and 3 Primary Guidelines and 50,000 of each resource (`BALANCE.items.welcomePackage`). deviations.md says it "keeps its other contents", and reference/items.md lists a far bigger starter set, so one of them is out of date.
8. **Used little, but fit:**
   - Napoleon's Diary, Archimedes' Note, The Art of War, Civil Code and the City Teleporter each have a clear job no other item does.
   - Low use on a fast dev stack with one player says little. Intelligence matters (construction, research and battle), so The Art of War isn't redundant.

### What could change

Each change is a rule change: it goes in deviations.md with BALANCE numbers, separately from the rename, and is decided first, because it changes how many names are needed.

| Finding | Options | Recommended |
|---|---|---|
| 1. Speed-up books | (a) keep as they are; (b) take Beginner to Senior out of the shop (gifts, quests and buying at the moment of use only); (c) sell them at a discount (say 80% of gold's price), so holding one is worth something | (b): fewer shop rows, no loss to anyone |
| 2. Experience books | (a) keep three; (b) keep three as gifts, out of the shop; (c) one book, bought at the moment of use, giving a level (or a share of it) | (b) now; (c) if nothing gives the small ones away |
| 3. Bernini's Hammer | a set price in `BALANCE.goldShop` near the other seven-day boosts | 1,000,000 for 7 days (done 2026-11-08) |
| 4. Medals | (a) fewer drops (`BALANCE.medalDrops`); (b) a new use (the market, a faction's favour, items for medals); (c) take the medal boxes out of the shop | (c) now, and (a) or (b) as an item of its own in TODO.md |
| 5. One-day boosts | (a) keep; (b) cut the seven-day discount; (c) drop the one-day ones | (a) |

If all the recommendations are taken, the item list itself stays at 53 (nothing is removed, only taken out of the shop), so the rename's list stands. Option 2(c) would drop two items (Anabasis and the Epitome).

## Translation

- Every new name goes into every locale in the same change (AGENTS.md, Translations). The famous names need a translator's care:
  - **ja-JP:** the usual Japanese form (ニーベルンゲンの歌, 神の休戦), katakana for the rest.
  - **ar:** the established Arabic term where there is one, a description where not (*Theriac* is الترياق, an old Arabic word).
  - **es:** Spanish has its own names for many (Joyosa, Olifante, Tregua de Dios, Cantar de los nibelungos, Triaca, Derecho de Magdeburgo).
- en-US differs only in Ploughshare and Heavy Plough (Plowshare, Heavy Plow).
- Short names (`hero.loyalty.N.short`) change with the medals.

## Open questions

1. **The option:** C as recommended, or D (plain ladders everywhere), B or keeping the old names?
2. **The names:** the recommended list, or alternatives item by item? In particular:
   - Unfamiliar ones: Theriac, Burgward Ordinance, Waltharius, Olifant.
   - Religious ones: Truce of God, Elizabeth's Bread and Granary, Holy Water. Keep, or the secular alternatives (King's Peace, Barbarossa's Camp Law)?
3. **The speed-ups' ladder:** craft ranks (Novice … Grandmaster) or numbered Builder's Notes I–V?
4. **The medals:** two renamed, or a whole new set?
5. **The code:** rename `ItemId`'s names and the icons' files with the items (AGENTS.md keeps them "named after the item"), or keep the old ones in code? Recommended: rename them, as a separate change after the text, since a refactor doesn't change behaviour.
6. **Old names for players of the original:** say nothing, or show "formerly …" in item descriptions for a while? Recommended: nothing, since the game hasn't been released.
7. **The items themselves** (*Items that don't earn their place*, What could change): which changes to make, before or alongside the rename? Above all whether the experience books become one, which drops two names.

## Phases

1. **Decide** the names and the item changes (the open questions).
2. **The item changes,** if any, as their own change: BALANCE, deviations.md, tests. Bernini's Hammer's price went first (2026-11-08).
3. **The text:** the new names in every locale, the four texts that name items, quest 28's name, and an *In Marchlands* name column in reference/items.md (the old name to the new). No rule changes, so nothing in deviations.md beyond its passing mentions.
4. **The code:** `ItemId`'s names, `itemArtFile`'s file names and the PNGs, `tools/art/items.ts` and its drawings' names, the comments and test titles that name items, core's unused English `name` on the item rows. One rename, no behaviour change.
5. **The icons** that no longer match their name (*Icon* above): redraw and touch, with `npm run art:draw -- items`, and item-art.md's step table updated.

## Research

Checked 2026-11-08 against encyclopaedias, museum catalogues and source collections. All 21 claims behind the names held up, 7 with corrections already folded in above:

- The Carroccio was Aribert's standard, not his invention.
- The Empire's banner had no fixed name before 1336.
- 1188 is Magdeburg law's oldest surviving charter, not its beginning.
- The miracle of the roses is a later legend, first told of Elizabeth in 1332, so it isn't used.
- "Quartermaster" is a late, naval word.
- The Louvre's Joyeuse is a composite of the 10th to 13th centuries.
- The Nine Worthies were listed in 1312.

Sources:

- Truce of God and Landfrieden: <https://en.wikipedia.org/wiki/Landfrieden>
- Olifant: <https://en.wikipedia.org/wiki/Olifant_(instrument)>
- Carroccio: <https://en.wikipedia.org/wiki/Carroccio>
- The Empire's flags: <https://en.wikipedia.org/wiki/Flags_of_the_Holy_Roman_Empire>
- Joyeuse: <https://en.wikipedia.org/wiki/Joyeuse>
- Vegetius in the Middle Ages: <https://bmcr.brynmawr.edu/?p=38694>
- Isidore's Etymologiae: <https://en.wikipedia.org/wiki/Etymologiae>
- Godfrey of Viterbo's *Speculum regum*: <https://en.wikipedia.org/wiki/Godfrey_of_Viterbo>
- Magdeburg law's charter of 1188: <https://en.wikipedia.org/wiki/Wichmann_von_Seeburg>
- Locators: <https://en.wikipedia.org/wiki/Lokator>
- Villard de Honnecourt: <https://en.wikipedia.org/wiki/Villard_de_Honnecourt>
- Theriac: <https://en.wikipedia.org/wiki/Theriac>
- The miracle of the roses: <https://en.wikipedia.org/wiki/Miracle_of_the_roses>
- The Nine Worthies: <https://en.wikipedia.org/wiki/Nine_Worthies>
- Villingen's market, mint and toll rights, 999: <https://www.archivportal-d.de/item/CT4VPNZ2Y4Y7S7KUMPEWR4SYOVWHPCL2>
- Water-powered ironworks, Lapphyttan: <https://en.wikipedia.org/wiki/Lapphyttan>
- The horse collar and the heavy plough: <https://en.wikipedia.org/wiki/Horse_collar>
- "Quartermaster": <https://www.dictionary.com/browse/quartermasters>
- The Imperial Regalia: <https://www.khm.at/en/object/100444/>
- Otto II's levy (Indiculus loricatorum): <https://de.wikipedia.org/wiki/Indiculus_loricatorum>
- Henry I's forts (Battle of Riade): <https://en.wikipedia.org/wiki/Battle_of_Riade>
- Bernward of Hildesheim: <https://en.wikipedia.org/wiki/Bernward_of_Hildesheim>
- Barbarossa's camp law of 1158: <https://sourcebooks.web.fordham.edu/Halsall/source/barbarossa-lombards.asp>

Other games' names:

- Travian: <https://support.travian.com/en/support/solutions/articles/7000063372-hero-consumable-items>
- Forge of Empires: <https://forgeofempires.fandom.com/wiki/Mass_Self-Aid_Kit>
- Stronghold Kingdoms: <https://strongholdkingdoms.gamepedia.com/Free_Strategy_Cards>
