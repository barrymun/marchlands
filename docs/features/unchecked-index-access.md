# Checked lookups: `noUncheckedIndexedAccess`

**Status:** built (2026-10-22), every phase below: the flag is on in both tsconfigs, `!` is banned in source code, and `no-unnecessary-condition` is on. TODO.md, Done: *Lookups that can miss are typed as such*, *No `!` in source code* and *`no-unnecessary-condition` on* (all 2026-10-22).

**The aim:** a lookup that can miss is typed as one that can miss. Today `BALANCE.fortSpace[id]`, `rows[0]`, `troops[i]` and `m[1]` are typed as always there, so a missing entry only shows up at run time, as `undefined` flowing into the game's maths or a `TypeError`. With TypeScript's `noUncheckedIndexedAccess`, reading through an index (an array position, a record by key) gives `T | undefined`, and the code has to say what happens when it misses.

**No behaviour changes.** Every fix keeps what the code does today; a place where the flag finds a real bug is fixed in a change of its own (AGENTS.md, Ground rules).

## Where things stand

Measured 2026-10-21 with `tsc --noUncheckedIndexedAccess` on both projects (the counts overlap where noted):

| Where | Errors | What they mostly are |
|---|---|---|
| `shared/core/src/battle/simulator.ts` | 127 | fixed-size troop and fort arrays read in loops (`D[i]`, `forts[0]`) |
| the rest of `shared/core/src` | 26 | array destructuring, first elements, loop indices |
| `backend/packages/game/src`, `backend/services/api/src`, `tools/dev` | 115 | rows from the database (`const [row] = await …`), `count(*)` results, first elements, records by key |
| `client/web/src` (not tests) | 92 | first elements (`items[0]`), adjacent pairs in loops, records keyed by a plain `string` |
| tests (backend, core and client) | about 1,180 | `rows[0].x`, `res.data[0]`, fixtures read by index |

- **Tests are three quarters of it.** In a test a lookup that misses already fails the test (a `TypeError` or a failed `expect`), so the flag adds the least there.
- **The client can't go first.** The client's tsconfig compiles `shared/core` from source (AGENTS.md, Shared code), so core's 153 errors show up in both projects: core has to be clean before the client's flag can go on.
- **The flag is per tsconfig.** `tsconfig.json` covers core, contracts, the backend and their tests together; `client/web/tsconfig.json` covers the client, its tests and (through imports) core. It can't be turned on for one folder at a time without splitting them.
- **`@typescript-eslint/no-unnecessary-condition`** is off: with the flag off it reports 178 false alarms, mostly `?? fallback` on lookups the types say can't miss (`BALANCE.fortSpace[id] ?? 1`). It becomes useful once the flag is on.
- Nothing in the repo has a helper for "the row that must be there" yet: 53 places destructure a select (`const [row] = await …`), 12 an `insert … returning()` and 13 a `count(*)`.

## The patterns

Each lookup the flag reports is one of these. The fix depends on whether it can really miss.

1. **It can really miss: say what happens.** A fallback (`BALANCE.fortSpace[id] ?? 1`), an early return, or a refusal (`GameError`). Most of the code already does this; the flag only makes the types agree.
2. **It can't miss by construction: make the type say so**, rather than asserting it.
   - **Literal keys.** A record over a fixed set of keys is `Record<TroopKey, number>`, not `Record<string, number>`; a lookup by a `TroopKey` is then never `undefined`. Keys read from `Object.entries` are typed back with the same const objects (`TROOP_KEY_LIST`, `BUFF_IDS` …).
   - **Tuples and literal indices.** A fixed-length array is a tuple, and the positions read are a union of literals: indexing `[number, number, number, number, number]` with `0 | 1 | 2 | 3 | 4` is never `undefined`. This is how the battle simulator gets clean without `!` in its hot loops: `MOVEMENT_ORDER` and `FIELD_TYPES` become `readonly TroopIndex[]`, `troopArray` returns a 12-tuple, and `for (let i = 0; i < 5; i++) forts[i]` becomes `for (const i of FORT_INDICES)`. The simulator is bit-exact against the original's regression data (`shared/core/test/battle*.test.ts`), so those tests guard the refactor.
   - **Non-empty arrays.** A list that always has an element is typed `[T, ...T[]]` where it's made, so `list[0]` is `T`.
