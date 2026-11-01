# Rules check against the original game (November 2026)

The TODO item *Check the game logic against the original game's documentation*, first pass, 2026-11-01. The rules were compared with what the repository holds about the original Evony Age 1: the player guides in [reference/](reference/README.md), the original server's source in [spec/](spec/), and its data dump (`shared/core/src/data/legacy/*.json`). Anything already in [deviations.md](deviations.md) wasn't a finding. Historic cities (Age 2 content) were left out. Wikis and guides not yet summarised in `reference/` weren't read.

As decided with the maintainer: clear bugs are fixed, and anything that changes how the game plays is listed here for the maintainer to decide.

The guides' strategies, run through the battle simulator, are in [battle-sims/old-guides.md](battle-sims/old-guides.md).

## Fixed

- **Percentage speed-ups were scaled by the game speed twice.** Ultimate Guidelines (30%) and the 50% speed-up cut a share of a construction's or research's whole time, which is stored in real time, and the cut was then scaled by `GAME_SPEED` again: at speed 60 they took 0.5% off, not 30%. Now `speedupCut` (`shared/core/src/construction.ts`) scales only the fixed cuts (15 minutes, 1 hour …), which are game time. The tests ran at speed 1, where the two agree; a core test now runs at 60.
- **A captured hero kept its loyalty,** so its captor could persuade it only if it had been captured at loyalty 0. The original sets a captive's loyalty to 0 (`spec/battle.md`, hero capture); so does `armyWiped` now (`engine/combat.ts`).
- **Heroes stationed in a city didn't defend it against scouts,** though they do against attacks; the original takes the strongest of the city's heroes and the stationed ones for both (`spec/battle.md`). The scout battle now does too.
- A misplaced comment on `BALANCE.maxRestTimeMs`, which described the Relief Station.

## For the maintainer to decide

Differences that change how the game plays, or where the sources disagree. None is in deviations.md yet.

### Buildings, research and the city economy

1. **Only the highest Warehouse protects.** `protectedResources` (`shared/core/src/economy.ts`) takes the highest Warehouse's level, though a city may build many (the original's limit is 0, and its own system mail says "build more Warehouses to preserve the resources"). The protection (550,000 at level 10, split between the resources by the store percentages, 25% each by default) is also tiny beside the storage, which is ×100. Should Warehouses add up, should protection grow with the storage multiplier, and should the text ("protects up to … of each resource") say it's shared?
2. **The free speed-up counts the time left, not the job's whole time.** The original finishes a job free only when its whole time is 5 minutes or less (and the AeroAgg guide agrees); here any job can be finished free in its last 5 minutes (`buildings.ts`, `research.ts` speedup; tested on purpose). Keep it, and note it in deviations.md, or follow the original?
3. **The base +100 an hour isn't cut by worker efficiency.** The original's accrual multiplies it by efficiency, its display doesn't; we follow the display. At most 100 an hour a resource, only while a city is short of workers.
4. **Engineering, Machinery and Privateering do nothing** (as in the original), but cost resources and time to research. Hide them, give them an effect, or leave them?
5. **Stockpile raises all storage by 10% a level.** The original gave it no effect; its prerequisite (Warehouse at its level) suggests it was meant for the Warehouse. With storage ×100 the +10% matters little; a Warehouse bonus would (item 1).

### Combat, troops, heroes and items

6. **Beginners can attack and scout barbarian cities.** The original refused any attack or scout on a city tile (player or barbarian) while under beginner protection, and allowed valleys; we refuse only players' cities.
7. **Holy Water resets a hero of any level for one bottle.** The wiki and the AeroAgg guide say one bottle per 10 hero levels; the original server charged nothing at all.
8. **Hero attribute items last a day.** The wiki gives Excalibur, The Art of War and The Wealth of Nations 7 days, and their price (40 cents, between a 1-day and a 7-day horn) fits that; deviations.md says the original was 24 hours, without a source.
9. **Corselet gives +20% defence.** The wiki has Corselet +10% for a day and Ultra Corselet +20% for 7 days; an Age 2 source has Corselet ×1.2. Both are +20% here.
10. **Fortifications cost population** (traps 1, abatis 2, towers 0, rolling logs 5, trebuchets 4; given back when destroyed). The original's wall training ignores the population column.
11. **Penicillin heals every injured troop at once,** where the wiki has it cutting troop losses by up to 30% for 7 days. reference/items.md notes it; deviations.md doesn't.
12. **Workers' and scouts' defence:** the battle uses 50 for both (the ported calculator), the training cards show the data's 10 and 20. Changing the battle would break the calculator's regression cases.
13. **Unused numbers:** `BALANCE.injuredShare` and `BALANCE.plunderShare` are read nowhere and don't match what the game does. Remove them?

## What matches

Checked and found to match the original (details in the check's notes, 2026-11-01):

- **Buildings:** every type's level 1 cost and time (doubling a level), inside or outside, limits and every level's prerequisites; slots (32 inside, 10 + 3 × Town Hall fields); what each building does (Cottage population, fields, queues, Feasting Hall, Inn, Relief Station, Rally Spot, Marketplace, Embassy); beginner protection ending at Town Hall 5.
- **Research:** all 19 technologies' costs, times and prerequisites (Metal Casting's Academy quirk included), per player, a third back on cancelling; the time formulas for construction, research, fortifications and training.
- **Economy:** population, storage, work rates and efficiency, the population step, salaries, gold floored at 0, storage never removing stock, Comfort; game speed applied everywhere but the speed-ups above.
- **Troops and fortifications:** battle stats, costs, training times, prerequisites and upkeep; fortification stats, damage table, wall hit points and capacity.
- **Battle:** the bit-exact calculator, research and heroes in battle, march speed.
- **NPCs:** barbarian cities' garrisons, resources and population by level, loyalty, guard heroes, regeneration (with the documented changes); valley garrisons and guards.
- **Loot, loyalty and capture:** the split of loot, Logistics, barbarian loyalty per win, capture at 0, the hero capture roll.
- **Items:** medals, experience books, medal boxes, Civil Code, construction speed-ups and the training batch speed-ups.

Not checkable from the repository: the Embassy beyond alliances, the Beacon Tower's levels, honour from battles.
