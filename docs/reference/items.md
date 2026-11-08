# Items in the original game

**Version:** mostly Evony Age 1, mixed with Age 2. The stratagems, the hero enhancement materials (gems, fabric, ore, horses and their boxes), the drinks that restore a hero's strength and Instant Handover (giving up a colony) are Age 2 only: none of them is in the Age 1 server's item data (`shared/core/src/data/legacy/items.json`).

**Source:** *Items*, Evony Wiki (Fandom): <https://evony.fandom.com/wiki/Items> (read 2026-11-01; its text is CC BY-NC-SA). Five lists, each with an icon, a name, a type, what the item does and its shop price in cents. The medals come from the same wiki's *Medals* page: <https://evony.fandom.com/wiki/Medals>.

The wiki's icons are the original game's art, which we don't own. They were looked at in a browser only as a reference for what each item shows, and never saved, traced or converted: Marchlands' item icons are our own pixel art, drawn in code ([features/item-art.md](../features/item-art.md)).

## What happened to each item

Prices are the original's, in cents. Marchlands has no cents: an item it sells costs a city's gold ([deviations.md](../deviations.md), Premium currency). *Kept* means the item is in `ItemId` (`shared/core/src/item-ids.ts`), often with different numbers (its description in the game says what it does here).

### Items

| Item | What it did | Cents | In Marchlands |
|---|---|---|---|
| Adv City Teleporter | moved the city to a chosen tile | 90 | removed: the City Teleporter picks the tile |
| Anabasis | +1,000 hero experience | 8 | kept |
| The Art of War | +25% to a hero's intelligence for 7 days | 40 | kept |
| City Teleporter | moved the city to a random tile in a chosen state | 30 | kept |
| Civil Code | added 20% of the population limit (at least 100) at once, while under the limit | 50 | kept |
| Corselet | +10% troop defence for a day | 10 | kept |
| Dynamite | demolished a building at once, returning nothing | 20 | removed: demolition is instant |
| Epitome of Military Science | +10,000 hero experience | 30 | kept |
| Excalibur | +25% to a hero's attack for 7 days | 40 | kept |
| Hero Hunting | re-rolled the Inn's heroes | 5 | removed: the Inn is re-rolled for gold |
| Holy Water | reset a hero's attribute points; one more is needed every 10 hero levels | 20 | kept |
| Holy Water (5) | five Holy Water | 90 | removed |
| Ivory Horn | +20% troop attack for 7 days | 60 | kept |
| Michelangelo's Script | needed to build past level 10 | 50 | removed: no item needed |
| National Flag | changed the flag's text | 6 | removed: free |
| New ID | renamed the player | 200 | removed: free once a day |
| On War | +100,000 hero experience | 100 | kept |
| Penicillin | up to 30% fewer troops lost in battle for 7 days | 120 | kept, but it heals the city's injured troops |
| Ritual of Pact | raised the alliance's member limit | 500 | removed |
| Speaker, Speaker (10), Speaker (100) | paid for World chat and group messages | 3, 27, 240 | removed: World chat is free |
| Speech Text | city loyalty to 100 and grievance to 0 | 100 | removed: cities have no loyalty |
| Truce Agreement | 12 hours' peace, unless armies are on the move | 30 | kept |
| Ultra Corselet | +20% troop defence for 7 days | 60 | kept |
| Vesta's Blessing | troop upkeep halved for a day | not sold | kept, with a 7-day Vesta's Grand Blessing added |
| War Ensign | +25% troops in an army leaving the Rally Spot | 30 | kept |
| War Horn | +20% troop attack for a day | 10 | kept |
| The Wealth of Nations | +25% to a hero's politics for 7 days | 40 | kept |
| Delicate Gem, Flawless Gem, The Lost Armor Script | upgrading hero equipment | 1, 2, 8 | Age 2 only (our gear is upgraded with medals) |
| Tea, Lugui Wine, Panax Ginseng, Essential Oil | restored 10%, 30%, 60% or 100% of a hero's strength | 10–100 | Age 2 only |

### Speed-ups

| Item | What it did | Cents | In Marchlands |
|---|---|---|---|
| Beginner Guidelines | 15 minutes off a construction or research | 5 | kept |
| Primary Guidelines | 1 hour off | 10 | kept |
| Intermediate Guidelines | 2½ hours off | 20 | kept |
| Senior Guidelines | 8 hours off | 50 | kept |
| Master Guidelines | 10 to 30 hours off | 80 | kept |
| Ultimate Guidelines | 30% off | 120 | kept |
| Napoleon's Diary | 30% off a batch of troops in training, once per batch | 30 | kept |
| Archimedes' Note | 30% off a batch of fortifications, once per batch | 35 | kept |
| Merchant Fleet | finished a market shipment at once | 5 | removed: trades settle at once |
| Instant Handover | gave up a colony at once | 20 | Age 2 only |

### Production

Each comes in a one-day and a seven-day version, every one +25%:

| Resource | One day (cents) | Seven days (cents) | In Marchlands |
|---|---|---|---|
| Food | Plowshares (8) | Iron Rake (50) | kept |
| Lumber | Arch Saw (8) | Double Saw (50) | kept |
| Stone | Quarrying Tools (8) | Adv Quarrying Tools (50) | kept |
| Iron | Blower (8) | Blast Furnace (50) | kept |
| Gold (tax) | Tax Policy (45) | Adv Tax Policy (280) | kept |

### Chests