3. **A database row that must be there: `one(rows)`.** `insert … returning()` and `count(*)` always give a row, and a select by a key the code has just checked may too. A small helper in `@marchlands/db` returns the row or throws an internal error (never a player-facing message: it means a bug), so `const [{ n }] = await …count()` becomes `const { n } = one(await …count())`. A select that can miss keeps its `if (!row)` check.
4. **Loops: iterate, don't index.** `for (const x of list)`, `list.entries()`, and a small `pairs(list)` for the adjacent-pairs loops in the client's animation code (`v[i - 1] + v[i]`), instead of `for (let i …) list[i]`.
5. **Regex groups** (`m[1]`) are `string | undefined`: a group in an alternative really can be missing. Check it, or use `?? ''` where the regex guarantees it.
6. **`!` (non-null assertion) is for tests only.** In source code it hides the next change that makes a lookup miss, which is what the flag is for; lint bans it there once the flag is on (Decided).

## Decided

- **`no-unnecessary-condition` on, with stored-data reads typed honestly** (2026-10-22): a fallback the types say is dead is either removed (the value is always there) or its type is fixed (it can be missing); a disable with the reason only where the rule can't follow the code.

- **Tests are fixed too, with `!` allowed in them, and keep one tsconfig** (2026-10-21). A lookup that misses in a test already fails the test, so `rows[0]!.x` costs nothing there, while a second tsconfig for tests would stop ESLint's project service from finding their project (it would have to list both projects, which is slower). Every file then follows the same flag.
- **Fix in chunks with the flag off, then turn it on** (2026-10-21). Each chunk (a package, or a few files) is its own change; the flag goes on in a tsconfig only when that whole project reports nothing. In between, a check keeps finished folders finished: `tools/dev/check-index-access.mjs`, run by `npm run typecheck`, runs `tsc --noUncheckedIndexedAccess` and fails on any error in a folder listed as done (`DONE` in the script). This avoids splitting the tsconfigs, and it goes once both flags are on.
- **Order: core, then the backend's source, the client's source, and tests** (2026-10-21). Core first because both projects compile it; within core, the battle simulator first.
- **`one(rows)` in `@marchlands/db` for a row that must be there** (2026-10-21): the only row of an `insert … returning()` or a `count(*)`, or throws (an internal error, never a player-facing message: it means a bug). It lives beside the schema, since the game package and the API both read rows. Not a general `must(value)`: a helper that takes anything invites it on lookups that should have a fallback.
- **`!` is banned by lint in source code once the flag is on** (2026-10-21): `@typescript-eslint/no-non-null-assertion` in `src`, off in tests. The rare one that's right takes an `eslint-disable-next-line` comment with the reason after `--`, which `reportUnusedDisableDirectives` keeps honest. Until the flag is on, fixes in `src` don't use `!` either, so turning the rule on finds nothing.

## Phases

1. **The ratchet script and `one()`** (done 2026-10-21). `tools/dev/check-index-access.mjs` runs at the end of `npm run typecheck` (about 3 s, only the project a done folder needs). `one()` replaced the 13 `const [{ n }] = await …count()` reads; the `insert … returning()` and other row reads are left for phase 3, where each is read on its own (some are updates that can match nothing).
2. **Core** (done 2026-10-21; `shared/core/src/` is in `DONE`).
   - The battle simulator: `TroopIndex` and `FortIndex` literal types, `PerTroop` / `PerFort` tuples built by `perTroop()` / `perFort()`, and its index lists typed as `readonly TroopIndex[]`. Checked against the old code on 6,000 random battles (3,000 inputs, with and without `fixes`): identical results, besides the bit-exact regression tests.
   - The rest: loops that iterate instead of index (`splitTraining`, `distributeLosses`), non-empty tuples for tables read at a clamped index (`TITLES`, the NPC tables), and a fallback where a lookup is in range by construction (the map noise, the valley types).
   - Two places now fail loudly instead of passing `undefined` on: `pick()` throws on an empty list, and `msgParamNames()` gives `[]` for a code no area lists. Neither happens with the game's data. The one `!` left in core (`ITEM_INFO`) went too.
3. **The backend's source** (done 2026-10-21; `backend/packages/db/src/`, `backend/packages/game/src/`, `backend/services/api/src/`, `backend/services/worker/src/`, `tools/dev/` and `tools/battle-sim/` are in `DONE`).
   - `one()` at every row that must be there: all 13 single-row `insert … returning()` and the rest of the `count(*)` reads (renamed fields, a count only taken when there are cities). The update in `flows.ts` that can match nothing keeps its own check.
   - `distributeLossesAmong(holders, troopsOf, …)` in core: each holder (the city, each stationed army) with the troops it has left, so the three battles in `engine/combat.ts` no longer match results up by position (`afterGroups[i + 1]`). `distributeLosses` is now a wrapper over it.
   - Lookups that check themselves: `pickResearch` returns the entry it found, a training batch is found before its index is used, `basicResource(resType)` for stored market types, the relation message found instead of `[1, 2, 3].includes(type)`, the JWT's three parts destructured, ranking sorts through `orderBy()` with a default.
   - Two places fail loudly where they used to fail late: the world seed checks the map data's length first (a cut-short legacy dump), and a tile with a city but no castle on the map throws instead of failing in the response's validation.
   - About 60 `!` (non-null assertions) were already in the backend's source (`req.claims!`, rows read after a check TypeScript can't follow): not index lookups, so left here, but they have to go before the lint ban (Decided) is turned on; see phase 6.
