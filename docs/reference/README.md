# Reference: the original game

Notes on how the original Evony worked, gathered from player guides, wikis and fan sites, so we can check our rules against it and borrow from it. They're written in our own words, with the facts (numbers, coordinates, rules) and a link to each source; pages aren't copied. A long guide can get a note of its own that restates the whole of it, crediting its author.

- **No personal data.** Notes link to public sources (the live page, or its Wayback Machine archive), never to files on someone's computer. Don't carry over authors' contact details (email, Skype, location) either.

- **Not the same as [spec/](../spec/).** `spec/` is reverse-engineered from the original server's source code, which is what Marchlands ports. These notes come from players' accounts of the live game. They can be incomplete, wrong or from a later version.
- **Say which version.** Marchlands follows Evony Age 1. Some sources describe Age 2 (Evony Age II), which added features Age 1 never had, such as historic cities. Each note says which version it describes.
- **Deviating is fine.** Where we choose differently, the rule goes in [deviations.md](../deviations.md) as usual, and a design in [features/](../features/README.md) can point here for what the original did.

## The world, cities and economy

| Note | What it covers | Version | Used by |
|---|---|---|---|
| [historic-cities.md](historic-cities.md) | Historic cities: where every level (12, 14, 16, 18) stands, the state capitals, the garrisons of every level, their daily rotation and regeneration, how players broke and took them (waves, timing with camp time), holding and drafting | Age 2 | [features/historical-cities.md](../features/historical-cities.md), [features/camp-times.md](../features/camp-times.md) |
| [historic-cities-level-12-names.md](historic-cities-level-12-names.md) | The level 12 historic cities' names and coordinates: the seven states a forum list covers (typos and gaps marked), a few more from elsewhere, where the full list lives (the original client), and how many there were | Age 2 | Not yet used: our level 12s are called Historic city |
| [colonies.md](colonies.md) | Colonising players' cities: suzerains, tribute, the daily policies (draft, disarm, population, discord), uprisings | Age 2 | [features/historical-cities.md](../features/historical-cities.md) (a model for a seat's powers) |
| [npc-cities.md](npc-cities.md) | NPC city garrisons by level, compared with our `NPC_TABLE`: the same but for one cell | Age 2 against Age 1 | `shared/core/src/world.ts` |

## Players

| Note | What it covers | Version | Used by |
|---|---|---|---|
| [titles.md](titles.md) | Nobility titles (Knight … Prinzessin): cities each allows, and the prestige, gold, medals and military rank each promotion needed, with how the sources agree | Age 2, Age 1 consistent | `shared/core/src/titles.ts` |

## Heroes

| Note | What it covers | Version | Used by |
|---|---|---|---|
| [famous-historical-heroes.md](famous-historical-heroes.md) | Famous historical heroes: how they were found and captured, and all 636 with their four attributes (from a spreadsheet), with a first pass at the ones who fit the Marchlands | Age 2 | [TODO.md](../../TODO.md), Famous historical heroes |

## Items

| Note | What it covers | Version | Used by |
|---|---|---|---|
| [items.md](items.md) | Every item on the wiki's list (items, speed-ups, production, chests, stratagems) and the medals: what each did, its price in cents, and whether Marchlands kept it | Age 1, with Age 2's items marked | `shared/core/src/item-ids.ts`, [features/item-art.md](../features/item-art.md) |

## Combat

| Note | What it covers | Version | Used by |
|---|---|---|---|
| [gilgad-combat-mechanics.md](gilgad-combat-mechanics.md) | Gilgad's *Combat Mechanics Guide v2* (2013), restated with credit: field sizes, troop stats, movement, targeting, the casualty formulas, named tactics | Age 2 | [combat-guides.md](combat-guides.md) |
| [aeroagg-complete-guide.md](aeroagg-complete-guide.md) | AeroAgg06's *Complete Guide + AeroCalc v2.2* (2010), restated with credit: starting out, heroes, taking NPC cities, battle mechanics, walls, historic city waves, medals, achievements, camp time | Age 2 | [combat-guides.md](combat-guides.md), [historic-cities.md](historic-cities.md) |
| [combat-guides.md](combat-guides.md) | Two Age 2 combat guides (Gilgad's mechanics guide, AeroAgg06's complete guide with AeroCalc) against our battle engine: what they confirm, where they differ, two likely errors in our data (wall space, troop population), and tests they make possible | Age 2 against Age 1 | `shared/core/src/battle/`, [battle-sims/](../battle-sims/README.md) |
| [ballista-farming-and-wall-range.md](ballista-farming-and-wall-range.md) | Why ballistae can't farm barbarian cities in our engine but did in Age 1 (traps, standing off from the wall), and the evidence on a wall range bonus for defending troops | Age 1 against our engine | `shared/core/src/battle/simulator.ts`, [battle-sims/mechanics.md](../battle-sims/mechanics.md) |
