# 3D hero

**Status:** built 2026-10-24, phases 1 to 4 (the spike, every piece at every level, on the sheet with the switch, the movement). TODO.md, Done: *A 3D hero on the character sheet*. What's left is in [backlog.md](../backlog.md): the frame time on a tablet (and reduced motion on a device), the braid and the swing to tune, and phase 5's ideas. It builds on the 2D figure ([hero-figure-art.md](hero-figure-art.md)), which stays as the fallback, on the Heroes page's character sheet ([heroes-page.md](heroes-page.md)).

**The aim:** the selected hero on the character sheet as a low-poly 3D figure wearing its 14 gear pieces at the level it can use, a man or a woman as the hero is, rendered small and scaled up without smoothing so it reads as pixel art like the rest of the game. The player drags it to turn it round and taps it for a short action.

## Where things stand

- **The 2D figure** is built: 94 layers drawn in code (`tools/art/figure/`), stacked on a 96×96 canvas shown at 2× or 3× (`HeroFigure`, `components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/`). It breathes, its cape stirs and level 10's stones glow, redrawn about 12 times a second (`ANIMATION_FPS`), and it is drawn still with reduced motion.
- **What it shows is already worked out:** the body from the hero's id (`figureBody`: a skin tone, a hairstyle for its sex, a hair colour) and the level it wears (`wornLevel`: its gear tier, no higher than researched). Every piece is worn at one level, so there are 11 looks per body. The ring isn't shown (too small) and the mount only as its icon.
- **Where it shows:** the sheet exists from `md` up (Sheet · List); phones always get the List. So the 3D hero is for tablets and desktops.
- **The 3D figure is on the sheet** (phases 1 to 3, Built below): every piece at every level for both bodies, drawn in 3D by default with a 2D · 3D switch under it. It breathes, its cape stirs, and a tap plays an action (phase 4). The figure's design decided against a 3D library on 2026-10-24, for three.js's size (about 150 kB gzipped) and the look; that decision is changed here (Decided).
- **Size:** the first page has its budget (`client/web/.size-limit.js`), and heavy libraries load with the screen that uses them, each lazy screen with its own entry (the Market page's charts: *market tab*, 70 kB).

## Decided

All 2026-10-24.

- **three.js, despite the earlier decision against a 3D library.** The 2D layers can't turn, light or act, and the two costs that decision named are met: three.js loads only with the 3D figure, never the first page (AGENTS.md, Client, rule 7), and the pixelated rendering below keeps the look.
  - Plain three.js driven inside one component, as the charts and the isometric viewport drive their canvases; no React Three Fiber, which would add a renderer layer that one figure doesn't need.
  - Pinned to an exact version at least two weeks old, with `@types/three` (AGENTS.md, Ground rules): three 0.186.1 (released 2026-09-24) and `@types/three` 0.186.0 (2026-09-11).
- **Low-poly, built in code:** the body and the 14 pieces made from simple shapes by our own code, as the 2D art is drawn in code. No modelling tool, original art, the same result every run, and the sprites' palette.
- **One mesh per piece, its look by level:** each piece is one mesh whose colours follow the icons' ladder (`look(level)` in `tools/art/gear/common.ts`: steel trimmed in gold with stones in the level's colour), with parts switched on as it climbs (spikes from 7, horns from 8, gilded at 9, crimson and silver with bat wings at 10). Not a model per piece per level (14 × 11 × 2).
- **Two bodies on one skeleton,** a man and a woman, with a woman's own cut for the chest and legs, as in 2D. The body is `figureBody`'s choice, so a hero looks the same in 2D and 3D. The ring isn't shown and the mount only as its icon, as in 2D.
- **Rendered at 128×128,** then scaled up by whole multiples without smoothing (nearest-neighbour). A third finer than the 2D figure's 96×96, so the small pieces (the charm, the necklace) still read as it turns. Shown at 2× (256 px), near the 2D figure's 288 px at 3×; the sheet keeps one size for both so switching doesn't move the layout.
- **Toon shading with outlines:** two or three flat bands of light from the top left, in the palette's shades, and a one-pixel dark outline, so it reads like the sprites from every angle.
- **Drag to turn:** round the upright axis only; let go and it eases back to the three-quarter view (facing the right of the picture, as the 2D figure and the troops do). No zoom or tilt, so it can't be lost or seen from odd angles. A press that hardly moves is a tap. Focused, the arrow keys turn it, so the keyboard reaches it too.
- **Movement:** the idle of the 2D figure (a breath, the cape stirring, level 10's stones glowing) plus a short action when tapped (below, the actions).
- **3D by default, with a 2D · 3D switch** on the sheet, remembered in `localStorage` (in try/catch, working without it). The 2D figure shows while the 3D loads, where WebGL is missing or its context is lost, and when the player picks 2D.
- **Reduced motion gets the 3D, still:** the rest pose with no idle or actions. Dragging still turns it, since the player moves it, and it stays where it was let go (nothing moves by itself) until another hero is picked.
- **The meshes are built in the browser,** by code in the 3D figure's own chunk when it loads: no model files and no glTF loader to ship, and changing a piece is changing code. Not an art script writing `.glb` files.
- **The outline is an edge pass over the 128×128 render:** exactly one pixel wide at any angle, inner edges (an arm over the chest) included. Planned from depth and normals; the spike found depth enough (the silhouette from the render's clear pixels, inner edges where a neighbour is nearer), since the sprites outline shapes, not the creases inside them. Not the inverted hull, whose width varies once scaled.
- **It turns freely and settles clean:** smooth under the finger, with some shimmer while it moves, and every rest pose a clean picture. Not snapped to 16 directions, which looks steppy.
- **Three actions, one per tap in turn:** a sword swing, a salute and the shield raised, so a player sees all three by tapping.
- **About 12 frames a second at rest, the screen's rate while moving:** the idle at `ANIMATION_FPS`, as the town and the 2D figure, which suits pixel art and spares tablets' batteries; the screen's rate while it is dragged or acts, so turning feels smooth.
- **The size budget is measured, then set:** the spike measures the 3D chunk (three.js's share is estimated at about 150 kB gzipped), which then gets its own size-limit entry (*hero 3d*) at that size plus 10-15%, as the others were set. It never counts towards the first page.

## Open questions

None for now.

## Answered

The second round (2026-10-24), recorded under Decided: where the meshes are built, the outline, turning, the actions, reduced motion on letting go, the frame rate and the size budget.

## Built

- **Phase 1, the spike** (2026-10-24): `HeroFigure3d` (`components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/`), loaded with `lazyComponent` (`paper-doll/constants.ts`) as a file of its own, `hero-figure-3d-*.js`.
  - **Shown only when asked for:** the sheet shows it in place of the 2D figure when `localStorage` holds `marchlands-hero-figure` = `3d` (`FIGURE_KEY`), with the 2D figure while it loads and where WebGL 2 is missing or its context is lost. A tap steps through levels 0, 5 and 10 for review and back to the hero's own (`nextReviewLevel`, until the actions). Phase 3 replaces this with the switch.
  - **The model** (`buildFigure` in `utils.ts`): a man in rigid low-poly parts (boxes, tapered cylinders, low spheres and cones, each a mesh named after its piece): legs with greaves, knee guards and boots, the plates below the belt, breastplate, belt, collar, a stone from 3, the head, a helm (an open cap over the hair at 0, closed with a visor above it, a crest from 3, horns from 8), pauldrons spiked from 7, the sword raised in the near hand, the shield on the far arm and the cape. Its look per level is `figureLook`, the 2D figure's ladder; the colours it uses are copied from the palette into `constants.ts` (`SHADES`, `GEAR_TIERS`), as the town's animations copy theirs.
  - **The render** (`useHeroFigure3d` in `hooks.ts`): an orthographic camera a little above the figure, toon shading in a material of our own (`toonMaterial`: the lit, mid or shaded colour by the angle to a light fixed to the view, top left), drawn into a 128×128 target with a depth texture; the outline pass draws it onto the canvas, which CSS shows at 2× (`size-64`). The output is the palette's numbers as they are (no colour management), so the render holds only palette colours and the outline: checked by reading its pixels.
  - **Turning:** a drag turns it round the upright axis (`turnBy`, a full turn for 400 CSS pixels; `touch-pan-y`, so a finger moving up or down still scrolls the page), and let go it eases back (`settle`, half the way every 90 ms) unless motion is reduced. It draws only when something changes: no frames at rest yet.
  - **Measured** (2026-10-24): the chunk is 135 kB gzipped (535 kB raw), about the 150 kB estimated, and the Heroes page's own chunk didn't grow; the first page is unchanged. A frame takes about 0.5 ms to draw (1.8 ms at most) on an M5 Pro in Chrome. **Still to measure on a tablet.**
  - **Seen in the spike:** the look holds up at 128×128: crisp pixels, a clean outline, and inner edges (the sword over the body) read. Level 10 is too much one red (the thighs are crimson metal too), and the sword hand hides behind the blade: both for phase 2.
  - **Found:** rigid parts are enough. Movement (phase 4) can turn and lift groups of parts at the joints, so the figure needs no skinning, which keeps the toon material simple.
- **Phase 2, every piece at every level** (2026-10-24): `buildFigure(body, level)` now dresses the hero (`figureBody`'s sex, skin tone, hairstyle and hair colour) in all 12 pieces the 2D figure shows, each following its ladder level by level (tools/art/figure/, gathered piece by piece):
  - **Helm:** a blue cap rimmed in gold over the face at 0 (eyes, nose, a man's brow and beard, a woman's lips, the hair at the back); closed from 1 with an eye slit (a T slit from 2, glowing at 10) and breathing holes at 1-2; a trim band and crest from 3, a plume from 4 (drooping with horns), wing spikes at 6-7, horns from 8.
  - **Chest:** blue banded in gold (0), plain steel (1-2), the level's metal rimmed in its trim (3+); a ridge from 1, a stone from 3, a raised collar from 6; a woman's narrower waist and bust.
  - **Shoulders, arms and hands:** pauldrons edged by level, with cloth hanging at 0 and from 5, a ridge at 2, a stone on the near one from 3, spikes from 6 and a horn from 8; sleeves of cloth (0-2) or mail; bracers blue, steel, dark steel then the metal, with a cuff, an elbow stone, spike and horn as the level climbs; the fist bare at 0 and 2.
  - **Sword and shield:** the blade wood, steel, bright steel at 9 and crimson at 10, wider and longer as it climbs, with a fuller from 1 (glowing from 6), runes from 5 and a silver edge at 10; its guard turns up from 3 and grows horns from 8, a stone in the pommel from 3. The shield round wood rimmed in iron at 0, a kite from 1, rimmed from 2, a boss stone from 3, a cross from 5, corner spikes from 7.
  - **Belt, charm and necklace:** the band by level with studs (2-8) and a buckle; the charm at the near hip (a gold tag, a wool disc, a steel disc, a stone, a crimson crystal at 10); the necklace's red cord and amber, plain silver, a small disc, a stone, a silver heart round a crimson one at 10.
  - **Legs and boots:** the leg cloth from hip to ankle (white, rose, grey, the level's colour, crimson at 10), lacing at 2, knee guards from 3, thigh plates from 6 (steel at 10), knee spikes from 7; boots blue with white feet at 0, steel at 1-2, the metal with a cuff and an ankle stone from 3.
  - **The back:** the cape hung from a rod (0) or a collar, in blue, banner red, grey or the level's colour, striped at 0, edged from 5, torn from 8; crimson bat wings in its place at 10.
  - **Bodies:** the four skin tones and five hair colours; a man's short hair or beard (seen at 0); a woman's loose hair or braid, below the helm at every level, a narrower neck, waist, belt and legs, wider hips and a smaller head (`BUILDS`).
  - **Tests** (`utils.test.ts`): every piece builds at every level for every body, every vertex in place; the figure stays inside the picture turned any way; and each ladder's steps come in at their level.
  - **Size:** the chunk is now 148 kB gzipped (575 kB raw), up 13 kB for the shapes the kite shield, cape, wings and necklace take (extruded outlines, a torus); the first page and the Heroes page's chunk are unchanged. The frame time wasn't measured again.
  - **Seen:** the levels read as the 2D ladder does, and level 10 is broken up by its steel trim, thigh plates and mail. A woman's braid shows down the side of the neck but is mostly hidden by the near pauldron at rest; worth a look in review. For review, a tap now steps through every level from 0 to 10.

- **Phase 3, on the sheet** (2026-10-24):
  - **The switch:** 2D · 3D under the figure (`PaperDoll`, `FIGURE_MODES`), 3D by default, the choice remembered in `localStorage` (`marchlands-hero-figure`, `figureMode` and `saveFigureMode` in `paper-doll/utils.ts`, in try/catch). Where WebGL 2 doesn't work (`webglWorks`) the switch isn't shown and the figure is 2D. With 2D chosen the 3D code isn't fetched at all.
  - **One size for both:** the figure stands in a box of `size-64` (`size-72` on a wide sheet), the 2D figure at 2× (3×) and the 3D at 2× in it, so switching doesn't move the sheet.
  - **The fallbacks:** the 2D figure in place of the 3D one if WebGL fails after all or its context is lost (checked by losing it on purpose). Picking 3D again draws it afresh.
  - **While the 3D code loads,** a spinner stands in the figure's box (`Suspense`, still with reduced motion, announced as *Drawing the hero…*); at first the 2D figure stood in, which flickered to 3D on every page load (changed 2026-10-24). With 2D chosen there is no spinner: the 2D figure shows at once and the 3D code isn't fetched.
  - **The keyboard:** the figure's frame takes focus (`role="application"`, as the map's viewport does, labelled with how to turn it); the arrow keys turn it a sixteenth of a turn (`KEY_TURN`) and it stays turned while focused, easing back once focus leaves; Home turns it back; Enter or Space do what a tap does. The pointer is taken on the frame too.
  - **Another hero** turns it back to rest and shows that hero's own level (`resetKey`; the review level is kept per hero).
  - **Reduced motion:** let go, it stays where it was turned (no easing), until another hero is picked. Not checked in the browser (the test browser can't ask for reduced motion); it follows `useMotion` as the 2D figure does.
  - **Size budget:** a *hero 3d* entry in `client/web/.size-limit.js`, 165 kB for the chunk's 147 kB (the others' 10-15% over). The first page grew only by the new English text (the app chunk is 114.9 of its 115 kB).
  - Until the actions (phase 4), a tap or Enter still steps through the levels for review.

- **Phase 4, the movement** (2026-10-24):
  - **Joints:** `buildFigure` returns a `FigureModel`: the root (turned), the upper body (`upper`: everything above the hips, the belt and the arms with it), the sword arm and the shield arm (each a joint turning about its shoulder), what hangs at the back (the cape, or each bat wing) and the materials that glow. Rigid parts, no skinning, as phase 1 found.
  - **The idle** (`poseFigure`), in time with the 2D figure (its `breathLift`, `SWAY_MS` and `glowAlpha`): the upper body up a pixel for part of each 3.6 s breath, the cape swinging a little about its top (the wings flapping at 10), and level 10's stones pulsing towards the 2D figure's glow colour (`GLOW_STRENGTH`, a `glow` uniform in the toon material).
  - **The actions** on a tap, Enter or Space, one in turn (`FIGURE_ACTIONS`): a swing (drawn back, then struck down in front), a salute (the hilt brought up across the chest, held, lowered) and the shield raised in front (held, lowered), each 800 ms (`ACTION_MS`), eased between keyframes of the arms' angles (`ACTION_KEYS`, `actionAngles`). A tap during an action is ignored; another hero stops it. They replace the review tap of phases 1 to 3.
  - **Frames:** the idle redraws about 12 times a second (`ANIMATION_FPS`; measured 11.5), an action, a drag or the easing back at the screen's rate (measured 120 on a 120 Hz screen); 67 draw calls a frame. With reduced motion it stands in its rest pose and draws only when turned; motion allowed again starts the idle.
  - **Tests:** the keyframes and the easing between them, the pose (the breath as the 2D figure's, the cape and wings, the glow at 10 only, the arms, still without time), and the figure inside the picture at every keyframe of every action, turned any way.
  - **Seen:** the shield lifts out in front, the salute brings the sword across the chest, and the swing strikes forward and down, which the three-quarter view foreshortens; tuning the keyframes is a matter of numbers in `ACTION_KEYS`.
  - **Size:** the chunk is 148 kB of its 165 kB.

## Phases

1. **A spike** (built 2026-10-24, the tablet still to measure): three.js in a chunk of its own, one body in a few pieces at levels 0, 5 and 10, rendered at 128×128 with toon shading and outlines, dragged to turn. Measure the chunk (for its size-limit entry) and the frame time on a tablet, and check the edge-pass outline and the turning look as decided.
2. **Every piece at every level** (built 2026-10-24), both bodies, the skin tones, hairstyles and colours of `figureBody`; a test that every piece builds at every level for both bodies.
3. **On the sheet** (built 2026-10-24): the 2D · 3D switch, the fallbacks (loading, no WebGL, a lost context), reduced motion, the keyboard, and the size-limit entry.
4. **Movement** (built 2026-10-24): the idle (breath, cape, glow) and the actions on a tap.
5. **Maybe later** (moved to [backlog.md](../backlog.md), *More for the 3D hero*, 2026-10-24): a piece lit on the figure when its icon is hovered; the 3D hero elsewhere (the Inn, the famous heroes).