4. **The client's source** (done 2026-10-22; `client/web/src/` is in `DONE`, its `*.test.ts` files skipped by `NOT_YET` in the script until phase 5).
   - `pairs()` and `moved()` in `client/web/src/lib/arrays.ts`: the animation code's street lines and walking legs, and reordering flow actions and heroes, without reading past the end.
   - Fixed-length lists typed as tuples (`as const`): the scaffolding's poles and builders, the twinkle's offsets, the street neighbours, `CLOTHES`; `zoomsFor` returns a non-empty list.
   - The walker's route and position follow the route itself instead of `route[route.length - 1]` and parallel `lengths[i]`; a sprite hit test uses `findLast`; the iso grid keeps each sprite beside its toned copy instead of `spriteArt[i]`.
   - Art looked up by file name: `cityArt(file)` (buildings panel) and `GRASS` give `''` for a missing file, which never loads, so the scene draws nothing there, as it did with `undefined`; `lib/game-art.test.ts` checks every file is there.
   - Troop and fortification counts by key fall back to 0: the generated client types those records with plain string keys (`TroopBean` is `Record<TroopKey, number>` in the contracts).
   - The check now runs the client project too: about 8 s for both.
   - The client's source has 23 `!` of its own, for phase 6.
5. **Tests, then the flag on** (done 2026-10-22).
   - About 1,200 errors. A codemod (the TypeScript compiler API, run until nothing changed) added `!` where a possibly missing value is made rather than at each use: on the initializer of `const x = list[i]`, else on the expression. About 25 more were fixed by hand (`const [{ n }] = …` rows, the JWT's parts, regex groups).
   - At the source first: `lords(api, n)` and `valleysNear(g, cityId, n)` return `Tuple<T, N>` (`backend/packages/game/test/support/tuple.ts`), so `const [a, b] = await lords(api, 2)` needs no `!`; that alone took about 560 off.
   - `noUncheckedIndexedAccess` is on in `tsconfig.base.json` and `client/web/tsconfig.json`; `tools/dev/check-index-access.mjs` is gone; AGENTS.md (Formatting and linting, Lookups can miss) has the patterns.
6. **Lint.**
   - **`!` banned in source code** (done 2026-10-22). The 87 `!` outside tests (backend, client, tools) are gone, and `@typescript-eslint/no-non-null-assertion` is on everywhere but tests and shadcn/ui. Most were a value a guard had already checked: the guards now return what they checked (`requireRank` the alliance id, `assertCanUpgrade` the building and its next level, `assertCanTrain` the troop's config, `claimsOf(req)` the token's claims, `scheduledWith` an event's player or city). Filter-then-`!` became `flatMap`; a value that could really be missing became a check that throws an internal error (a gone army or home city, an event scheduled without its player) or refuses (a hero not in its city). The art script's palette lookups go through `indexOf`.
   - **`no-unnecessary-condition` on** (done 2026-10-22, in the type-aware files, tests included). The 52 findings (178 before the flag):
     - Casts that hid a miss became honest lookups: `fortKeyOf` and `troopKey` instead of `FORT_KEYS[id as keyof typeof FORT_KEYS]` (the dismiss dialog, training, `destroyForts`), `TROOP_ID_BY_KEY` read as a partial record in `healCost`, and `syncHeroBuffs` narrowing `b.id` instead of casting it.
     - Fallbacks on values that are always there went: `notNull` columns (hero and player `buffs`, an event's `payload`, a flow's `cities`, `banReason`), contract fields the API always sends, and string parameters the API validates.
     - Where a missing value is meant to be handled, the type now says so: `workRates` and `storePercent` are `Partial<ResourceSet>` (schema and core's city type), since a work rate a city never set counts as 100% (a dto test specifies it; it used to fake the partial object with a cast). Removing those fallbacks broke that test, which is how this was found.
     - `sanitizeTroops` takes `null | undefined` as well, so its fallback is honest.
     - Four lines where the rule can't follow the code carry a disable with the reason: the worker's `claimed` (set inside a callback) and `game()` / `anon()` in `http.ts` (a `void` result sent as `null`).

## Open questions

- **`exactOptionalPropertyTypes`** (about 130 errors) is a separate flag and isn't part of this; none of the 14 repos surveyed in October 2026 uses it.