| Item | What it held | Cents | In Marchlands |
|---|---|---|---|
| Junior Medal Box | 2 to 4 Cross, Rose or Lion Medals | 80 | kept |
| Medium Medal Box | 2 to 4 Honour, Courage or Wisdom Medals | 140 | kept |
| Senior Medal Box | 2 to 4 Freedom, Justice or Nation Medals | 240 | kept |
| Hero Package | 10 Holy Water and 10 Hero Hunting | 188 | kept as a box that brings a hero (`BALANCE.items.heroBoxes`) |
| Package for Newbies | a starter set: a production boost of each kind, War Horn, Corselet, three Guidelines, Truce Agreement, Holy Water, City Teleporter, Anabasis, a few medals | not sold | kept as the Welcome Package each new player gets (its removed items taken out) |
| Package for Lords | a larger set of 21 items and 250 workers | not sold | removed, with the other promotion packages |
| Amulet, Aries Amulet | one random item | 5 | removed: no gambling |
| Junior Battalion, Senior Battalion | troops (the Amulet's prizes) | not sold | removed |
| Crude Gemstone, Fabric, Iron Ore and Wood Boxes, Riding Reing, Hero Enhancement Materials Package | hero enhancement materials | 5 | Age 2 only |

### Stratagems

All Age 2 only: 22 one-use tricks against another player's city or armies, such as making a city's troops or resources look larger or smaller than they are, burning stored food, slowing or speeding marching armies, stopping troops leaving or being recalled, lowering a rival hero's loyalty or strength, spying on armies, and attacking without declaring war. Marchlands has none.

## The medals

Nine levels of hero loyalty medal, all kept (`medalId(level)`): Cross, Rose, Lion, Honour, Courage, Wisdom, Freedom, Justice and Nation. They were won by attacking valleys and barbarian cities (more likely from higher levels, and with a more intelligent hero), and spent on military ranks, titles, hero loyalty and persuading captured heroes. Marchlands drops them from won attacks on cities (deviations.md, Attacks never drop items) and also spends them on hero gear.

## Items Marchlands added

Not in the original: Bernini's Hammer is in the Age 1 data but not on this page (a second building queue); Vesta's Grand Blessing (troop upkeep halved for 7 days), Quartermaster's Seal and Quartermaster's Charter (troop training 25% cheaper for a day or 7 days) are ours (deviations.md, Premium currency).

## Names in Marchlands

Every item has a name of its own since 2026-11-08 ([features/item-names.md](../features/item-names.md), which says why each was chosen). The ids stored in players' inventories didn't change. The medals not listed (Cross, Rose, Lion, Honour, Courage, Wisdom, Justice) kept their names.

| Original name | Marchlands name | Id |
|---|---|---|
| Beginner Guidelines | Novice's Notes | `consume.2.a` |
| Primary Guidelines | Apprentice's Notes | `consume.2.b` |
| Intermediate Guidelines | Journeyman's Notes | `consume.2.b.1` |
| Senior Guidelines | Master's Notes | `consume.2.c` |
| Master Guidelines | Grandmaster's Notes | `consume.2.c.1` |
| Ultimate Guidelines | Villard's Sketchbook | `consume.2.d` |
| Napoleon's Diary | Otto's Muster Roll | `player.troop.1.b` |
| Archimedes' Note | Henry's Castle Law | `player.fort.1.c` |
| Plowshares | Ploughshare | `player.resinc.1` |
| Iron Rake | Heavy Plough | `player.resinc.1.b` |
| Arch Saw | Bow Saw | `player.resinc.2` |
| Double Saw | Water Saw | `player.resinc.2.b` |
| Quarrying Tools | Mason's Pick | `player.resinc.3` |
| Adv Quarrying Tools | Treadwheel Crane | `player.resinc.3.b` |
| Blower | Hand Bellows | `player.resinc.4` |
| Blast Furnace | Water Bellows | `player.resinc.4.b` |
| Tax Policy | Toll Right | `player.gold.1.a` |
| Adv Tax Policy | Mint Right | `player.gold.1.b` |
| War Horn | *(kept)* | `player.attackinc.1` |
| Ivory Horn | Olifant | `player.attackinc.1.b` |
| Corselet | Gambeson | `player.defendinc.1` |
| Ultra Corselet | Hauberk | `player.defendinc.1.b` |
| War Ensign | Imperial Banner | `player.troop.1.a` |
| Bernini's Hammer | Bernward's Hammer | `player.queue.building` |
| Vesta's Blessing | Elizabeth's Bread | `player.reduce.troops.upkeep.1` |
| Vesta's Grand Blessing | Elizabeth's Granary | `player.reduce.troops.upkeep.7` |
| Quartermaster's Seal | Marshal's Seal | `player.reduce.troops.cost.1` |
| Quartermaster's Charter | Marshal's Charter | `player.reduce.troops.cost.7` |
| Truce Agreement | King's Peace | `player.peace.1` |
| City Teleporter | Locator's Charter | `consume.move.1` |
| Civil Code | Magdeburg Rights | `player.pop.1.a` |
| Penicillin | Theriac | `player.relive.1` |
| Junior Medal Box | Bronze Coffer | `player.box.special.1` |
| Medium Medal Box | Silver Coffer | `player.box.special.2` |
| Senior Medal Box | Gold Coffer | `player.box.special.3` |
| Hero Package | Oath of Fealty | `player.box.currently.1` |
| Welcome Package | Founder's Gift | `player.box.present.2` |
| Holy Water | *(kept)* | `hero.reset.1` |
| Excalibur | Joyeuse | `hero.power.1` |
| The Wealth of Nations | Mirror of Kings | `hero.management.1` |
| The Art of War | Stratagems | `hero.intelligence.1` |
| Anabasis | Deeds of the Saxons | `player.experience.1.a` |
| Epitome of Military Science | *(kept)* | `player.experience.1.b` |
| On War | Nibelungenlied | `player.experience.1.c` |
| Freedom Medal | Fidelity Medal | `hero.loyalty.7` |
| Nation Medal | Crown Medal | `hero.loyalty.9` |
