# Hero gear art

**Status:** built 2026-10-23: all 14 pieces at all 11 levels, the backdrops, the stars and the gear card. TODO.md item: *Images for buildings, troops, gear, items, etc.*, Still to draw: hero gear. Since 2026-10-26 the icons move ([gear-animations.md](gear-animations.md)): the scripts also record spots for it (each stone's glint, level 10's points of light, a glowing blade, the backdrop's stars and the moving pieces' pivots) and draw the helm's twins from level 4 (`head-N-bare.png`, `head-N-plume.png`), the sprites themselves unchanged.

**The aim:** an icon for each of the 14 gear pieces (`GEAR_PIECES`, `shared/core/src/gear.ts`) at every gear level, 0 (no Hero Enhancement yet) to 10, so the gear visibly grows grander as the player researches it, as it did in Evony Age 2.

## Where things stand

- Before this, the pieces had no art: the gear card (`components/hero-gear/gear-card/`) listed each by name, level and stars (Lucide stars). The hero card's gear line (`hero-gear-line/`) is still text.
- The gear's level is the player's Hero Enhancement research, 0–10, the same for every piece; each piece has its own stars, 0–10 (Age 2 allowed 15). A star counts only up to the research level: stars above it wait, unused (`gearStarLimit`).
- Other icons are drawn in code (`tools/art/`, AGENTS.md, Game art): troops 32×32, badges 24×24, resources 16×16, written by `npm run art:draw` as indexed PNGs into `client/web/src/assets/<kind>/`, named by a function in `lib/game-art.ts` with a test that every file is there.

## The references

The maintainer shared Age 2's own icons in the session of 2026-10-23, as a reference for style only: they aren't converted or traced, and they stay out of the repo (AGENTS.md, Game art). What they show, in our words:

- **Every level has its own look,** the object and its backdrop both: a near-black backdrop with no level, grey at level 1, green at level 2, blue at level 3 (the legs), and at level 10 a pink-red one with white sparkles. Low levels are plain and real (wood, leather, plain steel); level 10 is fantastic: spiked, winged, red and silver armour, glowing gems.
- **Stars** sit beside the icon in two rows, in two looks: red stars and orange circles.
- **The pieces,** at the levels shown:

  | Piece | No level | Level 1 | Level 2 |
  |---|---|---|---|
  | Weapon | a wooden sword | a steel broadsword | a slender sabre |
  | Shield | a round wooden shield, iron rim and boss | a steel kite shield, its halves light and dark | (none) |
  | Mount | a chestnut horse's head with a rope halter | a chestnut and white head with a bridle | a grey horse in red-brown barding |
  | Necklace | an amber pendant on a red cord | a plain silver chain | (none) |
  | Charm | a small gold tag on a red cord | a pair of silver drop earrings | (none) |
  | Ring | a bronze band with an engraved pattern | a silver ring with a dark band | a silver band engraved with vines |
  | Head | a round steel cap with a gold rim | a closed silver helm with a dark visor | a silver great helm with an eye slit |
  | Shoulder | a steel pauldron with gold trim over white cloth | a plain grey pauldron | a pauldron worked in a spiral |
  | Chest | a blue-steel cuirass with blue padding | an ornate silver and red breastplate with a heart-shaped boss | a silver breastplate, its plates riveted |
  | Back | a blue cloak with wavy stripes, hung from a rod | a red cape under a silver collar | a dark grey cape under a studded collar |
  | Gauntlets | a blue bracer with a gold crown cuff | a silver gauntlet | a dark bracer, engraved |
  | Belt | a glowing blue band with a gold buckle | a silver and blue belt with a square buckle | a dark band set with silver studs |
  | Legs | plain white cloth trousers | pink trousers with a belt | dark armoured greaves marked with silver crosses (level 3: green trousers with a brown waist, on blue) |
  | Feet | blue and white boots with gold trim | silver plate boots | silver boots |

  With no level, the armour (head, shoulder, chest, gauntlets, belt, feet) is one set: blue steel with gold trim. The weapon, shield, mount, necklace, charm and ring start in wood, rope or bronze instead.

  At level 10 (the gear card screenshots): a red and silver breastplate with a horned collar, a back piece of bat wings, spiked red gauntlets, a belt with a jewelled buckle, armoured greaves and boots, all red, silver and glowing teal.

