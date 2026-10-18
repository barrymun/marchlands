# AGENTS.md

How to work in this repository. Read [README.md](README.md) for what Marchlands is and the repository layout, and [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Ground rules

- **Git:** the maintainer manages git.
  - Don't commit, push or branch unless asked.
  - Never change the index (`git add`, `git mv`, `git rm`, `git restore --staged`). The maintainer curates what's staged. Move or delete files with plain `mv` / `rm`. Read-only git (`status`, `diff`, `log`) is fine.
  - When asked for a commit message, keep it concise. Leave out double quotes, backticks and `$` (it gets pasted into `git commit -m "..."`), and add no `Co-Authored-By` or other attribution trailer.
- **New dependencies** are pinned to an exact version (no `^` or `~`) released at least two weeks ago.
- **Player-facing language is neutral:** say "player", never "lord" or "lady", in anything a player reads (UI text, item and quest descriptions, error messages, mail). Code identifiers and comments may still say lord.
- **Planned work** is listed in [TODO.md](TODO.md). In the change that finishes an item, move it to the Done section at the bottom (newest first, dated, one line saying what was done).
- **Ideas and known quirks for later** go in [docs/backlog.md](docs/backlog.md): what happens now, where, and why it was left.
- **Deviations are documented:** every rule that differs from the original Evony Age 1 server goes in [docs/deviations.md](docs/deviations.md), marked *(design change)*. Every tunable number lives in `shared/core/src/balance.ts` (`BALANCE`); don't hard-code game values elsewhere.
- **Don't change behaviour while restructuring.** A refactor moves code; a rule change is its own change, documented as above.

## Picking up where the last session left off

Everything a new session needs is in the repository. Nothing lives only in an agent's memory. To see where things stand:

- **The plan:** [TODO.md](TODO.md) lists the open items. Its Done section (newest first) shows what was finished last.
- **Recent work:** run `git log --oneline` and `git status`. Staged changes are the maintainer's curated next commit; unstaged ones are still in progress. Ask before assuming which is which.
- **Decisions already made, and the reasons for them:**
  - [docs/architecture.md](docs/architecture.md), e.g. Import prefixes.
  - [docs/deviations.md](docs/deviations.md): rule changes.
  - [docs/backlog.md](docs/backlog.md): quirks left on purpose.
- **Moving to another machine** (the stack, `.env` and a database dump): README.md, Moving the dev stack to another machine.

## Commands

Run from the repo root.

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc` for the backend + shared packages, then for the client |
| `npm test` | vitest: `shared/*/test`, `backend/**/test`, and `client/web/src/**/*.test.ts` (no database) |
| `npm run test:db` | the backend service tests against Postgres (`*.db.test.ts`, see Backend tests). Needs the Postgres container. |
| `npm run lint` / `npm run lint:fix` | ESLint (code quality only); `lint` also runs `npm run knip` (unused files, exports and dependencies) |
| `npm run format` / `npm run format:check` | Prettier (all formatting) |
| `npm run build:web` | build the client, then check its size budget (`client/web/.size-limit.js`); over a limit, the build fails |
| `npm run build:backend` | bundle the API, worker and migrations into `dist/backend/`, source maps into `dist/backend-maps/` (what the backend image runs; the Dockerfile runs it with `--minify`) |
| `npm run trace < trace.txt` | map a stack trace from the bundles back to source positions; in production run it in the container (`docs/deployment.md`, Reading a stack trace) |
| `npm run gen:api` | regenerate the OpenAPI spec, the generated client (Hey API) and `docs/api-endpoints.md`. Run it after changing anything in `shared/contracts` or an API route. |
| `npm run ci:local` | run the CI workflow (`.github/workflows/ci.yml`) locally with [act](https://nektosact.com/): every check below in clean Linux containers, about 2 minutes (see Local CI) |
| `npm run art:draw [-- <name>…]` | redraw the sprites made in code (`tools/art/`, see Client, Game art), all or the ones named (`cottage`, `forest`, `walls`, `cavalry`) |
| `npm run art:placeholders [-- --force]` | write placeholder sprites for any building art that's missing (see Client, Game art); `--force` rewrites them all, real art included |
| `npm run sim -- …` | battle simulations, see [docs/battle-sims](docs/battle-sims/README.md) |
| `npm run delete-player -- <username>… [--yes]` | delete test accounts the way the game does (their valleys released, castles back to flat land); lists what it would delete until run with `--yes`. Never deletes admin accounts. |
| `API=http://localhost:3100 node tools/smoke/smoke.mjs` (also `war.mjs`, `market.mjs`) | end-to-end checks against the running stack |

Before finishing any change: `npm run typecheck`, `npm run lint`, `npm test` and `npm run format:check` all pass, and `npm run test:db` when the change touches the backend.

**Local CI** (`npm run ci:local`, needs act and Docker):

- `.github/workflows/ci.yml` runs the checks above in two jobs: `checks` (`npm ci`, typecheck, lint with knip, format check, `npm test`, the client build with its size budget, the backend bundle) and `database` (`npm run test:db` against a Postgres 17 service, as in `docker-compose.yml`). Keep it in step with the list above.
- **Manual trigger only** (`workflow_dispatch`): GitHub never runs it by itself. To turn on CI on GitHub, add `push` / `pull_request` under `on` in the workflow.
- Both jobs run inside the `node:24-bookworm` image, so act only needs that image, and Postgres is reached as `postgres` under act and on GitHub alike.
- act copies the working tree into the containers, uncommitted changes included and gitignored files (`node_modules`, `dist`, `.env`) left out, so the run checks what's on disk from a clean install.
- `.actrc` maps `ubuntu-latest` to the node image (no first-run image prompt) and turns off act's own `.env` loading (`--env-file=/dev/null`): act would otherwise pass the stack's `.env` into every job and override the workflow's `DATABASE_URL`.

**Running stack** (Docker Compose project `marchlands`; ports come from `.env`):

- Hosting on the server is documented in [docs/deployment.md](docs/deployment.md) (production overrides in `docker-compose.prod.yml`, template `.env.production.example`). Keep it in step with any change to the images, Compose files, settings or start-up order.

- Rebuild after a change: `docker compose up -d --build api worker web`, or only the services you touched.
- The backend image runs esbuild bundles (`npm run build:backend`, `tools/build/backend.mjs`), not the sources: one `.mjs` each for the API, the worker and `migrate`, in `dist/backend/bin/`. A dependency that reads its own files at run time (Swagger UI's assets) is listed in `OWN_FILES` there, so its files are copied next to the bundle. Check a new dependency with a rebuilt image.
- If the change adds a migration: `docker compose stop api worker` first, then rebuild, so the one-shot `migrate` service runs before they start.
- Testing with the API creates players. Use temporary accounts named `fx_…` and delete them with `npm run delete-player` when done (it also disbands alliances they leave empty), never with hand-written SQL. Never touch any account you didn't create: the maintainer plays on the dev stack.
- Stop and back up the stack (to move it, or before something risky): README.md, Moving the dev stack to another machine. The restore needs an empty database, so removing the old volume is left to the maintainer.

## Formatting and linting

- **Prettier owns formatting:** single quotes, 160-character lines (`.prettierrc.json`). Generated files, migrations, the original game's data JSON and Markdown are ignored (`.prettierignore`).
- **ESLint owns code quality** (`eslint.config.js`): the JS and TypeScript recommended rules, plus react-hooks, react-refresh and i18next (no hard-coded text, see Translations) in the client. Its style rules are off (`eslint-config-prettier`), so the two never disagree.
- **Imports are sorted** (auto-fixed by `npm run lint:fix`):
  - Groups in this order, each alphabetised: stylesheets, `node:` builtins, packages, workspace packages (`@marchlands/…`), local (`#/…`, `#test/…`, `@/…`), relative (`import-x/order`).
  - A file with more than 3 imports has one blank line between groups; a smaller file keeps them together (`tools/eslint/import-spacing.mjs`).
  - The names inside the braces are alphabetised too (`sort-imports`).
  - Side-effect imports (`import '@/index.css'`) are never moved. A big reorder can take ESLint more than one `--fix` run.
- An unused name prefixed with `_` is allowed.
- **Don't read the time during render:** use the `useNow()` hook (`client/web/src/hooks/use-now.ts`).
- **Don't call setState synchronously in an effect.** Derive the value while rendering instead, or use `useSyncExternalStore`.

## Shared code (`shared/core`, `shared/contracts`)

- **Imports are absolute,** as in the backend (see Backend tests): `#/constants.ts` is the package's own `src/constants.ts`, `#test/…` its `test/` (the `imports` field of its `package.json`). Never a relative path (ESLint).
- **Keep the client's imports free of schemas.** The browser bundle leaves out modules whose exports it doesn't use (`client/web/vite.config.ts`), but a module it does import comes whole, zod schemas and all (zod alone is about 350 kB). So a value the client needs doesn't live in a module that builds zod schemas: constants go in `shared/core/src/constants.ts` (`BuildingStatus`, `FLOW_MAX_WAIT_MINUTES`), schemas in `types.ts` beside the others, and `PushCmd` has its own `shared/contracts/src/push-cmd.ts`. Check with a client build: a jump of hundreds of kB in `app-*.js` usually means a schema module came in.
- **Use const objects, never TypeScript `enum`.** Node runs `.ts` files directly (backend, `gen:api`, `tools/`), and type stripping cannot run `enum`. Follow the pattern in `shared/core/src/constants.ts`:

  ```ts
  export const BuffId = { ATTACK: 'AttackBuff', … } as const;
  export type BuffId = (typeof BuffId)[keyof typeof BuffId];
  export const BUFF_IDS = Object.values(BuffId) as [BuffId, ...BuffId[]];
  ```

  Keys are `UPPER_SNAKE`. The values are what's stored and sent to the client, so never change a value without a data migration.
- **Ids with a fixed set of values are typed, never plain strings.**
  - Player buffs use `BuffId` and hero buffs use `HeroBuffId`. Their schemas use `z.enum(BUFF_IDS)` and `z.enum(HERO_BUFF_IDS)`.
  - Add a new buff to `BuffId` first. Everything else (items, helpers such as `setBuff` / `activeBuff` / `hasBuff`, the client) only accepts a `BuffId`.
  - Items use `ItemId` (`shared/core/src/item-ids.ts`), named after the item: `ItemId.NAPOLEONS_DIARY`, never `'player.troop.1.b'`. Medals by level use `medalId(level)`. Speed-ups that are not items use `SpeedupId`. A new item gets its `ItemId` entry; a test checks `ItemId` lists exactly the game's items. Removed items (`REMOVED_ITEMS`) and migrations keep the original id strings.
- **`shared/contracts` is the API's single source of types.** Changing it means running `npm run gen:api`, then using the generated types in the client (`@marchlands/api-client`).

## API client (`shared/api-client`)

- **Generated by Hey API** (`@hey-api/openapi-ts`, config in `shared/api-client/openapi-ts.config.ts`) into `shared/api-client/src/generated/`. Never edit it by hand: run `npm run gen:api`.
- **Each endpoint's name comes from its operationId,** which the API derives from the method and path (`backend/services/api/src/operation-id.ts`). For example:

  | Endpoint | Generated names |
  |---|---|
  | `GET /api/v1/cities/{cityId}` | `getCitiesByCityId`, `getCitiesByCityIdOptions`, `getCitiesByCityIdQueryKey` |
  | `POST /api/v1/player/items/{itemId}/use` | `postPlayerItemsUse`, `postPlayerItemsUseMutation` |

  A trailing `{param}` becomes `By<Param>`, and inner parameters are dropped.
- **The envelope is handled for you.** The API answers `{ ok: 1, data }`. The client is generated from a copy of the spec whose success responses describe `data` (`unwrap-spec.ts`), and `configureApi` (`src/http.ts`) unwraps it at runtime. Failures throw `ApiError`. Never unwrap by hand.
- **The client never writes a URL.** Use the generated functions:

  | To | Use |
  |---|---|
  | Read | `useQuery(getXOptions({ path, query }))`, or `useQuery({ ...getXOptions(o), enabled, refetchInterval })` |
  | Write | `useCommand(postXMutation(), refresh, 'toast')`, then `.mutate({ path, body })` |
  | Make several calls in one command | `useCommand(async (v) => { … await postX({ …, throwOnError: true }) … }, refresh)` |
  | Invalidate or read the cache | the generated `getXQueryKey(o)`, built from the same options as the query. `allOf(getXQueryKey)` (`lib/query-keys.ts`) covers every query of an operation, and `allOf(getXQueryKey, { path: { cityId } })` covers one city's. |

  Never hand-write a query key.
- **WebSocket pushes:** the push client (`src/push.ts`) is typed by `shared/contracts`.
  - Refer to a message by the `PushCmd` constant (`PushCmd.RESOURCE_UPDATE`), never by its string. The values are the original protocol's names, misspellings included (`'server.BuildComplate'`), so never change one.
  - On the client:
    - `lib/push/handlers.ts` holds one handler per message (`PUSH_HANDLERS`). Each one patches cached data, invalidates the queries the message makes stale (with the same generated keys), and shows a toast.
    - The pure cache patches it uses live in `lib/push/utils.ts`.
    - `usePushSync` (`hooks/use-game.ts`) only connects the socket and subscribes the handlers.
    - To handle a new push, add its entry to `PUSH_HANDLERS` and a test in `lib/push/handlers.test.ts`. Those tests use a real `QueryClient` and mock `sonner`.

## Backend tests

Backend tests live beside the code they test, in a `test/` tree that mirrors `src/`: the tests of `backend/packages/game/src/services/armies.ts` are in `backend/packages/game/test/services/armies*.test.ts`, those of `src/engine/armies.ts` in `test/engine/armies*.test.ts` (a large module gets a folder, `test/engine/combat/`). Helpers two test files share go in `test/support/<area>.ts`.

- **Imports are absolute,** like the client's `@/…`: `#/engine/heroes.ts` is the package's own `src/engine/heroes.ts`, and `#test/support/game.ts` its `test/support/game.ts` (the `imports` field of each backend `package.json`, which Node, TypeScript and vitest all read). Never a relative path (ESLint). Another package is imported by name: `@marchlands/db`, and for shared test support `@marchlands/db/test/support/db.ts` or `@marchlands/game/test/support/…`. Why `#/` here and `@/` in the client: [docs/architecture.md, Import prefixes](docs/architecture.md#import-prefixes).
- **What the game package exports** (see [docs/architecture.md](docs/architecture.md)): a service file exports only operations the API, the worker or the tools call. A helper another service needs, or a timed-event handler, goes in `src/engine/<area>.ts`, which only the package itself imports. Its own tests import internal modules directly (`#/engine/…`); the API tests use `@marchlands/game/testing`.
- **No unused exports:** `npm run lint` runs knip (`knip.json`). It fails on an export nothing imports, and, in the backend, on one only tests import. Prefer testing through the function that uses it; an export kept for tests (a pure helper with its own unit test, a test-harness type) is tagged `@internal` in its doc comment.
- **`<name>.test.ts`** tests pure functions (no database) and runs in `npm test`. Prefer this: move a rule out of a service into a pure function (core, or an `@internal` helper) and test it here.
- **`<name>.db.test.ts`** tests a service against a real Postgres and runs in `npm run test:db` (`vitest.db.config.ts`). The setup creates the database `marchlands_test` (`TEST_DB_NAME`) next to the dev one, applies the migrations and seeds the map once; later runs reuse it. Files run one at a time.
- **Support** (`backend/packages/game/test/support/`):
  - `game(async (g) => …)` (`game.ts`) runs a test in one game transaction that is always rolled back, so tests leave nothing behind. `g` is the real context plus `g.pushes()`, `g.events()`, `g.advance(ms)` and `g.runDue()`, which runs the timed events that fall due (a construction completes, an army arrives). Time starts at a fixed `T0` and the random numbers are seeded.
  - `factories.ts` makes test data through the game's own code (`createTestPlayer`, `setBuildings`, `setResources`, `setResearch`, `giveItems`, `addHero` …), never with hand-written rows.
  - `expectRefused(promise, msg(…))` (`expect.ts`) asserts a service refuses with that message.
- **API tests** (`backend/services/api/test/`, same naming) call the real app without a network: `apiTest(async (api) => …)` (`test/support/api.ts`) builds it on the test transaction, so each route's game transaction becomes a savepoint and the test rolls back. `api.ok` / `api.refused` / `api.call` send requests; `api.player(name)` makes an account, a player and a city; `api.game(fn)` runs game code for set-up. The database is empty in every test, so the first account registered is the server operator. Route tests check the HTTP layer (auth, validation, the envelope, refusals); the game rules are covered by the service tests.
- **Code that commits** (`runGame`, the jobs, the worker) is tested by giving it the test transaction as its database, never the database itself.
- Never commit in a test, and never point the tests at the dev database.

## Database

- The Drizzle schema in `backend/packages/db/src/schema.ts` is the source of truth.
- **Column changes:** generate the migration with `drizzle-kit generate`.
- **Data-only migrations** are written by hand:
  1. Add `migrations/NNNN_name.sql`.
  2. Copy the previous `meta/NNNN_snapshot.json`, with a new `id` and `prevId`.
  3. Append an entry to `meta/_journal.json`.
- **Helper functions in a migration** are temporary (`pg_temp.name`) and created with `CREATE OR REPLACE FUNCTION`: a fresh database runs every migration in one session, so a name used by two migrations would otherwise clash. `npm run test:db` builds a database from scratch and catches this.
- **Removing an item:** add it to `REMOVED_ITEMS` / `REMOVED_ITEM_PATTERNS` (`shared/core/src/data/index.ts`), and add a migration that strips it from players' inventories.

## Client (`client/web/src`)

### Structure

```
components/
  ui/                          shadcn/ui: generated by the shadcn CLI, flat, left as shipped
  <name>/
    <name>.tsx                 exactly one component, exported
    constants.ts               (optional) this component's constants
    types.ts                   (optional) this component's types
    utils.ts                   (optional) pure helpers …
    utils.test.ts              … and their tests (required whenever utils.ts exists)
    hooks.ts                   (optional) hooks
    <child>/                   a sub-component used only by <name>, same layout, nested
      <child>.tsx
routes/
  <name>/<name>.tsx            same rules as components (e.g. routes/game/mayor-chip/)
hooks/                         app-wide hooks (use-game, use-now, use-inventory, …)
lib/                           app-wide helpers (api, format, i18n, tones, genders, utils) and their tests
locales/
  <locale>/<namespace>.json    all text the client shows (en-GB, en-US, ja-JP), see Translations
i18next.d.ts                   types translation keys against en-GB
```

Worked examples: `components/military-panel/`, `components/buildings-panel/`, `components/reports-panel/`.

### Rules

1. **One component per `.tsx` file**, exported. The file and its folder are named in kebab-case after the component: `TrainEstimate` lives at `train-estimate/train-estimate.tsx`. Every component gets a folder, however small. Route components add a `Page` suffix that the file doesn't repeat: `GamePage` lives at `routes/game/game.tsx`.
2. **Nesting follows usage:**
   - A component used by exactly one other component lives inside that component's folder.
   - A component used by several components lives in the folder of their nearest common parent.
   - A component used from outside its feature gets a top-level folder under `components/`, e.g. `timer-bar/`, `confirm-button/`.
   - A grouping folder with no component of its own is fine when two components share helpers, e.g. `flow-attack/` and `hero-gear/`.
3. **Component files hold only components.**
   - Module-level helpers go to `utils.ts`, hooks to `hooks.ts`, constants to `constants.ts`, and types or interfaces to `types.ts`.
   - Each of these lives in the folder of the only component that uses it. If several components use it, it goes in the folder of their nearest common parent.
   - Functions defined inside a component (closures over its props or state) stay in the component.
4. **No mix:**
   - Once a folder has a `constants.ts`, all of that component's module-level constants live there. The same goes for `types.ts`.
   - A component with no such file may keep private constants and types inline.
   - Avoid import cycles between `constants.ts` and `utils.ts`. A formatter that both need belongs in `lib/` (e.g. `percent` in `lib/format.ts`).
5. **Imports use the full path,** e.g. `@/components/military-panel/production/production` (stylesheets too: `@/index.css`); ESLint rejects relative paths. There are no `index.ts` barrel files, and nothing is re-exported. Use `import type { X }` for type-only imports.
6. **Order within a file:** imports, then the component. The exported component is the last thing in the file.
7. **Load on first use what most visits don't open.** Players may be on slow connections, so the first page loads only what it shows (`vendor-*.js`, `app-*.js`, about 270 kB gzipped). Every game tab but Buildings is a `lazyComponent` (`lib/lazy.ts`, declared in `routes/game/constants.ts`), fetched in the background once the page is up (`usePreloadPanels`), so switching tabs doesn't wait. A new tab, or another heavy screen or library (charts), follows the same pattern; a library only lazy screens use stays out of the `vendor` list in `vite.config.ts`. A size budget (`client/web/.size-limit.js`, size-limit, gzipped) runs after every client build, the Docker image's included, and fails it over a limit; `npm run size -w @marchlands/web` shows the sizes. Raise a limit only on purpose, saying why.

### Game art

- **Pixel art, committed:** sprites are small PNGs (a few kB) in `src/assets/<kind>/`, so they live in the repo like the locale files. The high-resolution source artwork they're drawn from stays outside the repo.
- **Buildings** (`src/assets/buildings/`): one sprite per building type and level band (levels 1-3, 4-6, 7-9 and 10), named by `buildingArtFile` in `lib/game-art.ts` (`town-hall-4.png`). Every type built in a slot has art (`BUILDING_ART_TYPES`; not the fortifications, and not the Walls, below), and `lib/game-art.test.ts` checks all four sprites of each are there and nothing else is. The slot shows the sprite for the building's band (`components/buildings-panel/slot/`), and so does the isometric town (below).
- **The walls in the grid view** (`src/assets/walls/`) aren't a sprite but a frame round the buildings inside the walls (`components/buildings-panel/walled-city/`), in the oblique top-down view: per level band, a `wall` piece repeating along the back and front walls, a `side` piece down the side walls (mirrored on the right), a `corner` tower and the `gate` (`WALL_PIECES`, `wallArtFile`; drawn in `tools/art/walls.ts`, from a wooden palisade to a crenellated fortress). Repeating pieces are outlined without their canvas edges (`outline({ edges: false })`) so their seams don't show. The Town Hall sits centre-top, and the gate is the Walls' button; with no walls built the frame is a dashed line.
- **Drawn small, scaled up crisp:** sprites are drawn at native size (the placeholders are 32×32) and scaled with `[image-rendering:pixelated]`, so one file serves every screen. Keep them lossless PNG with a palette: lossy AVIF or WebP blurs pixel art.
- **Served as their own files:** Vite gives each a hashed name and never inlines them into the JS (`assetsInlineLimit` in `vite.config.ts`), nginx caches `/assets/` for good, and `<img>` gets `width`, `height` and `loading="lazy"`. The `game art` entry of the size budget (`.size-limit.js`) caps them all.
- **Drawn in code:** finished buildings are isometric pixel art drawn by a script, one module per building in `tools/art/buildings/` (one per building, e.g. `cottage.ts`), with a small isometric canvas (`tools/art/iso.ts`, built on the screen-space `PixelCanvas` in `tools/art/pixel.ts`: boxes, plastered, stone and timber walls, gable and hip roofs in tile, thatch, shingle or barn red, colonnades, paving, grass, gardens, fences, wells, pines, logs, streams and water wheels, crops, haystacks, sheep, windmill sails, rock spires and outcrops, ponds, palms, cacti, reeds, mine entrances, cranes, carts, smoke, tents, market stalls, domes, crates, horses, fire, anvils, dummies, weapon racks, catapults, statues, towers, a shared palette) at 64×64. `npm run art:draw` writes their sprites over the placeholders; change a drawing and re-run it rather than editing the PNGs. Each band is bigger and stronger than the one before, and sprites are never trimmed to fill the tile: every band shares one scale on the 64×64 canvas, so a building visibly grows as it levels up. Building sprites are anchored, not centred: `anchor()` (`tools/art/iso.ts`) puts the middle of the ground diamond at (32, 46) whatever the plot's size, so the isometric town can stand each one on its tile. Art is original: a sample image is a reference for style, never traced or converted.
- **Map tiles** (`src/assets/tiles/`): one sprite per valley type (forest, desert, hill, swamp, grassland, lake, flat land), players' castles and barbarian camps, for each level band, named by `tileArtFile` (`forest-4.png`, `castle-2.png`, `npc-3.png`), drawn in `tools/art/tiles.ts`. The world map lays continuous grass and stands these on it, so each is a feature on a transparent ground, never a full diamond: a soft patch of ground (meadow, sand, mud, a lake and its shore), never outlined so it fades into the grass, with the things standing on it (trees, rocks, cacti, walls, towers, tents) drawn on a layer of their own and outlined. Each is 64×64 with its tile's middle at (32, 46), like the town's pieces, and grows richer with the level (a few pines at level 1, a dense forest at 10). Natural details are random but seeded per sprite (`IsoCanvas` takes a seed), so every run draws the same pixels.
- **The world map** (`components/map-panel/world-map/`): isometric like the original, drawn on a canvas that fills the view: the town's grass under every tile and each tile's sprite on it, back to front.
  - The camera is the tile at the middle of the view (fractional while dragging, allowed past the map's edge, which wraps) and a zoom from `ZOOMS` that lands on whole device pixels on this screen (`zoomsFor`); it opens at the largest zoom showing about six tiles across (`startZoom`). The camera's offset is rounded once and every tile is a whole number of device pixels from it (`tileOrigin`), so tiles join without seams.
  - It loads what is in view in 21×21 squares lined up on the wrapped coordinates (`chunksFor`, the most the map endpoint gives at once), each a cached query (`useMapArea`), so panning back is instant.
  - Drag (mouse or finger, `touch-none`) moves it; a press that hardly moves (`DRAG_SLOP`) is a click, which picks the front-most sprite with a pixel under the pointer, else the tile's diamond (`pickTile`). The arrow buttons move it straight up, down or across on screen (`panStep`), the crosshair goes back to the city, + and - zoom; with the map focused the arrow keys, + and - and Enter do the same.
  - Over the canvas: outlines for your valleys, other players' by relation, your city and the selection; players' castles carry their flag and name; hover names the tile with its level and holder.
- **The isometric town** (the City tab's Town view, `components/buildings-panel/iso-grid/`, `iso-city/`, `iso-fields/`; the Grid view keeps the cards, and screens narrower than `md` always get the cards): the slots laid out as diamonds on a ground of 64×32 grass tiles. Inside the walls, 6×6 cells stand `SLOT_PITCH` (1.3) tiles apart on 9×9 tiles of ground (`townLayout`), leaving grass between neighbours and most of a tile between the walls and the nearest buildings. The Town Hall covers the 2×2 block in the middle and the 32 slots fill every other cell, so no cell is left over. The 40 fields are 8×5, spaced the same way (`fieldLayout`).
  - Every piece is a sprite placed on a tile's middle, rounded to a whole pixel (`tilePoint`), and anchored so its ground diamond's middle sits there (`spriteBox`): 64×64 at (32, 46) for the ground (`src/assets/city/`, `CITY_GROUNDS`: grass tiles, and markers laid over them for an empty plot and a locked field), the buildings and the walls for their band round the ground (`CITY_WALL_PIECES`: a stretch along each outer tile edge, corner towers and the gate), all drawn in `tools/art/city.ts`; and 128×128 at (64, 94) for the grand Town Hall (`grandTownHallFile`), the slot sprite's drawing at twice the size (`IsoCanvas` `scale` 2, `tools/art/buildings/town-hall.ts`), so its details stay one pixel like everything else's. Ground is never outlined, so tiles join without seams.
  - Sprites are drawn back to front (`depthOf`); the back walls go before everything inside and the front walls after.
  - The art is drawn on one canvas at its own size, which CSS stretches to the card's full width with pixels kept sharp (`[image-rendering:pixelated]`), the height following, so the view fills its card at any width with no resize handling and no seams between tiles. On a wide screen it stops at the screen's height below the header (`HEADROOM`), so a whole town is always in view. Everything over it (level numbers, the hover outline and label, the buttons) is placed in percentages of the art's size.
  - A click picks the building whose pixels are under the pointer, front to back, else the tile's diamond (`hitTest`), so a tall building is never missed for the tile behind it. Every slot is also a hidden button, so the keyboard reaches them all; hover and focus outline the tile and name it. A building's level is a small number on its tile's front corner, on the grass rather than over the building (a full "Lv 10" chip hid whole cottages).
- **Troops and fortifications** (`src/assets/units/`, they share one id space): one 32×32 sprite per type, named by `unitArtFile` (`cataphract.png`, `archer-tower.png`), drawn in `tools/art/troops.ts` and `tools/art/fortifications.ts` on a plain `PixelCanvas` with the shapes in `tools/art/shapes.ts`: not isometric but side on, facing right and lit from the top left. Foot soldiers share one figure (legs, torso, head, front arm) dressed and armed per type, the mounted troops share a horse and rider, and the transporter and siege engines are timber machines on spoked wheels. The defensive trebuchet is shown by the boulders it hurls, as the original game's icon does. Thin things (shafts, blades, bowstrings) are drawn after `outline()` so they stay one pixel wide. They show at 32 px in the defences table and 64 px on the training cards (`components/military-panel/unit-icon/`), whole multiples so the pixels stay square.
- **Troop badges** (`src/assets/badges/`): one 24×24 badge per troop type for lists of troops, named by `troopBadgeFile` (`cataphract.png`, the same name as its sprite), drawn in `tools/art/badges.ts`: the troop's emblem (its tool or weapon, a horse's head, its machine) outlined on a bevelled blue tile. They show at 24 px in the garrison table and the send-army dialog (`components/troop-badge/`).
- **Resource icons** (`src/assets/resources/`): one 16×16 icon each for gold, food, lumber, stone and iron, named by `resourceArtFile` (`wood.png`), drawn in `tools/art/resources.ts` in the same side-on style (stacked gold and iron ingots, an ear of corn, stacked logs, a block of stone). The resource bar shows them at 16 px (`components/resource-bar/`).
- **Placeholders** until the real art is drawn: `npm run art:placeholders` (`tools/art/placeholders.ts`) writes a coloured placeholder for each missing sprite. Real art replaces a file under the same name; the script never overwrites one unless run with `--force`.

### Tests

- **Every `utils.ts` has a `utils.test.ts` beside it,** covering every function: normal cases and edge cases.
- **Name each block after the function:** `describe(areaOf.name, () => { … })`, not a string.
- **Tests run in plain Node** (no DOM, no JSX).
  - Stub browser globals with `vi.stubGlobal(...)` and restore them in `afterEach` with `vi.unstubAllGlobals()`.
  - Set game speed with `setGameSpeed` from core, and reset it afterwards.
- **Prefer real game data** from `@marchlands/core` (item effects and prices, troop names, `BuffId`) over invented fixtures.
- **Assert behaviour you've read in the code** or confirmed by running it. Locale-formatted numbers in particular are best confirmed by running.

### Translations

The client never writes player-facing text in code: every string comes from `src/locales/<locale>/<namespace>.json` through react-i18next (`src/lib/i18n.ts`). This applies to every change: new text, reworded text and removed text all happen in the locale files, in every locale, in the same change.

- **Locales:** `en-GB` is the source, the default and the fallback: it is used when the player has chosen nothing and the browser's language isn't supported, and for any key a locale lacks. It uses British spelling (honour, defence, cancelled, labour).
  - `en-US` is an override locale (`OVERRIDE_LOCALES`): it holds only the keys whose spelling differs (honor, defense, canceled, labor).
  - `ja-JP` is a full translation: every en-GB key.
- **No text in code:** `npm run lint` rejects words written in client JSX, in the attributes a player reads (`title`, `placeholder`, `aria-label`, `alt`, `label`, `description`), and in `toast(…)` and `useCommand(…)` messages (`eslint.config.js`). Strings with no letters, single letters and the game's name pass. Text built outside JSX (labels in `constants.ts`, sentences in `utils.ts`) isn't linted, so it relies on this section being followed.
- **Keeping locales in step:** `src/locales/locales.test.ts` (part of `npm test`) fails when they drift. It checks that:
  - every locale has the same namespace files, each registered in `src/i18next.d.ts`;
  - a full locale has exactly the en-GB keys, with the plural forms its language uses (from `Intl.PluralRules`: `_one` and `_other` for English, `_other` alone for Japanese);
  - an override locale holds only keys that exist in en-GB;
  - every translation keeps the en-GB `{{placeholders}}` and `<tags>`, and no text is empty.
- **Changing text:**
  1. **Add** a key to en-GB, then to every full locale (ja-JP), and to en-US if the spelling differs.
  2. **Reword** the en-GB text and update the translations to match. Don't leave an old translation that no longer says the same thing.
  3. **Remove** a key from every locale once no code uses it.
  4. **A new namespace** needs its file in every locale and an entry in `src/i18next.d.ts`.
  5. Keys are typed against en-GB, so code using a missing or misspelled key fails `npm run typecheck`.
- **Adding a locale:** add it to `LOCALES` in `lib/i18n.ts` (and to `OVERRIDE_LOCALES` if it only differs in spelling), create every namespace file for it, and add its name to `language.names` in each locale's `common.json`. A full translation also gets its loader, `src/locales/<locale>.ts` (copy `ja-JP.ts`): only en-GB and the en-US spellings are bundled with the app, and every other locale is one file loaded when chosen (a test checks the loader exists).
- **Namespaces:** one per top-level component folder or route, named after it (`flows-panel`, `login`), plus `common` for text that means the same everywhere: actions (Cancel, Save, Log out), resources, units and durations, levels (`level.short` is "Lv {{level}}"), "{{gold}} gold", troop counts, list separators, genders, hero attributes. Use a `common` key rather than repeating its text in a namespace; a word that only looks the same (the Research tab and the Research button) keeps its own key.
- **Adding text:**
  1. Add the key to the en-GB file of the namespace, then to `ja-JP` (and to `en-US` if the spelling differs).
  2. A new namespace needs its file in each locale and an entry in `src/i18next.d.ts`.
  3. Keys are typed against en-GB, so a missing or misspelled key fails `npm run typecheck`.
- **In a component:** `const { t } = useTranslation('<ns>')`, or `useTranslation(['<ns>', 'common'])` to also use `t('common:actions.cancel')`.
- **Outside components** (utils, constants, push handlers): `i18n.t('<ns>:key')` from `@/lib/i18n`. A constant that holds a label uses a getter (see `lib/hero-attributes.ts`). Changing the locale re-renders the app from its root (`LocaleRoot`), so these update too.
- **Keys** are camelCase, nested by sub-component. Use `{{placeholders}}` and `<Trans>` for text with markup inside. Write whole sentences: never glue fragments together, since word order differs between languages.
- **Plurals:** any number followed by a countable noun is a plural key: `_one` and `_other` in English, `_other` alone in ja-JP. Pass the raw number as `count`; to show it formatted, pass that too under another name: `t('common:troops', { count: total, n: fmtExact(total) })` with `"troops_one": "{{n}} troop"`. A sentence with two counts uses a nested key for the second (`cityTargets.idleHeroes`).
- **Numbers, dates and durations** follow the locale through `lib/format.ts`: `fmt`, `fmtExact`, `fmtDecimal`, `percent`, `duration`, `period`, `signedRate`, `dateTime` and `clockTime`. Never call `toLocaleString` / `toLocaleTimeString` directly.
- **Percentages are shares** (0.25) everywhere until they are shown: in BALANCE, in the API, in message params. The client shows them with `percent(share)` (`percent(0.005, 1)` for decimals), and the text holds no `%` of its own (`"+{{bonus}} production"`). Never multiply by 100 to display. The exceptions are settings the player types in as whole percents (tax rate, field work rates, warehouse store percent), which the API takes and returns as typed.
- **Game data names** (troops and fortifications, buildings, research, items, quests, titles, tiles, zones, alliance ranks, gear pieces, item categories) live in `data-<kind>` namespaces keyed by the game's id (`data-troops.json`: `"7": "Archer"`; `data-items.json` is flat because item ids contain dots). Look them up with `lib/game-data.ts` (`troopName(id)`, `itemName(id)`, `itemShortName(id)` …). Core holds no display names, and the API sends ids, never names. A new troop, building, item and so on needs its name in every locale; each data namespace has a test that it covers every id the game defines.
- **Game data descriptions** (building, research, troop, item and quest text) are messages built by core's info functions (`buildingInfo`, `techInfo`, `troopDescription`, `itemInfo`, quest descriptions) in the `*Info` message areas, with numbers taken from `BALANCE`.
- **Not translated:** names players or the game give to things (player, city and hero names, including generated ones like "X the Bold" or "X Keep"). Symbols and separators with no words in them (`—`, ` · `, `×3`, coordinates) and the game's name stay in code.
- **The player's choice** is in Player settings and is kept in `localStorage` (`marchlands-locale`). Without one, the browser's language picks the locale, and failing that, en-GB.
- **Tests** run in en-GB, so they assert English text.

### Server messages

The server never sends or stores English for players. Everything it tells a player is a **message**: a code plus params (`shared/core/src/messages/`), worded by the client in the player's language.

- **Codes** are `<area>.<name>` (`hero.locked`, `report.title.attackSucceeded`). Each area has a registry file (`messages/<area>.ts`) listing its codes and their param names, and a locale namespace `msg-<area>` worded in every locale.
- **Server side:**
  - Build a message with `msg('hero.locked', { name })`, which checks the code and its params at compile time.
  - Errors are `new GameError(msg(...), legacyCode, status)`; GameError takes no strings. They reach the client as `{ ok, error: <message> }`.
  - Flow logs, report titles and texts, boost descriptions, alliance events, system mail and system pushes hold messages too.
- **Params:**
  - **Numbers** are sent raw, and the client formats them. A plural count is `count`, written `{{count, number}}`, with plural keys.
  - **Text a player wrote** (names) goes as a string.
  - **Game data** goes as a reference: `ref.troop(id)`, `ref.building(id)`, `ref.tech(id)`, `ref.item(id)`, `ref.title(id)`, `ref.tile(type)`, `ref.zone(id)`, `ref.rank(rank)`, `ref.gear(piece)`, `ref.itemCategory(type)`, `ref.resource('wood')`, `ref.stat('power')`. Never put a name into a message.
  - **Lengths of time** go as `dur(ms)` (real milliseconds), shown as a duration.
  - **Percentages** go as `share(x)` (0.25 for 25%), shown as a percent. Never send a percent number (25); a core test checks the descriptions never do.
  - **A varying phrase** goes as a nested message. A **list** goes as an array.
  - **A number quoted from `BALANCE`** is passed from `BALANCE`, never written into the text.
- **Client side:** `errorMessage(err)` and `translateMessage(m)` (`lib/messages.ts`) word any message. Show server text only through them.
- **Adding a message:**
  1. Add the code to its area file (or `common.ts` when any area can send it; reuse an existing code with the same meaning).
  2. Word it in `msg-<area>.json` for en-GB and ja-JP (and en-US if the spelling differs).
  3. The locale test fails if a code has no text, if its placeholders don't match its params, or if text is left for a code that no longer exists.
- **Positions** of armies and reports are messages too (`world.position.city`, `.tile`, `.place`).
- **Stored data:** a stored message must keep meaning the same thing. If a code changes or is removed while rows still hold it, convert those rows in a migration.

### UI conventions

- **Page width:** the header and the tab bar run the window's whole width. A tab flagged `wide` in `TABS` (`routes/game/constants.ts`: the City and the Map) does too; every other tab keeps a readable width (`TAB_WIDTH`, `max-w-7xl`), so lines of text and tables don't stretch across a big screen. A new tab is readable-width unless it is a view to look round, like the town or the map.
- **Colours carry meaning.** Use the tokens in `lib/tones.ts`:

  | Meaning | Token |
  |---|---|
  | Running item bonus | purple, `ITEM_BONUS_*` |
  | Gains | green text, `GAIN_TEXT` |
  | Losses and errors | red, `LOSS_TEXT` |
  | Needs attention | amber, `WARN_TEXT` |
  | Status | neutral, `STATUS_DONE` |

  Hero attributes have their own colours in `lib/hero-attributes.ts`. Don't reuse a colour for a different meaning.
- **Confirmations always use a dialog:** `ConfirmDialog` (`components/confirm-dialog/`) or `ConfirmButton` (`components/confirm-button/`). Never use the browser's `confirm()` or a click-twice button. Anything that spends gold or can't be undone asks first.
- **Times shown to players are real time.** Rates are per real hour (`signedRate`, `realHourly` in `lib/format.ts`), and `GAME_SPEED` is applied with `scaled()` / `getGameSpeed()` from core.
- **Remembered UI state** (a collapsed card, a chosen tab) goes in `localStorage`, wrapped in try/catch, and the UI must still work without it.
