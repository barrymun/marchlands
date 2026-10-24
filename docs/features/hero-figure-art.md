# Hero figure art

**Status:** built 2026-10-24: the sample, every layer at every level, and the figure on the Heroes page's character sheet with its movement. TODO.md item: *Heroes page: the figure wearing its gear*. The page it goes on is [heroes-page.md](heroes-page.md) (phase 2, the roster and character sheet).

**The aim:** on the Heroes page's character sheet, the selected hero drawn as a pixel-art figure **wearing** its 14 gear pieces at the level it can use, as the character screens of Diablo and World of Warcraft show it, a man or a woman as the hero is. Low levels look plain and real, level 10 fantastic, the same ladder the gear icons climb ([hero-gear-art.md](hero-gear-art.md)).

## Where things stand

- **The gear icons** are built: 14 pieces × 11 levels (0–10), 32×32, drawn in code (`tools/art/gear/`, one module per piece, sharing `look(level)` in `gear/common.ts`: steel trimmed in gold with stones in the level's colour, spikes from 7, horns from 8, gilded at 9, crimson and silver at 10). They show on the gear card.
- **Figures** exist only as troops (`tools/art/troops.ts`): 32×32, side on, facing right, one shared foot-soldier body (legs, torso, head, front arm) dressed per type. Too small to wear 14 pieces readably.
- **Which level a hero wears:** `gearTier(heroLevel)` (`shared/core/src/gear.ts`) gives 0 at hero levels 1–9, 1 at 10–19 … 10 at 100, and a hero can't wear more than the player has researched (Hero Enhancement), so the level shown is `min(gearTier(level), gear.level)`.
- **The hero's sex** is stored (`heroes.sex`, [hero-names.md](hero-names.md)) and, since phase 3, sent to the client (`HeroBean.sex`) for the figure; it is never shown as text.
- **The art budget:** before the figure the sprites came to about 113 kB of the 250 kB `game art` limit (`client/web/.size-limit.js`), the gear 42 kB of it; the figure's 94 layers add about 33 kB.

## The key fact: one level for every piece

Gear isn't equipped piece by piece: a hero wears all 14 at the same level (stars differ per piece, but don't change the look). So the figure has only **11 looks per body**, one per level, not 14 × 11 combinations. The art script draws each piece as a layer on the figure but writes them composed into a few layers, which the client stacks, as `GearIcon` stacks a backdrop under a piece.

The layers are split by what moves (Decided, movement), all one size so they stack, back to front:

