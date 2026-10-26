# Gear animations

**Status:** built 2026-10-26, phases 1 to 4 (the idle ladder everywhere `GearIcon` shows, checked beside the figure, the bursts, and the pieces' own movement). TODO.md, Done: *Animated hero gear*. It builds on the gear icons ([hero-gear-art.md](hero-gear-art.md)) and the town's way of placing movement from the art scripts' spots ([town-animations.md](town-animations.md)).

**The aim:** the hero gear icons come alive by level, as the art grows richer by level: low levels stay still, the stones start to glint as the gear climbs, glowing edges and runes pulse, and level 10's backdrop twinkles. Adding a star or a gear level gives a short burst. Quiet enough that a page of 14 icons stays calm and readable.

## Before this feature

- **The icons were still:** `GearIcon` (`components/hero-gear/gear-icon/`) stacks two PNGs, the level's backdrop and the piece, 32×32 shown at 64 px on the gear card (`gear-card/`, the Heroes page's Gear tab) and at 32 px round the figure on the character sheet (`paper-doll/`). They are drawn by `tools/art/gear.ts` and `tools/art/gear/` (`npm run art:draw -- gear`).
- **Level 10 already "sparkles", but only in paint:** the level 10 backdrop has five white four-point stars drawn in, and the gems, the charm, the helm's slit and the mount's eyes use the palette's bright `sparkle` colour. Every gem (`gem()`, `tools/art/gear/common.ts`) has a white glint pixel at its top left at every level. Nothing moved.
- **What already moved:**
  - The hero figure, 2D and 3D: its level 10 stones pulse (`GLOW_MS` 2 s, `GLOW_RGB`, `glowAlpha` in `paper-doll/hero-figure/`).
  - The town: a sparkle over a building that has just finished a level (`sparkleFrame`, `sparkleOverlays` in `components/iso-anim/utils.ts`), placed from the art scripts' spots (`Spot`, `tools/art/pixel.ts`, written to `src/assets/spots.json`) and loaded after the first page (`useAnimations`).
- **One level for all 14:** the gear card shows every piece at the player's gear level, so at level 10 all 14 icons are level 10 at once. Round the figure the icons show the level the selected hero wears (`wornLevel`).
- **Size:** `GearIcon` is only on lazy screens (the Heroes page), so the first page's budget (the `app` chunk, at 114.9 of 115 kB) wasn't touched.

## Decided

All 2026-10-26.

- **Effects grow by level,** as the art does. A first ladder, to tune in phase 1:

  | Levels | What moves |
  |---|---|
  | 0–2 | nothing: wood, leather and plain steel |
  | 3–5 | the stones glint now and then: the gem's glint pixel flares into a small white star for a few frames |
  | 6–8 | as 3–5, and what is drawn glowing pulses softly (the weapon's glowing edges and fullers, the runes) |
  | 9 | as 6–8, and a glint runs across the gilded metal now and then |
  | 10 | the stones pulse in the figure's level 10 glow (its colour and period, so the figure and its icons agree), the backdrop's five stars twinkle, a glint runs across the crimson and silver now and then, and the mount's eyes glow |

  At first not a movement per piece (wings flapping, the cape stirring, the mount breathing), which seemed to mean drawing every piece again in parts; taken up in phase 4 by moving the sprites' own pixels instead (*The pieces' own movement*, below).
