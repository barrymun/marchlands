# Feature designs

Design documents for large planned features, kept while they are worked out and built. Each one says where things stand now, what has been decided and why, what is still open, and the phases it will be built in.

- The feature's item in [TODO.md](../../TODO.md) links to its document; the document holds the detail.
- Decisions go in as they are made, with the reason. Open questions stay listed until they are answered.
- As each phase ships, mark it done in the document. Rule changes it makes go in [deviations.md](../deviations.md) as usual, and tunable numbers in `BALANCE`.
- Once the whole feature has shipped, the document stays as the record of why it works the way it does.

| Document | Feature | Status |
|---|---|---|
| [gear-animations.md](gear-animations.md) | Hero gear icons that move by level (glinting stones, pulsing glows, level 10's twinkling backdrop), five pieces that move by themselves (a cape, wings, a nodding mount, a plume, swinging pendants), and bursts when a star or a level is added | Built |
| [item-art.md](item-art.md) | Item icons: one pixel-art icon per item, its steps showing as more or finer, shown wherever items are listed | Built |
| [heroes-page.md](heroes-page.md) | Heroes as a page of their own: a roster beside a character sheet with a pixel-art figure wearing its gear, the Inn beside the heroes, the gear a tab | Phases 1–2 built (the page, the roster and character sheet); famous heroes next |
| [hero-3d.md](hero-3d.md) | The hero on the character sheet as a low-poly 3D figure in three.js, rendered pixelated, turned by dragging, with the 2D figure as its fallback | Built (a tablet's frame time and ideas left in the backlog) |
| [hero-figure-art.md](hero-figure-art.md) | The hero on the Heroes page drawn wearing its 14 gear pieces at its level, a man or a woman, in pixel art | Built |
| [hero-gear-art.md](hero-gear-art.md) | Hero gear icons: 14 pieces at every level 0–10, a colour per level, pixel-art stars | Built |
| [hero-names.md](hero-names.md) | Hero names by the state the city stands in, with a place or a father's name, travellers from other states, and a gender for every hero | Phase 1 built |
| [camp-times.md](camp-times.md) | Armies that land at a chosen second, in the order sent, on a clock players can trust; later a planner for several waves and alliances | Design only |
| [historical-cities.md](historical-cities.md) | Historical cities at levels 12–18 as seats of power over areas of the map: their garrisons and how they're broken, capture, the daily draft, tribute, titles, borders between factions | Design only; spikes started 2026-11-01: jump to coordinates built; art, simulations and camp times next |
| [market-and-factions.md](market-and-factions.md) | Market overhaul: NPC cities trading, factions and standing with them, events, trading scripts, new charts (seats of power moved to historical-cities.md) | Phases 1–4 built (charts and the merchant, the faction data, NPC trade, reputation); relations between factions or seats of power next |
| [town-animations.md](town-animations.md) | Animated town, fields and map: smoke, sails and wheels, walkers, construction, buildings showing what they're doing, day and night, weather, marching armies | Built |
| [unchecked-index-access.md](unchecked-index-access.md) | `noUncheckedIndexedAccess`: lookups that can miss typed as such, in chunks (core, backend, client, tests), then `no-unnecessary-condition` | Built |
