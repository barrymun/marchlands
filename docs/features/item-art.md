# Item art

**Status:** built 2026-11-01: an icon for each of the game's 53 items, shown on the Items panel, in the hero items dialog, beside the medals found in battle reports and in the Statistics page's items used. TODO.md item (now in Done): *Images for buildings, troops, gear, items, etc.*, the last of its art. The items were renamed on 2026-11-08 ([item-names.md](item-names.md)), and the icons still drawn as the old items are redrawn there (its phase 5); this note uses the new names.

**The aim:** an icon for every item (`ItemId`, `shared/core/src/item-ids.ts`, medals included) in the style of the other art drawn in code, so a player finds an item by sight as well as by name.

## The references

The original game's icons, on the Evony Wiki's *Items* and *Medals* pages ([reference/items.md](../reference/items.md)), were looked at in a browser in the session of 2026-11-01, for what each item shows and nothing more. They are the original's art, which we don't own: they were never downloaded into the repo, traced or converted (AGENTS.md, Game art). Most are framed paintings on coloured glows; ours are plain sprites on no backdrop, like the troops.

Four of our items aren't on that page and have no reference: Bernward's Hammer, Elizabeth's Granary and the Marshal's Seal and Charter (then Bernini's Hammer, Vesta's Grand Blessing and the Quartermaster's Seal and Charter). Several wiki items Marchlands removed (Dynamite, Speakers, Hero Hunting …) aren't drawn.

## Decided

- **32×32, side on, lit from the top left and outlined,** like the troops (`tools/art/troops.ts`): one PNG per item in `client/web/src/assets/items/`, named after its `ItemId` name by `itemArtFile` (`ottos-muster-roll.png`, `cross-medal.png`). About 12 kB for all 53.
- **No backdrop.** The gear has one per level because its level is the point; an item's kind is plain from what it shows.
- **Steps show as more, or finer.** Where items come in steps, the icon grows with them, so the better one reads as better without its name:

  | Kind | Steps |
  |---|---|
  | Notes (construction and research) | a pile of books, one more each step (Novice's one, Master's four); Grandmaster's top book trimmed in gold, Villard's Sketchbook red with a stone and a glint |
  | Production, one day and seven days | a plain tool, then a better one: ploughshare and iron rake, bow saw and two-man saw, pickaxe and pickaxe with sledgehammer, bellows and blast furnace, a decree and a sealed decree with gold |
  | Attack and defence, one day and seven | a horn and a gold-banded ivory horn; a leather corselet and a steel one trimmed in gold |
  | Upkeep and training cost | Elizabeth's Bread and Granary, still a flame in a goblet and a wider jewelled one; a wax seal and a charter under it |
  | Coffers of medals | chests of wood bound in bronze, iron bound in steel, gold set with stones |
  | Hero experience | Deeds of the Saxons plain leather, the Epitome blue with gold corners, the Nibelungenlied a thick red tome with a clasp |
  | Medals | round bronze (Cross, Rose, Lion), scalloped silver (Honour, Courage, Wisdom), a gold star (Fidelity, Justice, Crown), each on its own striped ribbon with its own emblem (the Lion Medal a paw) |

- **One module per kind** in `tools/art/items/` (`speedups.ts`, `production.ts`, `military.ts`, `city.ts`, `boxes.ts`, `heroes.ts`, `medals.ts`), sharing `common.ts`: the metal and cloth tones, `stamp` (a small pattern from strings, for emblems), books (`lyingBook`, `tome`), `scroll`, `rod`, `lathe` (a shape symmetric about its middle), `flame`, `quill`, coins and seals. `tools/art/items.ts` maps every `ItemId` to its drawing, and `npm run art:draw -- items` writes them. The palette gained a bronze for the lowest medals.
- **Where they show:** at 32 px (`ItemIcon`, `components/item-icon/`) in the hero items dialog, the battle report's medals and the items used, and at 64 px on the Items panel's cards from `sm` (32 below), whole multiples so the pixels stay square. Not on the speed-up buttons or the active effects' slots: they are a line of small text, and halving a 32 px icon drops every other pixel (docs/backlog.md, Item icons in small places).
- **Tested:** `lib/game-art.test.ts` checks every item has its icon and the folder holds nothing else.

## Open questions

None for now. Whether the icons move (a flame flickering, a glint crossing a medal), as the gear's do, can be decided later.
