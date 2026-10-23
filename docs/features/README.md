# Feature designs

Design documents for large planned features, kept while they are worked out and built. Each one says where things stand now, what has been decided and why, what is still open, and the phases it will be built in.

- The feature's item in [TODO.md](../../TODO.md) links to its document; the document holds the detail.
- Decisions go in as they are made, with the reason. Open questions stay listed until they are answered.
- As each phase ships, mark it done in the document. Rule changes it makes go in [deviations.md](../deviations.md) as usual, and tunable numbers in `BALANCE`.
- Once the whole feature has shipped, the document stays as the record of why it works the way it does.

| Document | Feature | Status |
|---|---|---|
| [hero-names.md](hero-names.md) | Hero names by the state the city stands in, with a place or a father's name, travellers from other states, and a gender for every hero | Phase 1 built |
| [market-and-factions.md](market-and-factions.md) | Market overhaul: NPC cities trading, factions, historical cities as seats of power, events, trading scripts, new charts | Phases 1–3 built (charts and the merchant, the faction data, NPC trade); reputation next |
| [town-animations.md](town-animations.md) | Animated town, fields and map: smoke, sails and wheels, walkers, construction, buildings showing what they're doing, day and night, weather, marching armies | Built |
| [unchecked-index-access.md](unchecked-index-access.md) | `noUncheckedIndexedAccess`: lookups that can miss typed as such, in chunks (core, backend, client, tests), then `no-unnecessary-condition` | Built |