- **Always moving, staggered:** the icons move all the time, not only on hover, so phones see it too. Each piece's effects start at its own moment (the pieces spread evenly through each cycle in the grid's order, `piecePhase`), so 14 level 10 icons never flash in step.
- **Subtle, like the town:** redrawn about 12 times a second (`ANIMATION_FPS`), glints every few seconds rather than constantly, a slow pulse. The numbers live with the animation's constants (cosmetic, so not in `BALANCE`).
- **Everywhere `GearIcon` shows:** the gear card's 64 px icons and the 32 px icons round the figure, so the figure and its icons agree. The animation is in `GearIcon` itself, not in each screen.
- **Bursts on events:**
  - **A star added:** when Add star succeeds, that piece's icon flashes and sparkles once (about a second), wherever it is shown, and its new star twinkles.
  - **The gear level rises** (Hero Enhancement research finishes): all 14 pieces on the gear card burst once, one after another across the grid.
  - **Missed while away:** the gear card remembers the last gear level it showed (`localStorage`, per player), and bursts once when it next opens on a higher one. The first visit (nothing remembered) only remembers. Without storage, it bursts only while watching.
  - Bursts are announced to the icons through a small event list, as a finished building level is (`lib/build-events.ts`): `startBurst`, `components/hero-gear/utils.ts`.
  - **Reduced motion:** no bursts on the icons, and the new star doesn't twinkle.
- **Spots and frames in code,** as the town does it: no animation PNGs.
  - The gear's art scripts record where the effects go as spots: each stone's glint (`gem`), level 10's points of light (`shine`: the mount's eye, the helm's slit, the charm, the ring, the necklace), a glowing blade (`blade`) and the backdrop's stars (`star`). `npm run art:draw -- gear` writes them to `spots.json` with the town's, keyed `gear/<file>`, so redrawing a piece moves its effects with it.
  - Frames (a glint, a glow, a blade's pulse, a sweep, a star's flare) are pixels made by pure functions in the sprites' palette, tested, drawn in three layers: behind the piece (the stars, cut away where the piece stands), on it (the sweep and the blade, kept to its own pixels) and over both (the stones).
  - `GearIcon` lays a 32×32 canvas over its two images, scaled crisp like them, and draws the frames on it. The images stay as they are, so the still icon is unchanged.
- **With the icon, not the town's animation code** (changed in phase 1, 2026-10-26; first planned beside the town's frames in `components/iso-anim/`): the icons show only on the Heroes page, which already loads in the background after the first page, so the movement lives with them (`components/hero-gear/gear-icon/`), as the hero figure's own does, and doesn't wait for a second download. With reduced motion the icons are still and there are no bursts.
- **One clock for every icon:** all the icons on the page are redrawn together on one animation-frame loop, not one per icon, and it runs only while an icon with something to move is shown: an effect (from level 3), a movement of its own (phase 4, any level) or a burst (any level, for its second). It stops in a hidden tab, as the town's does.
- **Decorative:** the canvas is `aria-hidden`; what the icon means is already in its label and tooltip.
- **The pieces' own movement** (decided 2026-10-26, phase 4; first left out, then taken up from the backlog): five pieces move by themselves now and then, at every level, gently, each at its own moment, as well as the level's effects:

  | Piece | Movement | Pivot (a spot) |
  |---|---|---|
  | Back (levels 0–9) | the cape stirs: rows below the collar shift across, more towards the hem, in a wave | `stir`, the collar |
  | Back (level 10) | the bat wings flap once: columns lift, more towards the tips | `flap`, the wings' root |
  | Mount | the head nods: the columns towards the muzzle lift a pixel | `nod`, the neck |
  | Head (from 4) | the plume sways: its rows shift across, more towards the tip | `sway`, the plume's base |
  | Necklace, charm | they swing: the chain or hooks hold and the pendants swing a pixel, each as one piece | `swing`, where the pendant hangs |

  - **Moved in pixels, not drawn again:** a piece that moves whole (the back, the mount, the necklace, the charm) is its own sprite shifted row by row or column by column from its pivot, as the 2D figure's cape sways (`swayShift`). The plume moves alone, so the helm from 4 gets twins as the town's windmills do: `head-N-bare.png` (without the plume) and `head-N-plume.png` (the plume alone), drawn by the same script.
  - **The canvas then draws the piece:** while a piece can move, the icon's canvas draws it (moved or at rest) and the still image is hidden, so the two never show at once; with reduced motion, or until the images load, the still image shows as before.
  - **Now and then, staggered:** a movement once every few seconds, each piece at its own moment, half a cycle from its glints.
  - **A pendant swings whole** (changed in review): first sheared like the cape, which broke a rigid tag or drop into a step partway down; now everything below where it hangs moves together and the chain or hook takes up the step.
  - **Rejected:** the mount's nostril flaring (one pixel, unreadable at 32 px).