## Decided

- **Our own art, drawn in code** (2026-10-23), from the references' style; no PNG reader is needed. Should one be needed later (to check sprites' pixels in a test), use an established library (`pngjs`) rather than our own decoder.
- **Fantastic at the top** (2026-10-23): plain and real at the low levels, growing ornate and fantastic towards 10, as in Age 2.
- **A new look at every level** (2026-10-23): 14 pieces × 11 levels (0–10), each piece one drawing function of the level (its material, shape, ornament and gems), so 154 sprites from 14 functions.
- **A colour per level** (2026-10-23), for the backdrop and the gems: 0 near-black, 1 grey, 2 green, 3 blue (from the legs' level 3 reference; first planned as teal), 4 teal, 5 indigo, 6 purple, 7 magenta, 8 orange, 9 gold, 10 a pinky crimson with sparkles. They are constants reserved for the gear, in the art's palette, and distinct from the colours the app gives a meaning (lib/tones.ts and hero-attributes.ts: emerald for politics and gains, rose for attack, sky for intelligence, violet for item bonuses, amber for warnings, red for losses): a yellow-green rather than emerald, a cobalt rather than sky, a plum rather than violet, a crimson rather than rose.
- **Stars beside the icon, in pixel art** (2026-10-23): red stars for the stars in use, orange circles for those waiting above the research level.

## Built

- **Size:** 32×32 sprites with the level's backdrop drawn as its own sprite (11 files) and stacked under the piece by the client (`GearIcon`); shown at 64 px on the gear card. Small: the 154 sprites, 11 backdrops and 3 stars come to about 42 kB (the game art budget is 250 kB).
- **Files:** `client/web/src/assets/gear/<piece>-<level>.png`, `gear/backdrop-<level>.png` and `gear/star-<used|waiting|empty>.png`, named by `gearArtFile`, `gearBackdropFile` and `gearStarFile` in `lib/game-art.ts`; `tools/art/gear.ts` draws the backdrops and stars and lists the pieces, one module each in `tools/art/gear/` with shared helpers in `gear/common.ts` (`npm run art:draw -- gear`); a test checks all 168 files are there and nothing else.
- **The colours:** `gear0` … `gear10` in the art palette (`tools/art/pixel.ts`), each level a light (`gearNHi`), mid and dark (`gearNDark`) shade, marked reserved for the gear; the stars have their own (`star…`, `wait…`).
- **Shown:** on the gear card, each piece's icon at the level researched with its stars beside it (two rows of five) and the star button under them. The card's pieces go two to a row once the card (not the screen) is wide enough (a container query). Not on the hero card's gear line yet.
- **The ladder every piece climbs:** its reference look at 0–2 (wood, rope, bronze, or the blue-steel armour set at 0; plain steel at 1; engraved or dark steel at 2), then `look(level)`: steel trimmed in gold with stones in the level's colour that grow (each set in gold with a white glint, so it shows on its own backdrop), cloth and plumes in that colour, spikes from 7 and horns from 8, gilded at 9, and crimson trimmed in silver at 10. Horns are filled shapes inside the outline; thin spikes are drawn after it.
- **The weapon:** a wooden sword (0), a steel broadsword (1), a sabre (2), a longsword with a blue pommel stone (3), then larger blades with guards swept up, stones in the level's colour, runes (5, 7), a waving edge (6), glowing edges and fullers (6–8), horned guards (7–10), gilded (9), and a crimson blade with silver edges (10).

## Open questions

1. What the orange circles meant in Age 2 (we use them for waiting stars either way).

## Phases

1. **The weapon** at all 11 levels, the backdrops, the colour constants, the stars, and the gear card showing them, for review (built 2026-10-23).
2. **The other 13 pieces** (built 2026-10-23).
3. **Maybe later:** the icons on the hero card's gear line and in the hero items dialog.