| Layer | What's in it | Moves | Files |
|---|---|---|---|
| cape | the back piece (bat wings at 10) | stirs (rows below the shoulders sway) | 11, one per level |
| legs | trousers or greaves and boots | no | 22, per level and sex (a woman's cut) |
| skin | the head, neck and hands in a skin tone | breathes (up a pixel) | 8, per sex and tone |
| upper | the far arm, chest (a woman's cut), necklace, belt and charm, pauldrons, shield, near arm with its gauntlet, and the sword | breathes; stones glow at 10 | 22, per level and sex |
| hair | a hairstyle in a colour: over the shoulders, under the helm | breathes | 20, per style and colour |
| helm | the head piece | breathes | 11, one per level |

The bodies share one skeleton (shoulders, hips, hands and head in the same places), so the shared pieces fit both, and only the chest and legs have a woman's cut. Every frame is made in the browser from these still layers (a pixel's lift, a sway of rows, a pulse on the stones), so there are no animation PNGs, as in the town. The art script records where the stones and the cape are (as the town's `spots.json` does), for the glow, the sway, and naming a piece under the pointer.

## Decided

- **2D pixel art, drawn in code** (2026-10-24), like every other sprite. No 3D library: a renderer such as three.js (about 150 kB gzipped) and model files would break the pixel-art look and the game's lightness on slow connections.
- **The figure wears its gear** (2026-10-24), replacing the plain figure with the icons round it that phase 2 first planned. The 14 icons still stand round the figure, since they carry the stars and the star button.
- **At the hero's own level** (2026-10-24, from heroes-page.md): `min(gearTier(level), researched level)`. A hero below level 10 wears level 0, the blue-steel set with a wooden sword.
- **Our own art only** (2026-10-23, heroes-page.md): the original game's art is a reference for style, never traced or converted.
- **Desktops and tablets get a choice; phones the list** (2026-10-24): from `md` up the Heroes tab has a **Sheet · List** switch (Sheet first), remembered in `localStorage` like the town's Scene · Grid; below `md` it always shows today's hero cards, which suit a narrow screen.

- **Three-quarter view** (2026-10-24): turned towards the right of the picture, as the troops face, the sword in the near hand (the hero's right, on the left of the picture), the shield on the far arm.
- **The sword raised point up** (2026-10-24, after the sample): first drawn resting point down by the near leg; raised, leaning out clear of the head, it reads better.
- **The mount only as its icon** (2026-10-24): no horse on the figure.
- **Varied bodies** (2026-10-24): skin tones, hair colours and hairstyles (men with or without a beard, women's hair loose or braided), picked from the hero's id so a hero always looks the same. The skin and the hair are layers of their own, so variety costs a few small files, not more gear.
- **96×96 canvas, the figure about 84 pixels tall** (2026-10-24), shown at whole multiples (2× or 3×). The ring doesn't show on the figure; its icon does.
- **The necklace over the chest piece** (2026-10-24).
- **The charm hangs from the belt** (2026-10-24, while drawing): first planned as earrings at the ear, but every helm from level 1 is closed, so they would never show. At the near hip it shows at every level: a gold tag on a red cord (0), a silver drop (1-2), a stone in the level's colour (3-9), a crimson crystal (10).
- **Women's chest and legs have their own cut** (2026-10-24): a narrower waist and a shaped breastplate, and the legs' own line; every other piece is shared.
- **Movement in this feature** (2026-10-24), not later: an idle breath (the upper body up a pixel and back), the cape stirring, and level 10's stones glowing; still with reduced motion (`useMotion`).

## Open questions

None for now.

## Answered

The first round (2026-10-24), recorded under Decided: three-quarter view, the mount only as its icon, varied bodies, the size, the tiny pieces, women's own cut for the chest and legs, and movement as part of this feature.

## Built

- **The drawing** (`tools/art/figure.ts`, `npm run art:draw -- figure`): one module per piece in `tools/art/figure/` (`chest.ts`, `arms.ts` for the sleeves, gauntlets and pauldrons, `belt.ts` with the charm, `necklace.ts`, `shield.ts`, `sword.ts`, `legs.ts` with the boots, `helm.ts`, `cape.ts`), each following its icon's ladder with `look(level)` from `tools/art/gear/common.ts`. `upper.ts` lays the upper body's pieces back to front. `skeleton.ts` holds the shared skeleton, `part` (a piece outlined on its own canvas, so it keeps its outline over the pieces behind it) and `layer`. `body.ts` draws the skin (a man's or a woman's face) and the hair.
- **The palette** gained the skin tones (`skinPale` … `skinBrown`, each light, mid and shaded), `lips`, the hair colours (`hairBlack` … `hairGrey`) and chain mail (`mail`).
- **The files** (`client/web/src/assets/figure/`, 94 of them, about 33 kB): named by `figureCapeFile`, `figureLegsFile`, `figureSkinFile`, `figureUpperFile`, `figureHairFile` and `figureHelmFile` in `lib/game-art.ts`, with the bodies' choices (`FIGURE_SKIN_TONES`, `FIGURE_HAIR_COLOURS`, `FIGURE_HAIR_STYLES`). Every layer is 96×96 and they stack back to front: cape, legs, skin, upper, hair, helm.
- **Spots** (`spots.json`): every cape has a `sway` spot (the first row that stirs, `n` rows down); level 10's upper bodies mark their stones (`stone`, `n` the radius) for the glow. Stones below 10 aren't kept, since nothing glows there.
- **Not shown on the figure:** the ring (too small) and the mount (its icon only).
- **On the page** (phase 3): `HeroFigure` (`components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/`) stacks the layers on a 96×96 canvas shown at 2× (3× on a wide sheet, a container query), redrawn about 12 times a second (`ANIMATION_FPS`) on the browser's animation frames: the body breathes (the skin, upper body, hair and helm up a pixel for part of each 3.6 s breath, `breathLift`), the cape's rows below its `sway` spot shift a pixel or so in a wave (`swayShift`), and at level 10 a soft light pulses round each stone (`glowAlpha`). With reduced motion (`useMotion`) it is drawn once, still. The frames are pure functions in its `utils.ts` (`drawFigure` takes the canvas calls it needs, so it is tested without a DOM).
- **The body** is picked from the hero's id (`figureBody`: a skin tone, a hairstyle for its sex and a hair colour), so a hero always looks the same; the level is `wornLevel` (its gear tier, no higher than researched). `PaperDoll` stands the 14 pieces round it, each with its stars in use for this hero; a piece opens the Gear tab.

## Phases

1. **A sample for review** (built 2026-10-24): a man and a woman with a few skin tones and hairstyles, wearing the weapon, chest, head and legs at levels 0, 5 and 10, to settle the view, the size and the bodies before drawing the rest.
2. **Every piece at every level** (built 2026-10-24): every layer written, a test that all files are there (`lib/game-art.test.ts`), and the spots for the movement.
3. **On the page** (built 2026-10-24): with heroes-page.md phase 2: hero `sex` in the API, the roster and the sheet, the figure with the icons round it, the Sheet · List switch, and the movement.
4. **Maybe later:** a piece lit on the figure when its icon is hovered (the art script would record each piece's pixels); bodies chosen by the state a hero comes from.