- **The level burst steps a frame at a time** (2026-10-26): first 70 ms apart, which the icons' 12 frames a second (83 ms) rounded, so some pieces started together; now one frame of their clock apart (`LEVEL_BURST_STAGGER_MS` = `FRAME_MS`).

## Open questions

None. The timings are tunable in `components/hero-gear/gear-icon/constants.ts` (the maintainer reviewed the idle ladder on 2026-10-26 and kept it).

## Built

- **Phase 1, the idle ladder** (2026-10-26):
  - **Spots** (`tools/art/gear/common.ts`: `gem` and `shine`; `weapon.ts`: its pommel and guard stones and the `blade` at levels 6–8, marked `glows`; `gear.ts`: the backdrop's `star`s). A glint drawn over or turned to outline once the piece is finished is dropped (`showing` in `gear.ts`), and the figure's layers drop the `gem` spots they pick up from the shared stones (`tools/art/figure.ts`). The sprites themselves are unchanged.
  - **The frames** (`gearFrame` in `components/hero-gear/gear-icon/utils.ts`): from 3 each stone flares into a small white star for four frames once in 6 s; from 6 it glows in the level's bright colour, pulsing over 2.6 s, and a glowing blade (6–8) pulses in it on the blade; from 9 a glint crosses the piece from hilt to tip once in 7 s, taking 0.9 s; at 10 the stones glow in the figure's light and time (`glowAlpha`, `GLOW_RGB`) and the backdrop's five stars flare in turn, once in 3.4 s each. The 14 pieces are spread evenly through each cycle (`piecePhase`), each stone and star a little apart.
  - **The clock** (`useGearMotion`, `hooks.ts`): one animation-frame loop for every moving icon on the page, redrawing them together about 12 times a second, running only while one is shown; an icon joins it only with motion allowed, from level 3 and with something to light (`hasMotion`), once its piece's image has loaded.
  - **Measured** in the browser (all 154 icons on one page): nothing moves below 3; at 3–5, 10 of the 14 pieces move (the 4 without stones are still), each lit about 5% of the time; at 6–8 about 70% (the glow); at 9 all 14, 74%; at 10, 93%. A redraw of the 106 moving icons took about 3 ms (M5 Pro, Chrome), so the gear card's 14 about 0.4 ms. The code is in the Heroes page's file (about 1 kB gzipped); the first page didn't change.
  - **Seen:** the glow at 6–9 is quiet, since it is the backdrop's own colour: it shows as light on the metal round each stone and a tint on a glowing blade. Level 10's stars and glints read clearly.
- **Phase 2, round the figure** (2026-10-26): the 32 px icons on the character sheet needed no change. Checked on a page laying the 14 icons beside the figure at level 10, in 2D and 3D: the glints and stars read at that size, and the icons' glow follows the figure's (`glowAlpha` on the same animation-frame clock; sampled round the mount's eye, it tracked the curve with a correlation of 0.81, the rest rounding and glints).
- **Phase 3, the bursts** (2026-10-26):
  - **The burst** (`burstPixels`, `gearFrame`'s `burst`): the piece flashes white over its first four frames (fading from 170 to 25), and 12 sparks fly out from its middle and fade over 12 frames (a second), in white and the level's light (gold below level 3), every third a small star while young; their angles turned by the piece's phase. It plays at any level, so an icon below 3 joins the clock just for a burst and leaves it after.
  - **Started by** `startBurst(piece, at)` (`components/hero-gear/utils.ts`, kept in memory, on the page's clock); each `GearIcon` showing the piece hears it (`onBurst`) and plays it from `at`, so a burst can wait its turn.
  - **A star added** (`GearCard`): on success the piece bursts and the new star twinkles once (`Stars`' `fresh`, a CSS animation in `index.css`, `animate-gear-star`, `motion-safe` only; its key replays it for the next star).
  - **A level gained** (`GearCard`): the card remembers the last level it showed each player in `localStorage` (`marchlands-gear-level`, a map by player id: `rememberedGearLevel`, `rememberGearLevel`, `gear-card/utils.ts`) and in memory while it's open; a higher level bursts the 14 pieces one after another, 70 ms apart at first (`LEVEL_BURST_STAGGER_MS`; one frame since, below). Nothing remembered (a first visit, or storage off) only remembers.
  - **Seen** in the browser on a page with buttons for both: the star burst at level 1 (the flash, gold sparks, the 4th star flaring) and the level burst on every piece at level 10. The 70 ms stagger couldn't be timed then: the test window was out of view, so its frames and timers were throttled (timed later, below). That a burst waits its turn is covered by the tests.
  - **Size:** the twinkle's keyframes are about 0.1 kB in the app's stylesheet (Tailwind's one file); the rest is in the Heroes page's file.
- **Phase 4, the pieces' own movement** (2026-10-26):
  - **The art** (`tools/art/gear/`): the pivots as spots (`stir` and `flap` in `back.ts`, `nod` in `mount.ts`, `sway` in `head.ts`, `swing` in `necklace.ts` and `charm.ts`); `head(level, part)` draws the helm whole, `bare` or as the `plume`, and `npm run art:draw -- gear` writes the twins (`gearTwinFile`, `head-4-bare.png` … `head-10-plume.png`, about 2.3 kB) for every helm with a `sway` spot, without spots of their own. The still sprites didn't change. `lib/game-art.test.ts` checks the twins are there.
  - **The moves** (`components/hero-gear/gear-icon/utils.ts`): `pieceMove` finds a sprite's pivot, `moveShare` says how far through a movement it is (1.5 s once in 5.5 s, half a cycle from its glints), `moveOffset` how far each row or column shifts (`MOVE_PX`: a hem or plume tip up to 2 pixels, a wing tip 2, the muzzle and a pendant 1), `movePixels` and `movedPiece` move a sprite's pixels and lay the plume over its bare twin.
  - **The canvas draws a moving piece** (`useGearMotion`): from the sprite's pixels (read once), moved or at rest, under the level's effects; once it has drawn it, the still image is hidden, and shown again when the icon goes. These five pieces join the clock at every level.
  - **Seen** in the browser (levels 0, 4, 6, 8 and 10): the moving pieces hide their still image and show 8 to 14 different pictures over 6 s at level 0 (one movement each), the others are untouched; the capes stir, the plumes sway, the wings lift, the heads nod and the pendants swing whole.
- **The level burst's stagger, timed** (2026-10-26, with the window in view): the 14 pieces start in the grid's order and each burst lasts about a second; at 70 ms apart some started in the same frame, so it is now one frame of the icons' clock (`FRAME_MS`, about 83 ms), each starting 83 to 101 ms after the last (the 12 fps clock beating against the screen's 60), all clear by about 2 s.

## Phases

1. **The idle ladder on the gear card:** the spots in the gear's art scripts, the frames and their tests, the canvas in `GearIcon` and the shared clock; reviewed in the browser at every gear level, then the ladder and timings set. Checks: the frames are palette colours only, the stagger, still with reduced motion, nothing drawn below level 3, the Heroes page chunk and the animation chunk measured before and after.
2. **Round the figure:** the 32 px icons on the character sheet, checked beside the figure's own glow at level 10 in 2D and 3D.
3. **The bursts:** the star burst on Add star, the level burst on the gear card with the remembered level, and their tests.
4. **The pieces' own movement:** the pivots as spots and the plume's twins in the art scripts, the moves as pure functions on the sprite's pixels with tests, the canvas drawing a moving piece in place of its image; reviewed at every level.
