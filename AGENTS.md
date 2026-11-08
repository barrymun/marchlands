# AGENTS.md

How to work in this repository. Read [README.md](README.md) for what Marchlands is and the repository layout, and [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Ground rules

- **Git:** the maintainer manages git.
  - Don't commit, push or branch unless asked.
  - Never change the index (`git add`, `git mv`, `git rm`, `git restore --staged`). The maintainer curates what's staged. Move or delete files with plain `mv` / `rm`. Read-only git (`status`, `diff`, `log`) is fine.
  - When asked for a commit message, keep it concise. Leave out double quotes, backticks and `$` (it gets pasted into `git commit -m "..."`).
  - When Claude helped with the work, the message ends with a co-author trailer naming the model that did it, given as a second `-m` so it lands in its own paragraph: `git commit -m "Subject" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. No other attribution.
- **New dependencies** are pinned to an exact version (no `^` or `~`) released at least two weeks ago. `.npmrc` sets `save-exact=true`, so `npm i` pins by itself; checking a version's age is still by hand (`npm view <name> time`).
- **Player-facing language is neutral:** say "player", never "lord" or "lady", in anything a player reads (UI text, item and quest descriptions, error messages, mail). Code identifiers and comments may still say lord.
- **Terms:** *HC* means a historical city, and *L14 HC* a level 14 one; the code and the game's text call it a *historic city*, and its design also a *seat* ([docs/features/historical-cities.md](docs/features/historical-cities.md), Names). Write the name out in full in player-facing text, but for the city list's badge (`HistoricBadge`: "HC", its title in full).
- **Planned work** is listed in [TODO.md](TODO.md). In the change that finishes an item, move it to the Done section at the bottom (newest first, dated, one line saying what was done).
- **A large feature gets a design document** in [docs/features/](docs/features/README.md), linked from its TODO item: where things stand, what's decided and why, open questions and phases. Record decisions there as they're made.
- **Ideas and known quirks for later** go in [docs/backlog.md](docs/backlog.md): what happens now, where, and why it was left.
- **Deviations are documented:** every rule that differs from the original Evony Age 1 server goes in [docs/deviations.md](docs/deviations.md), marked *(design change)*. Every tunable number lives in `shared/core/src/balance.ts` (`BALANCE`); don't hard-code game values elsewhere.
- **Feature flags** switch off a part of the game for a release (`shared/core/src/features.ts`, `FEATURE_<NAME>`, off unless set): how they work and how to add one are in [docs/architecture.md](docs/architecture.md), Feature flags. The backend always enforces the rule; the client's `useFeature` only shapes what's shown.
- **Don't change behaviour while restructuring.** A refactor moves code; a rule change is its own change, documented as above.

## Picking up where the last session left off

Everything a new session needs is in the repository. Nothing lives only in an agent's memory. To see where things stand:

- **The plan:** [TODO.md](TODO.md) lists the open items. Its Done section (newest first) shows what was finished last.
- **Recent work:** run `git log --oneline` and `git status`. Staged changes are the maintainer's curated next commit; unstaged ones are still in progress. Ask before assuming which is which.
- **Decisions already made, and the reasons for them:**
  - [docs/architecture.md](docs/architecture.md), e.g. Import prefixes.
  - [docs/features/](docs/features/README.md): designs of large features in progress.
  - [docs/reference/](docs/reference/README.md): how the original game worked, from guides and fan sites (in our own words, with sources). [docs/spec/](docs/spec/) is from the original server's source code.
  - [docs/deviations.md](docs/deviations.md): rule changes.
  - [docs/backlog.md](docs/backlog.md): quirks left on purpose.
- **Moving to another machine** (the stack, `.env` and a database dump): README.md, Moving the dev stack to another machine.

## Commands

Run from the repo root.

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc` for the backend + shared packages, then the client, then `tools/art` |
| `npm test` | vitest: `shared/*/test`, `backend/**/test`, and `client/web/src/**/*.test.ts` (no database) |
| `npm run test:db` | the backend service tests against Postgres (`*.db.test.ts`, see Backend tests). Needs the Postgres container. |
| `npm run lint` / `npm run lint:fix` | ESLint (code quality only); `lint` also runs `npm run knip` (unused files, exports and dependencies) and `npm run sherif` (the workspaces' `package.json` files agree: the same version of a shared dependency everywhere, and so on). sherif's `root-package-manager-field` rule is off: npm comes with Node 24, here and in CI's `node:24` image, so the root names no `packageManager`. |
| `npm run format` / `npm run format:check` | Prettier (all formatting) |
| `npm run build:web` | build the client, then check its size budget (`client/web/.size-limit.js`); over a limit, the build fails |
| `npm run build:backend` | bundle the API, worker and migrations into `dist/backend/`, source maps into `dist/backend-maps/` (what the backend image runs; the Dockerfile runs it with `--minify`) |
| `npm run trace < trace.txt` | map a stack trace from the bundles back to source positions; in production run it in the container (`docs/deployment.md`, Reading a stack trace) |
| `npm run gen:api` | regenerate the OpenAPI spec, the generated client (Hey API) and `docs/api-endpoints.md`. Run it after changing anything in `shared/contracts` or an API route. |
| `npm run ci:local` | run the CI workflow (`.github/workflows/ci.yml`) locally with [act](https://nektosact.com/): every check below in clean Linux containers, about 2 minutes (see Local CI) |
| `npm run art:draw [-- <name>…]` | redraw the sprites made in code (`tools/art/`, see Client, Game art), all or the ones named (`cottage`, `forest`, `walls`, `cavalry`, `gear`, `figure`); also writes the bare twins and `assets/spots.json` the animations use. It writes `spots.json` on one line: run `npm run format` after it |
| `npm run art:placeholders [-- --force]` | write placeholder sprites for any building art that's missing (see Client, Game art); `--force` rewrites them all, real art included |
| `npm run sim -- …` | battle simulations, see [docs/battle-sims](docs/battle-sims/README.md) |
| `npm run delete-player -- <username>… [--yes]` | delete test accounts the way the game does (their valleys released, castles back to flat land); lists what it would delete until run with `--yes`. Never deletes admin accounts. |
| `API=http://localhost:3100 node tools/smoke/smoke.mjs` (also `war.mjs`, `market.mjs`, `abandon.mjs`, `pvp-off.mjs`) | end-to-end checks against the running stack. `war.mjs` needs `FEATURE_PVP=true` on the stack, `pvp-off.mjs` needs it off, and each says so and stops otherwise |
| `API=http://localhost:3100 npm run load -- [--players 100] [--minutes 5] [--server-stats] [--cleanup]` | load test (`tools/smoke/load.mjs`): simulated players (`fx_load_NNN`, kept for the next run unless `--cleanup`) open screens and push sockets as the web client does; prints requests per second and latency per endpoint, the pushes, and with `--server-stats` the stack's CPU and Postgres transactions. The requests follow the client's: change it when the client's queries or push handlers change what they fetch |

Before finishing any change: `npm run typecheck`, `npm run lint`, `npm test` and `npm run format:check` all pass, and `npm run test:db` when the change touches the backend.

**Local CI** (`npm run ci:local`, needs act and Docker):

- `.github/workflows/ci.yml` runs the checks above in two jobs: `checks` (`npm ci`, typecheck, lint with knip, format check, `npm test`, the client build with its size budget, the backend bundle) and `database` (`npm run test:db` against a Postgres 17 service, as in `docker-compose.yml`). Keep it in step with the list above.
- **Manual trigger only** (`workflow_dispatch`): GitHub never runs it by itself, to save the cost of its runners for now; `npm run ci:local` is how CI runs. Don't turn it on unless the maintainer asks. To turn it on, add `push` / `pull_request` under `on` in the workflow.
- Both jobs run inside the `node:24-bookworm` image, so act only needs that image, and Postgres is reached as `postgres` under act and on GitHub alike.
- act copies the working tree into the containers, uncommitted changes included and gitignored files (`node_modules`, `dist`, `.env`) left out, so the run checks what's on disk from a clean install.
- `.actrc` maps `ubuntu-latest` to the node image (no first-run image prompt) and turns off act's own `.env` loading (`--env-file=/dev/null`): act would otherwise pass the stack's `.env` into every job and override the workflow's `DATABASE_URL`.

**Running stack** (Docker Compose project `marchlands`; ports come from `.env`):

- Hosting on the server is documented in [docs/deployment.md](docs/deployment.md) (production overrides in `docker-compose.prod.yml`, template `.env.production.example`). Keep it in step with any change to the images, Compose files, settings or start-up order.

- Rebuild after a change: `docker compose up -d --build api worker web`, or only the services you touched.
- **In a worktree with its own stack** (README.md, A second stack for a worktree), `docker compose`, `npm run test:db` and the tools act on that stack, never the main one. Without one, a worktree's `docker compose up` would replace the main stack: set it up first.
- The backend image runs esbuild bundles (`npm run build:backend`, `tools/build/backend.mjs`), not the sources: one `.mjs` each for the API, the worker and `migrate`, in `dist/backend/bin/`. A dependency that reads its own files at run time (Swagger UI's assets) is listed in `OWN_FILES` there, so its files are copied next to the bundle. Check a new dependency with a rebuilt image.
- If the change adds a migration: `docker compose stop api worker` first, then rebuild, so the one-shot `migrate` service runs before they start.
- Testing with the API creates players. Use temporary accounts named `fx_…` and delete them with `npm run delete-player` when done (it also disbands alliances they leave empty), never with hand-written SQL. Never touch any account you didn't create: the maintainer plays on the dev stack.
- Stop and back up the stack (to move it, or before something risky): README.md, Moving the dev stack to another machine. The restore needs an empty database, so removing the old volume is left to the maintainer.

## Formatting and linting

- **Prettier owns formatting:** single quotes, 160-character lines (`.prettierrc.json`). Generated files, migrations, the original game's data JSON and Markdown are ignored (`.prettierignore`).
- **ESLint owns code quality** (`eslint.config.js`): the JS and TypeScript recommended rules, plus react-hooks, react-refresh and i18next (no hard-coded text, see Translations) in the client. Its style rules are off (`eslint-config-prettier`), so the two never disagree.
- **Type-aware rules** (typescript-eslint `recommendedTypeChecked`, about 20 s for the whole repo) run on the files a tsconfig covers (`TYPED` in `eslint.config.js`; keep it in step with the tsconfigs). Files outside them (`tools/art`, `tools/build`, the api-client's own files) are linted without types, but for `marchlands/no-string-value` in `tools/art` (its own tsconfig, without `noUncheckedIndexedAccess`), and shadcn/ui is left as shipped.
  - **A promise is awaited, or handed on with `void`:** an async handler is `onClick={() => void save()}`, never `onClick={save}` (`no-misused-promises`, `no-floating-promises`). `useGameNav`'s moves already return nothing.
  - **No `any` from untyped values:** read a form with `formText` and typed amounts with `typedAmounts` (`lib/forms.ts`), never `String(form.get(…))` or `Object.fromEntries` over `.map`. Tests may read JSON untyped.
  - **Only errors are thrown** (`only-throw-error`), deprecated APIs aren't used (`no-deprecated`), and a switch over a union covers every member or has a default (`switch-exhaustiveness-check`).
  - **`no-unnecessary-type-assertion` misjudges some casts** (a literal for a union, a cast i18next needs). Its `--fix` can break the types, so run `npm run typecheck` after it, and keep the cast in a form it accepts (`'own' as const`, the cast on a variable).
- **Other rules:** `eqeqeq` (`== null` allowed), `regexp` (no backtracking blow-ups, no unused groups), `jsx-a11y-x` (the maintained fork of jsx-a11y, for ESLint 10), `@tanstack/eslint-plugin-query`, the Drizzle rules (an `update` or `delete` on `tx` or `db` has a `where`), and in tests no `it.only`, `it.skip` or repeated titles.
- **The client's conventions are rules too:** no `alert`, `confirm` or `prompt` (use `ConfirmDialog`), no `fetch` (use the generated client), and no `toLocaleString` / `toLocaleTimeString` outside `lib/format.ts`. A locale test checks English text says "player", never "lord" or "lady".
- **An `eslint-disable` comment says why** after `--`, and fails the lint once it no longer disables anything (`reportUnusedDisableDirectives`).
- **Lookups can miss** (`noUncheckedIndexedAccess`, both tsconfigs): reading a list by position or a record by key gives `T | undefined`, and the code says what happens when it misses. The patterns, with the reasons, are in [docs/features/unchecked-index-access.md](docs/features/unchecked-index-access.md):
  - **It can really miss:** a fallback (`BALANCE.fortSpace[id] ?? 1`), an early return or a refusal.
  - **It can't, by construction: make the type say so** rather than asserting it. Records keyed by literal types (`Record<TroopKey, number>`), tuples indexed by a union of their positions (the battle simulator's `TroopIndex`), non-empty tuple types for tables read at a clamped index (`TITLES`), `as const` for fixed lists, and `Tuple<T, N>` (`backend/packages/game/test/support/tuple.ts`) for a helper returning as many as it was asked for (`lords(api, 2)`, `valleysNear`).
  - **A row that must be there:** `one(rows)` from `@marchlands/db` (a `count(*)`, a one-row `insert … returning()`); a select that can find nothing keeps its own check.
  - **Iterate, don't index:** `for … of`, `entries()`, destructuring (`const [first, ...rest] = list`), `findLast`, and in the client `pairs()` / `moved()` (`lib/arrays.ts`); have a lookup return what it found (`pickResearch`) rather than an index to read again.
  - **`!` (non-null assertion) is for tests,** where a miss fails the test anyway (`rows[0]!.x`). In source code it hides the next change that makes the lookup miss, so lint refuses it there (`no-non-null-assertion`, off in tests and shadcn/ui). Instead: a check that refuses or throws, a guard that returns what it checked (`requireRank`, `assertCanUpgrade`, `assertCanTrain`, `claimsOf(req)`, `scheduledWith`), or `flatMap` for filter-then-map.
  - **No check the types say can't fail** (`no-unnecessary-condition`, type-aware files): a fallback on a value that's always there is dead code, and one on a value that can be missing means its type is lying. Make the type honest rather than casting (`fortKeyOf(id)`, not `FORT_KEYS[id as keyof typeof FORT_KEYS]`; `workRates: Partial<ResourceSet>`, since a rate a city never set counts as 100%), and remove a fallback only when nothing relies on the missing case (a test will say). Where the rule can't follow the code (a variable set in a callback, a generic that may be `void`), disable it on that line with the reason.
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
- **Fixed values are named, never written as strings** (every package: shared, backend, client, tools). A set of string values (ids, tabs, modes, kinds, statuses) is a const object as above wherever its values are compared, stored, sent, put in the address or passed between modules, and code uses its names (`PanelId.RESEARCH`, `MilitaryTab.INN`, `ReportOrder.OLDEST`), never the strings (`'research'`). The list of values comes from it (`Object.values`), so they're never repeated. Strings stay where something else fixes them (CSS classes, DOM events, translation keys, the generated API client's types), in a test that checks how a raw string is read, and for a value private to one function. In the client, a constant a component's files need lives in its `constants.ts`; a value several screens share goes to their nearest common parent (`lib/`).
  - **Lint enforces it:** `npm run lint` refuses `x === 'y'` and `case 'y':` (`marchlands/no-string-compare`), and, tests included, a string assigned or passed where the types expect a set a const object names (`marchlands/no-string-value`: `pan('left')`, `{ kind: 'apply' }`), in both cases leaving alone what something else fixes: the first `typeof`, DOM events and keys, HTTP methods, environment variables and message codes, and tests, which may read a raw string; the second anything that isn't a named set, so translation keys, message codes and libraries' own sets. A named set is a top-level `const X` with a `type X` beside it, all of its members strings, so a new set follows that pattern for the rule to see it. `tools/eslint/rules.test.mjs` tests both.
  - **Type it, or lint can't see it:** the second rule asks the type checker, so it sees nothing where the type is plain `string`, or in a list with no type of its own. A parameter or column holding a set says so (`to: PanDirection`, `text('kind').$type<AllianceRequestKind>()`).
  - **What may stay a string:** a value truly private to one function, or fixed by an outside format, with `// eslint-disable-next-line marchlands/no-string-compare -- why`. Property names stay as they are: a record keyed by a set (`{ archer: 100 }`, `FLOW_FILL`) is checked by its type. So does a column's `.default(…)` in the Drizzle schema, which imports only types from core.
  - **Counters too:** a statistics counter is `statKey(StatGroup.TRAINED, troop)` or a `StatCounter`, never a string written by hand (`shared/core/src/stats.ts`). Tests may write the stored key out, to check what's stored.
  - **Stored and sent values are written out once:** `shared/core/test/constants.test.ts` fixes the exact value of every const object stored in the database or sent to clients. Code and other tests use the names, so they wouldn't notice a value changing. The same test scans the shared code and the backend, and fails on a named set with no entry: a set neither stored nor sent goes in its `NEEDS_NO_ENTRY` with the reason. It sees a top-level `const X = {` with a `type X` beside it, the pattern above.
- **Ids with a fixed set of values are typed, never plain strings.**
  - Player buffs use `BuffId` and hero buffs use `HeroBuffId`. Their schemas use `z.enum(BUFF_IDS)` and `z.enum(HERO_BUFF_IDS)`.
  - Add a new buff to `BuffId` first. Everything else (items, helpers such as `setBuff` / `activeBuff` / `hasBuff`, the client) only accepts a `BuffId`.
  - Items use `ItemId` (`shared/core/src/item-ids.ts`), named after the item: `ItemId.OTTOS_MUSTER_ROLL`, never `'player.troop.1.b'`. Medals by level use `medalId(level)`. Speed-ups that are not items use `SpeedupId`. A new item gets its `ItemId` entry; a test checks `ItemId` lists exactly the game's items. Removed items (`REMOVED_ITEMS`) and migrations keep the original id strings.
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
- **API tests** (`backend/services/api/test/`, same naming) call the real app without a network: `apiTest(async (api) => …)` (`test/support/api.ts`) builds it on the test transaction, so each route's game transaction becomes a savepoint and the test rolls back. `api.ok` / `api.refused` / `api.call` send requests; `api.player(name)` makes an account, a player and a city; `api.register` solves the sign-up puzzle itself (at a tiny difficulty, `TEST_CONFIG`), and a test sending its own sign-up body adds `proof: await api.signUpProof()`; `api.game(fn)` runs game code for set-up. The database is empty in every test, so the first account registered is the server operator. Route tests check the HTTP layer (auth, validation, the envelope, refusals); the game rules are covered by the service tests.
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
    worker.ts                  (optional) a Web Worker its hooks start (new Worker(new URL('./worker.ts', import.meta.url)))
    <child>/                   a sub-component used only by <name>, same layout, nested
      <child>.tsx
routes/
  <name>/<name>.tsx            same rules as components (e.g. routes/game/mayor-chip/)
hooks/                         app-wide hooks (use-game, use-now, use-inventory, …)
lib/                           app-wide helpers (api, format, i18n, tones, genders, utils) and their tests
locales/
  <locale>/<namespace>.json    all text the client shows (en-GB, en-US, ja-JP, ar, es), see Translations
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
7. **Load on first use what most visits don't open.** Players may be on slow connections, so the first page loads only what it shows (`vendor-*.js`, `app-*.js`, about 270 kB gzipped). Every screen but the Town and Fields views is a `lazyComponent` (`lib/lazy.ts`, declared in `routes/game/constants.ts`), fetched in the background once the page is up (`usePreloadPanels`), so opening one doesn't wait. A new screen, or another heavy screen or library (charts), follows the same pattern; a library only lazy screens use stays out of the `vendor` list in `vite.config.ts`. A size budget (`client/web/.size-limit.js`, size-limit, gzipped) runs after every client build, the Docker image's included, and fails it over a limit; `npm run size -w @marchlands/web` shows the sizes. Raise a limit only on purpose, saying why.

### Game art

- **Pixel art, committed:** sprites are small PNGs (a few kB) in `src/assets/<kind>/`, so they live in the repo like the locale files. The high-resolution source artwork they're drawn from stays outside the repo.
- **Buildings** (`src/assets/buildings/`): one sprite per building type and level band (levels 1-3, 4-6, 7-9 and 10), named by `buildingArtFile` in `lib/game-art.ts` (`town-hall-4.png`). Every type built in a slot has art (`BUILDING_ART_TYPES`; not the fortifications, and not the Walls, below), and `lib/game-art.test.ts` checks all four sprites of each are there and nothing else is. The slot shows the sprite for the building's band (`components/buildings-panel/slot/`), and so does the isometric town (below).
- **The walls in the grid view** (`src/assets/walls/`) aren't a sprite but a frame round the buildings inside the walls (`components/buildings-panel/walled-city/`), in the oblique top-down view: per level band, a `wall` piece repeating along the back and front walls, a `side` piece down the side walls (mirrored on the right), a `corner` tower and the `gate` (`WALL_PIECES`, `wallArtFile`; drawn in `tools/art/walls.ts`, from a wooden palisade to a crenellated fortress). Repeating pieces are outlined without their canvas edges (`outline({ edges: false })`) so their seams don't show. The Town Hall sits centre-top, and the gate is the Walls' button; with no walls built the frame is a dashed line.
- **Base colours** (`client/web/src/lib/palette.ts`): one table of every colour the pixel art uses, `PALETTE` (RGB by name), and `Colour`, its names. The art scripts draw in them (`Colour.STONE_L`, never `'stoneL'`), and what moves in code over the sprites takes its RGB from `PALETTE`, so the two can't drift. A colour's place in the table is its index in the sprites' PNG palettes, so a new one goes at the end. Nothing on the first page imports it.
- **Drawn small, scaled up crisp:** sprites are drawn at native size (the placeholders are 32×32) and scaled with `[image-rendering:pixelated]`, so one file serves every screen. Keep them lossless PNG with a palette: lossy AVIF or WebP blurs pixel art.
- **Served as their own files:** Vite gives each a hashed name and never inlines them into the JS (`assetsInlineLimit` in `vite.config.ts`), nginx caches `/assets/` for good, and `<img>` gets `width`, `height` and `loading="lazy"`. The `game art` entry of the size budget (`.size-limit.js`) caps them all.
- **Drawn in code:** finished buildings are isometric pixel art drawn by a script, one module per building in `tools/art/buildings/` (one per building, e.g. `cottage.ts`), with a small isometric canvas (`tools/art/iso.ts`, built on the screen-space `PixelCanvas` in `tools/art/pixel.ts`: boxes, plastered, stone and timber walls, gable and hip roofs in tile, thatch, shingle or barn red, colonnades, paving, grass, gardens, fences, wells, pines, logs, streams and water wheels, crops, haystacks, sheep, windmill sails, rock spires and outcrops, ponds, palms, cacti, reeds, mine entrances, cranes, carts, smoke, tents, market stalls, domes, crates, horses, fire, anvils, dummies, weapon racks, catapults, statues, towers) at 64×64. `npm run art:draw` writes their sprites over the placeholders; change a drawing and re-run it rather than editing the PNGs. Each band is bigger and stronger than the one before, and sprites are never trimmed to fill the tile: every band shares one scale on the 64×64 canvas, so a building visibly grows as it levels up. Building sprites are anchored, not centred: `anchor()` (`tools/art/iso.ts`) puts the middle of the ground diamond at (32, 46) whatever the plot's size, so the isometric town can stand each one on its tile. Art is original: a sample image is a reference for style, never traced or converted.
- **Map tiles** (`src/assets/tiles/`): one sprite per valley type (forest, desert, hill, swamp, grassland, lake, flat land), players' castles and barbarian camps, for each level band, named by `tileArtFile` (`forest-4.png`, `castle-2.png`, `npc-3.png`), drawn in `tools/art/tiles.ts`. The world map lays continuous grass and stands these on it, so each is a feature on a transparent ground, never a full diamond: a soft patch of ground (meadow, sand, mud, a lake and its shore), never outlined so it fades into the grass, with the things standing on it (trees, rocks, cacti, walls, towers, tents) drawn on a layer of their own and outlined. Each is 64×64 with its tile's middle at (32, 46), like the town's pieces, and grows richer with the level (a few pines at level 1, a dense forest at 10). Natural details are random but seeded per sprite (`IsoCanvas` takes a seed), so every run draws the same pixels. The historic cities have a sprite per level in the same folder (`historic-12.png` … `historic-18.png`, `historicArtFile`, drawn by `historic` in `tools/art/tiles.ts`: a stone fortress with red flags at 12, green-roofed towers at 14, slate spires and blue flags at 16, pale spires round a gold dome under gold flags at 18, mossier each level). They stand far taller than any other map sprite, each on its own tile and growing only upwards, Atlantis at (0, 0) tallest, so they're 128×128 with their tile's middle at (64, 94), drawn with `spriteBox(128)`; drawn on the world map with `size: HISTORIC_SPRITE` (`world-map/`, tile type 13, its level sent halved in the map string: `mapLevelDigit`).
- **The isometric viewport** (`components/iso-viewport/`) is what the world map, the town and the fields are drawn in: a canvas filling its parent, with one camera and one set of gestures, so the three never drift apart.
  - The camera is the tile at the middle of the view (fractional while dragging) and a zoom. It opens, and the buttons step, at a zoom from `ZOOMS` that lands on whole device pixels on this screen (`zoomsFor`), where the art is sharp; a smooth zoom may stop in between, where the art's pixels are a device pixel uneven. Its offset is rounded once and every tile a whole number of art pixels from it (`tileOrigin`), so all the art lies on one pixel grid and tiles join without seams at any zoom.
  - `useIsoViewport` holds the camera: where it starts (`start`, called once the view has a size), an optional `clamp` every move goes through, and `resetKey` (the camera starts again when it changes, and on every visit). It gives `at(col, row)` to place things over the canvas, and `zoomBy`, `panBy` and `centreOn` for buttons. `IsoViewport` draws `ground` then `sprites` (`Drawable`s, back to front; `tone` lights or dims one) and lays its children over them. A tile's outline is a piece too, in two halves (`Outline`, `outlineHalves`): its back half goes before what stands on the tile and its front half after, so a building hides the edges behind it, never the ones in front. The outlines are drawn on a layer of their own laid over the night, each piece after one erasing what of it the piece covers, and coloured by a CSS class's stroke (read from a hidden swatch, so dark mode follows).
  - Drag (mouse or finger, `touch-none`) moves it; a press that hardly moves (`DRAG_SLOP`) is a tap. The mouse wheel, the trackpad (a scroll, or a pinch: a wheel with Ctrl in Chrome and Firefox, gesture events in Safari) and two fingers zoom smoothly round the pointer or the fingers (`wheelZoom`, `WHEEL_RATE`, `PINCH_WHEEL_RATE`, `zoomAround`), anywhere between the first and last of `ZOOMS` (`clampZoom`). The + and - buttons step round the middle to the next sharp zoom (`nextZoom`); with it focused the arrow keys move it, + and - step the zoom and Enter calls `onEnter`.
  - A tap picks the front-most sprite with a pixel under the pointer (`spriteAt`, with `opaqueAt` from `hooks/use-images.ts`), else the tile there (`tileAt`).
  - **Moving scenes:** a piece is a sprite or an `Overlay` (a frame made in code, `PixelArt`, placed in art pixels from a tile's middle). Given `animate`, the viewport redraws about 12 times a second (`ANIMATION_FPS`) on the browser's animation frames, which stop in a hidden tab, with the pieces `animate` gives for that moment; given `sky`, it darkens the scene for the night (a deep blue over what is drawn, `source-atop`), draws overlays marked `light` (lit windows, fires) over the dark, then rain or snow and lightning. With reduced motion (`useMotion`, `hooks/use-motion.ts`) it draws `sprites` still.
- **The world map** (`components/map-panel/world-map/`): isometric like the original, in the viewport: the town's grass under every tile and each tile's sprite on it, back to front.
  - The camera may go past the map's edge, which wraps (no clamp). It opens on the city, two steps out from the largest zoom showing about six tiles across (`startZoom`, `START_STEPS_OUT`).
  - It loads what is in view in 21×21 squares lined up on the wrapped coordinates (`chunksFor`, the most the map endpoint gives at once), each a cached query (`useMapArea`), so panning back is instant.
  - A barbarian city's card (and a lower historic city's) offers a Draft button for each of the player's historic cities whose area it lies in, greyed out once that seat has drafted from it today, and a held seat's card Draft now (drafting at once from the barbarian city it would pick by itself) and its draft-by-itself switch (`tile-card/seat-draft/`).
  - The arrow buttons move it straight up, down or across on screen (`panStep`), and the crosshair goes back to the city. The coordinates on the toolbar open a box to go to any x and y (`go-to-coords/`, `parseCoords`), which centres the map there and selects the tile. Going to a place (that box, a valley, a farming target, the tile card's Centre here) keeps it in the address (`?at=300,500`, `MAP_SEARCH`), so a reload opens there with it selected, and a link to one from elsewhere (`go(ViewId.MAP, { at })`: Send army's Show on map) moves the map there even when it's already open (`placed`); the crosshair goes back to the city and clears it, and so do switching city (`searchForCity`) and clicking the city on the map (another of the player's cities clicked there takes its place).
  - Outlines, in the canvas's order so a big city hides the edges behind it (`outlineLayers`): your valleys, other players' by relation, your farming lists' targets (dashed sky blue: this city's bright, your other cities' pale; `farmLists`, `farmedTiles`, from the flows' Attack targets), your city, the selection and the tile under the pointer. Over the canvas, players' castles carry their flag and name; hover names the tile with its level, holder and the cities farming it.
  - The Map view fills the viewport edge to edge with nothing to scroll (`game.tsx`), and everything else floats over it (`components/map-panel/`): a toolbar (where the map is, the arrows, back to the city, the player's other cities, this city's valleys, the farming lists, the key), the selected tile's card (`tile-card/`, top right on a desktop) and, when asked for, the other cities (`other-cities/`, with their distance, a click going to the tile), the valleys (`held-valleys/`), the farming lists (`farm-targets/`: this city's targets, then your other cities', a click going to the tile) or the key (`map-legend/`) under the toolbar. On a phone the tile's card and the lists share the top of the map, one at a time.
- **The isometric town** (the Town and Fields views shown as a Scene, `components/buildings-panel/iso-grid/`, `iso-city/`, `iso-fields/`; Grid shows them as cards that scroll instead, and screens narrower than `md` always get the cards, for accessibility): the slots laid out as diamonds on a ground of 64×32 grass tiles. Inside the walls, 6×6 cells stand `SLOT_PITCH` (1.3) tiles apart on 9×9 tiles of ground (`townLayout`), leaving grass between neighbours and most of a tile between the walls and the nearest buildings. The Town Hall covers the 2×2 block in the middle and the 32 slots fill every other cell, so no cell is left over. The 40 fields (the Fields view) are 8×5, spaced the same way (`fieldLayout`).
  - Every piece is a sprite placed on a tile's middle and anchored so its ground diamond's middle sits there (`spriteBox`): 64×64 at (32, 46) for the ground (`src/assets/city/`, `CITY_GROUNDS`: grass tiles, and markers laid over them for an empty plot and a locked field), the buildings and the walls for their band round the ground (`CITY_WALL_PIECES`: a stretch along each outer tile edge, corner towers and the gate), all drawn in `tools/art/city.ts`; and 128×128 at (64, 94) for the grand Town Hall (`grandTownHallFile`), the slot sprite's drawing at twice the size (`IsoCanvas` `scale` 2, `tools/art/buildings/town-hall.ts`), so its details stay one pixel like everything else's. Ground is never outlined, so tiles join without seams.
  - Sprites are drawn back to front (`depthOf`); the back walls go before everything inside and the front walls after.
  - From `md` up the Scene fills the view like the map, in the same viewport, with nothing to scroll (`game.tsx`): it opens at the largest sharp zoom that shows the whole scene (`fitZoom`) and centred on it, and it drags and zooms like the map; however far, at least half the scene stays in view across and down, or the whole view is filled when half the scene is bigger than it (`clampToScene`). The camera starts again on every visit. The title, the building tags and the Scene · Grid switch float over the top (`FLOATING`). With tags picked the Scene keeps every building in place, the ones picked lit as usual and the rest dimmed (`highlight`); the cards list only the ones picked.
  - A click picks the building whose pixels are under the pointer, front to back, else the tile's diamond (`hitTest`), so a tall building is never missed for the tile behind it. Every slot is also a hidden button, so the keyboard reaches them all; hover and focus light the building, outline its tile and name it. A building's level is a small number on its tile's front corner, on the grass rather than over the building (a full "Lv 10" chip hid whole cottages), placed and sized with the zoom (`at`).
- **Animation** (`components/iso-anim/`, design and what moves where in [docs/features/town-animations.md](docs/features/town-animations.md)): the town, fields and map move in pixel art.
  - **Spots:** the art scripts' primitives (`smoke`, `fire`, `sails`, `wheel`, `banner`, `windows` …) record where they drew (`Spot`, `tools/art/pixel.ts`), and `npm run art:draw` writes them to `src/assets/spots.json` by `<folder>/<file>`. Animations are placed from them, never by hand: redraw a sprite and its animations follow.
  - **Bare twins:** a sprite with parts that move (sails, a water wheel, sheep; `MOVING` in `tools/art/draw.ts`) also gets `<name>-<band>-bare.png` without them (`bareArtFile`); the scene draws it with the moving parts over it, the Grid's cards the still sprite. `lib/game-art.test.ts` checks the twins.
  - **Frames in code:** every frame (smoke, flames, sails, walkers, scaffolding, rain …) is made by a pure function in `components/iso-anim/utils.ts` (`pixelArt`, cached by id, seeded so it looks the same every visit) in the base colours, and tested in `utils.test.ts`. No animation PNGs.
  - **Loaded after the first page:** the animation code (with `spots.json`) is its own file of the build, fetched by `useAnimations` (`components/iso-anim/hooks.ts`) once the page is up and only when motion is allowed; until then the scenes are still. Keep it out of the first page's imports (`import type` only).
  - **What the city is doing** comes from `useTownState` (`components/buildings-panel/hooks.ts`, the pure `townState`): the sidebar's queue queries (from its cache), the armies and the latest army reports, loaded only while the scene animates. A finished level is noted by the build-complete push (`lib/build-events.ts`) for the sparkle.
  - **Clock reads** (`Date.now()`, `new Date()`) stay inside the animation module (as defaults), never in the function a component builds for `animate` (React's purity lint).
- **Troops and fortifications** (`src/assets/units/`, they share one id space): one 32×32 sprite per type, named by `unitArtFile` (`cataphract.png`, `archer-tower.png`), drawn in `tools/art/troops.ts` and `tools/art/fortifications.ts` on a plain `PixelCanvas` with the shapes in `tools/art/shapes.ts`: not isometric but side on, facing right and lit from the top left. Foot soldiers share one figure (legs, torso, head, front arm) dressed and armed per type, the mounted troops share a horse and rider, and the transporter and siege engines are timber machines on spoked wheels. The defensive trebuchet is shown by the boulders it hurls, as the original game's icon does. Thin things (shafts, blades, bowstrings) are drawn after `outline()` so they stay one pixel wide. They show at 32 px in the defences table and 64 px on the training cards (`components/military-panel/unit-icon/`), whole multiples so the pixels stay square.
- **Troop badges** (`src/assets/badges/`): one 24×24 badge per troop type for lists of troops, named by `troopBadgeFile` (`cataphract.png`, the same name as its sprite), drawn in `tools/art/badges.ts`: the troop's emblem (its tool or weapon, a horse's head, its machine) outlined on a bevelled blue tile. They show at 24 px in the garrison table and the send-army dialog (`components/troop-badge/`).
- **Resource icons** (`src/assets/resources/`): one 16×16 icon each for gold, food, lumber, stone and iron, named by `resourceArtFile` (`wood.png`), drawn in `tools/art/resources.ts` in the same side-on style (stacked gold and iron ingots, an ear of corn, stacked logs, a block of stone). `ResourceIcon` (`components/resource-icon/`) shows them at 16 px, in the resource bar and the Market page's market bar.
- **Items** (`src/assets/items/`, design in [docs/features/item-art.md](docs/features/item-art.md)): one 32×32 icon per item (`ItemId`, medals included), named by `itemArtFile` after its `ItemId` name (`ottos-muster-roll.png`), drawn in `tools/art/items.ts` and one module per kind in `tools/art/items/` (`speedups.ts` … `medals.ts`, sharing `items/common.ts`: tones, `stamp` for small patterns, books, scrolls, `lathe` for symmetric shapes) in the troops' side-on style. Items that come in steps grow with them: the Guidelines a pile of books one higher a step, the seven-day boosts finer tools than the one-day ones, the medals bronze, silver and gold. `ItemIcon` (`components/item-icon/`) shows them at 32 px (the hero items dialog, a report's medals, the items used) or 64 px (the Items panel's cards from `sm`). `lib/game-art.test.ts` checks every item has its icon.
- **Hero gear** (`src/assets/gear/`, design in [docs/features/hero-gear-art.md](docs/features/hero-gear-art.md)): one 32×32 sprite per piece and gear level, 0 (no Hero Enhancement) to 10, named by `gearArtFile` (`weapon-3.png`), plain at the bottom and fantastic at the top; a backdrop per level in that level's colour (`gearBackdropFile`), which `GearIcon` (`components/hero-gear/gear-icon/`) stacks under the piece; and 9×9 stars (`gearStarFile`): red in use, orange waiting above the research level, grey not yet bought. Drawn in `tools/art/gear.ts` (the backdrops, the stars and the list of pieces) and one module per piece in `tools/art/gear/` (`weapon.ts` … `feet.ts`), sharing `gear/common.ts`: every piece above level 2 takes `look(level)`, steel trimmed in gold with stones in the level's colour (`setStone`, with a white glint so it shows on its own backdrop), spikes from 7, horns from 8 (`horn`, filled and outlined; `spike` is thin, after the outline), gilded at 9, crimson trimmed in silver at 10. The level colours (`GEAR_0` … `GEAR_10` in the base colours, each light, mid and dark) are reserved for the gear and kept apart from the colours the app gives a meaning. Shown at 64 px on the gear card and round the hero's figure on the character sheet (`PaperDoll`), with the stars (`components/hero-gear/stars/`). `lib/game-art.test.ts` checks every piece has all 11 levels. The icons move by level (design in [docs/features/gear-animations.md](docs/features/gear-animations.md)): the art scripts record spots (`gem` for each stone's glint, `shine`, a glowing `blade`, the backdrop's `star`s), and `GearIcon` draws frames made in code over its two images on a canvas (`gearFrame`, `components/hero-gear/gear-icon/utils.ts`), every icon on one clock (`useGearMotion`); still below level 3 and with reduced motion. Five pieces also move by themselves at every level, shifted row by row or column by column from a pivot spot (`stir`, `flap`, `nod`, `sway`, `swing`; `moveOffset`), the canvas drawing the piece in place of its still image meanwhile; the helm's plume moves alone over its twins (`gearTwinFile`: `head-4-bare.png`, `head-4-plume.png`, written by `npm run art:draw -- gear` for every sprite with a `sway` spot). The gear card starts a burst on a piece when a star is added, and on every piece when the gear level rises since it last showed it (`startBurst`, `components/hero-gear/utils.ts`; the level remembered in `localStorage`).
- **The hero figure** (`src/assets/figure/`, design in [docs/features/hero-figure-art.md](docs/features/hero-figure-art.md)): the hero drawn wearing all 14 pieces at one gear level, in 96×96 layers stacked back to front: the cape, the legs, the skin, the upper body, the hair and the helm (`figureCapeFile` … `figureHelmFile`). The gear layers go by gear level (the legs and upper body by sex too: a woman's own cut), the skin by sex and tone (`FIGURE_SKIN_TONES`), the hair by style and colour (`FIGURE_HAIR_STYLES`, `FIGURE_HAIR_COLOURS`), so bodies vary without more gear. Three-quarter view, facing right, the sword raised in the near hand and the shield on the far arm. Drawn in `tools/art/figure.ts` and one module per piece in `tools/art/figure/`, on one skeleton (`skeleton.ts`) every piece fits, following the icons' ladders with `look(level)`; each piece is a `part`, outlined on its own canvas, so it keeps its outline over what's behind it. The capes' `sway` spots and level 10's `stone` spots are for the movement. `lib/game-art.test.ts` checks every layer is there. On the Military page's Heroes tab, the character sheet's `HeroFigure` (`components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/`) stacks them on a canvas and moves them (a breath, the cape stirring, level 10's stones glowing; still with reduced motion), the body picked from the hero's id (`figureBody`). It is the fallback for the 3D hero (below).
- **The 3D hero** (design in [docs/features/hero-3d.md](docs/features/hero-3d.md)): the character sheet draws the hero in 3D by default, with a 2D · 3D switch under it (`PaperDoll`, remembered in `localStorage`). `HeroFigure3d` (`paper-doll/hero-figure-3d/`) builds a low-poly figure in code (`buildFigure`: every piece at every gear level, both bodies, following the 2D figure's ladders, in the base colours) and renders it with three.js at 128×128 in toon shading with a one-pixel outline pass, shown at 2× without smoothing; a drag or the arrow keys turn it. It moves on rigid parts hung from joints (`FigureModel`, `poseFigure`): it breathes, its cape stirs and level 10's stones glow in time with the 2D figure, about 12 frames a second, and a tap plays a swing, a salute or the shield raised (`ACTION_KEYS`); still with reduced motion. three.js loads only with it (`lazyComponent`, its own size budget, *hero 3d*), a spinner stands in while it loads, and the 2D figure without WebGL or if its context is lost. Change a piece's ladder in both figures.
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
  - `ar` (Arabic, Modern Standard) is a full translation too, written right to left (below), with Western digits (0-9) in formatted numbers and dates, as in the coordinates and times the code writes (`lib/format.ts`).
  - `es` (Spanish, neutral international: understood in Spain and Latin America, so any `es-*` browser gets it) is a full translation. It addresses the player as *tú*, uses the game data names in `es/data-*.json` everywhere, and numbers follow Spanish style through `Intl` (1234, 12.345, 1,2 M).
- **No text in code:** `npm run lint` rejects words written in client JSX, in the attributes a player reads (`title`, `placeholder`, `aria-label`, `alt`, `label`, `description`), and in `toast(…)` and `useCommand(…)` messages (`eslint.config.js`). Strings with no letters, single letters and the game's name pass. Text built outside JSX (labels in `constants.ts`, sentences in `utils.ts`) isn't linted, so it relies on this section being followed.
- **Keeping locales in step:** `src/locales/locales.test.ts` (part of `npm test`) fails when they drift. It checks that:
  - every locale has the same namespace files, each registered in `src/i18next.d.ts`;
  - a full locale has exactly the en-GB keys, no more and no fewer: each plain key as it is, and each plural key in the forms its language uses (from `Intl.PluralRules`: `_one` and `_other` for English, `_other` alone for Japanese, `_one`, `_many` and `_other` for Spanish), so a plain key written in plural forms fails too;
  - an override locale holds only keys that exist in en-GB;
  - every translation keeps the en-GB `{{placeholders}}` and `<tags>`, and no text is empty.
- **Changing text:**
  1. **Add** a key to en-GB, then to every full locale (ja-JP, ar, es), and to en-US if the spelling differs.
  2. **Reword** the en-GB text and update the translations to match. Don't leave an old translation that no longer says the same thing.
  3. **Remove** a key from every locale once no code uses it.
  4. **A new namespace** needs its file in every locale and an entry in `src/i18next.d.ts`.
  5. Keys are typed against en-GB, so code using a missing or misspelled key fails `npm run typecheck`.
- **Adding a locale:** add it to `LOCALES` in `lib/i18n.ts` (and to `OVERRIDE_LOCALES` if it only differs in spelling), create every namespace file for it, and add its name to `language.names` in each locale's `common.json`. A full translation also gets its loader, `src/locales/<locale>.ts` (copy `ja-JP.ts`): only en-GB and the en-US spellings are bundled with the app, and every other locale is one file loaded when chosen (a test checks the loader exists). Beyond the files, check:
  - **Its plural forms** (`Intl.PluralRules`): every plural key gets each of them (Arabic six: `_zero`, `_one`, `_two`, `_few`, `_many`, `_other`), and the locale test checks them. Each form keeps the en-GB `{{placeholders}}` (`_one` as en-GB's `_one`, the others as its `_other`).
  - **Its digits** in `lib/format.ts` (`numberLocale`, `dateLocale`), where it may differ from Intl's default.
  - **Its direction:** the page's `dir` follows the locale (`i18n.dir`, `lib/i18n.ts`), so a right-to-left language needs no more than its files, as long as the layout uses start and end (next).
- **Start and end, never left and right:** classes for a side say start and end (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`/`text-end`, `border-s`, `rounded-s`, `slide-in-from-start`), so the layout mirrors right to left and stays the same left to right; lint refuses left/right classes (`PHYSICAL_CLASS` in `eslint.config.js`). A centred `left-1/2` with its translate stays, and a picture that must not mirror (the walled city's frame) disables the rule on that line with its reason. shadcn/ui is left as shipped. Direction-free text such as coordinates and numbers keeps its own order.
- **English for the screens loaded on first use** loads with them, not with the first page (`LAZY_NAMESPACES` and the two file patterns beside it in `lib/i18n.ts`): their components read it with `useTranslation`, which waits for it inside the screen's Suspense boundary. A new lazy screen's namespace goes in that list, in both patterns. A namespace stays bundled if its text is read outside a component (`i18n.t` in `constants.ts`, `utils.ts` or a push handler can't wait for a file) or by anything on the first page; so `common`, every `msg-*` and `data-*` namespace, and shared ones like `armies-panel` (its mission names) stay.
- **Namespaces:** one per top-level component folder or route, named after it (`flows-panel`, `login`), plus `common` for text that means the same everywhere: actions (Cancel, Save, Log out), resources, units and durations, levels (`level.short` is "Lv {{level}}"), "{{gold}} gold", troop counts, list separators, genders, hero attributes. Use a `common` key rather than repeating its text in a namespace; a word that only looks the same (the Research tab and the Research button) keeps its own key.
- **Adding text:**
  1. Add the key to the en-GB file of the namespace, then to every full locale (`ja-JP`, `ar`, `es`; and to `en-US` if the spelling differs).
  2. A new namespace needs its file in each locale and an entry in `src/i18next.d.ts`.
  3. Keys are typed against en-GB, so a missing or misspelled key fails `npm run typecheck`.
- **In a component:** `const { t } = useTranslation('<ns>')`, or `useTranslation(['<ns>', 'common'])` to also use `t('common:actions.cancel')`.
- **A control inside `<Trans>`** that the text writes self-closed (`<stat/>`) takes no children: give it a component of its own (`StatSelect`). Trans wraps an element with children in a component it makes afresh on every render, so a screen that re-renders (`useNow`, every second) rebuilds it, and an open dropdown closes.
- **Outside components** (utils, constants, push handlers): `i18n.t('<ns>:key')` from `@/lib/i18n`. A constant that holds a label uses a getter (see `lib/hero-attributes.ts`). Changing the locale re-renders the app from its root (`LocaleRoot`), so these update too.
- **Keys** are camelCase, nested by sub-component. Use `{{placeholders}}` and `<Trans>` for text with markup inside. Write whole sentences: never glue fragments together, since word order differs between languages.
- **Plurals:** any number followed by a countable noun is a plural key: `_one` and `_other` in English, `_other` alone in ja-JP. Pass the raw number as `count`; to show it formatted, pass that too under another name: `t('common:troops', { count: total, n: fmtExact(total) })` with `"troops_one": "{{n}} troop"`. A sentence with two counts uses a nested key for the second (`cityTargets.idleHeroes`).
- **Numbers, dates and durations** follow the locale through `lib/format.ts`: `fmt`, `fmtExact`, `fmtDecimal`, `percent`, `duration`, `period`, `signedRate`, `dateTime` and `clockTime`. Never call `toLocaleString` / `toLocaleTimeString` directly.
- **Percentages are shares** (0.25) everywhere until they are shown: in BALANCE, in the API, in message params. The client shows them with `percent(share)` (`percent(0.005, 1)` for decimals), and the text holds no `%` of its own (`"+{{bonus}} production"`). Never multiply by 100 to display. The exceptions are settings the player types in as whole percents (tax rate, field work rates, warehouse store percent), which the API takes and returns as typed.
- **Game data names** (troops and fortifications, buildings, research, items, quests, titles, tiles, zones, alliance ranks, gear pieces, item categories) live in `data-<kind>` namespaces keyed by the game's id (`data-troops.json`: `"7": "Archer"`; `data-items.json` is flat because item ids contain dots). Look them up with `lib/game-data.ts` (`troopName(id)`, `itemName(id)`, `itemShortName(id)` …). Core holds no display names, and the API sends ids, never names. A new troop, building, item and so on needs its name in every locale; each data namespace has a test that it covers every id the game defines.
- **Game data descriptions** (building, research, troop, item and quest text) are messages built by core's info functions (`buildingInfo`, `techInfo`, `troopDescription`, `itemInfo`, quest descriptions) in the `*Info` message areas, with numbers taken from `BALANCE`.
- **Not translated:** names players or the game give to things (player, city and hero names, including generated ones like "Gero von Meissen" or "X Keep", and a historic city's own name, `historicNameAt`, which a held one keeps and can't be renamed from; the level 12s' names are shown on the map from core, untranslated). Symbols and separators with no words in them (`—`, ` · `, `×3`, coordinates) and the game's name stay in code.
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
  2. Word it in `msg-<area>.json` for en-GB and every full locale (ja-JP, ar, es; and en-US if the spelling differs).
  3. The locale test fails if a code has no text, if its placeholders don't match its params, or if text is left for a code that no longer exists.
- **Positions** of armies and reports are messages too (`world.position.city`, `.tile`, `.place`).
- **Stored data:** a stored message must keep meaning the same thing. If a code changes or is removed while rows still hold it, convert those rows in a migration.

### UI conventions

- **The game's layout** (`routes/game/`, modelled on the original's fixed frame but for any screen): a top bar (the city switcher, its mayor, the Town · Fields · Map switch, the account menu) over a viewport, and on a desktop (`lg`) a sidebar (`side-bar/`: cities, each of the others with a button sending an army there from any screen, resources, troops at home, queues) and a bottom bar (`bottom-bar/`: the player, the menu) that stay the same on every screen. Phones and tablets get the resources under the top bar, a tab bar (`tab-bar/`: the three views and Menu) and a menu sheet with everything else and the sidebar's contents.
  - **Three kinds of screen** (`lib/nav.ts`, moved between with `useGameNav`): *views* fill the viewport and are things to look round (`town`, `fields`, `map`); *pages* take the viewport's place for the heavier screens (`military`, `reports`, `market`, `flows`, `stats`); *panels* slide over the view for the lighter ones (`research`, `items`, `armies`, `plans`, `factions`; `panel-sheet/`, the whole screen on a phone). A view or page is the address's last part (`/cities/12/map`), a panel the `panel` search parameter (`/cities/12/town?panel=research`), so every screen can be linked to and the back button closes a panel. A page with tabs keeps its tab in a `tab` search parameter (`/cities/12/military?tab=gear`), so other screens can link to it. Older addresses (`/cities/12`, `/cities/12/buildings`, a tab that is now a panel, a panel that is now a page: `?panel=military`, the old Heroes page: `/cities/12/heroes?tab=gear`) redirect (`legacyHref`, `pageAsPanelHref`, and `pageAsPanel` in `useGameNav`). The ids are const objects: `ViewId`, `PageId`, `PanelId` (`go(PageId.MILITARY)`, `open(PanelId.RESEARCH)`).
  - **A new screen:** add its id to `lib/nav.ts` (a view, page or panel), its icon and name to `VIEWS` / `PAGES` / `PANELS` (`routes/game/constants.ts`, `game:nav.<id>`), and render it in `game.tsx` (a view or page) or `panel-sheet.tsx` (a panel). Link to screens with `useGameNav` (`go`, `open`), never by writing an address; `go` takes the screen's own search parameters, typed (`go(PageId.MILITARY, { tab: MilitaryTab.INN })`, below).
  - **Width:** views use the viewport's whole width; pages keep a readable one (`PAGE_WIDTH`, `max-w-7xl`), so lines of text and tables don't stretch across a big screen; the Military, Reports, Statistics and Flows pages use the whole width (`FULL_WIDTH_PAGES`). The Military page's Troops and Defences tabs do the same from `xl` (`hasScrollingPanes`, `lib/screen-search.ts`), each column scrolling by itself. The Market page is the other exception: a trading terminal (`components/market-panel/`) that on a wide screen (`xl`) fills the viewport like a view, its panes (`Panel`) scrolling themselves; narrower, they stack and grow to their content, and only the page scrolls, so a finger on a pane never gets caught in it (long lists show their first rows and a Show more, `useShortList`).
- **Scrolling:** a scroll area is `overflow-auto` (never `overflow-scroll`, which shows a scrollbar with nothing to scroll); a list inside a popover or card gets a thin scrollbar (`[scrollbar-width:thin]`), and a popover sizes itself to the room below it (`max-h-(--radix-popover-content-available-height)`, which follows the window's size) rather than a fixed height, so its list scrolls only when the screen is short, its title and buttons staying in view.
- **Colours carry meaning.** Use the tokens in `lib/tones.ts`:

  | Meaning | Token |
  |---|---|
  | Running item bonus | purple, `ITEM_BONUS_*` |
  | Gains | green text, `GAIN_TEXT` |
  | Losses and errors | red, `LOSS_TEXT` |
  | Needs attention | amber, `WARN_TEXT` |
  | Live right now (an active flow) | a green dot, `LIVE_DOT`, and `LIVE_EDGE` on its row |
  | Status | neutral, `STATUS_DONE` |
  | A hero at the maximum level | gold with a trophy, `MAX_LEVEL_TEXT` (`HeroLevel`, `components/hero-level/`) |
  | A held historic city, by level | its flags' colour (red, dark green, blue, gold), a solid HC badge with a castle, `HISTORIC_TONE` (`HistoricBadge`, `routes/game/historic-badge/`) |

  Hero attributes have their own colours in `lib/hero-attributes.ts`. Don't reuse a colour for a different meaning.
- **Numbers the player types use `NumberField`** (`components/number-field/`): kept as typed, digits only, never clamped while typing, so a box can be cleared or go past its range. Out of range it shows as invalid with the range in its title, and the screen holds its action back until it's in range (`textInRange`, `lib/ranges.ts`; `blank` where an empty box means none or all, a live `max` such as the troops at home).
- **Confirmations always use a dialog:** `ConfirmDialog` (`components/confirm-dialog/`) or `ConfirmButton` (`components/confirm-button/`). Never use the browser's `confirm()` or a click-twice button. Anything that spends gold or can't be undone asks first.
- **Landing times are UTC, by the server's clock:** camp times (the send-army dialog's landing time, a waiting army's row) are entered and shown in UTC with `utcClock` (`lib/format.ts`), so players in different time zones agree, and counted from `useServerNow` (`hooks/use-server-now.ts`; the offset the push socket's server time gives, `lib/server-clock.ts`).
- **Times shown to players are real time.** Rates are per real hour (`signedRate`, `realHourly` in `lib/format.ts`), and `GAME_SPEED` is applied with `scaled()` / `getGameSpeed()` from core.
- **Where the player is goes in the address:** a screen's tab, filters, sort, page and the thing open (a report, a hero) are search parameters, so a reload, the back button and a shared link land in the same place. How the player likes a screen shown is a preference (below), and what passes (hover, an open menu, a draft) stays in `useState`. How it works, and why: [docs/features/address-state.md](docs/features/address-state.md). The rules:
  - A screen describes its parameters once, as a schema of `param`s (`lib/search-state.ts`: `oneOf`, `maybe`, `text`, `flag`, `page`, `id`, `key`, `point`, `int`), and reads and writes them only with `useSearchState` (`hooks/use-search-state.ts`), never `useSearchParams`. A new kind of value gets its `param` there, with tests.
  - No name or value is a string: the schema types them (`set({ hero: id })`), fixed values are const objects (`MilitaryTab.GEAR`), and a tab's string is read through the schema (`MILITARY_SEARCH.tab.read(v)`), never cast.
  - A screen other screens link to keeps its schema in `lib/screen-search.ts`, listed in `SCREEN_SEARCH` (`lib/nav.ts`), so `go` and `screenHref` are typed by it; any other screen keeps it in its own `constants.ts`. A panel names itself (`{ panel: PanelId.ITEMS }`), so its names are under its id and go when it closes.
  - A search box uses `useSearchText`. An address that no longer fits falls back quietly, never with an error, and only a refusal resets anything (`isRefusal`, `lib/errors.ts`; queries take `retry: retryUnlessRefused`).
- **Remembered UI state** (a collapsed card, Scene or Grid) goes in `localStorage`, wrapped in try/catch, and the UI must still work without it.
- **Fonts are the player's choice** (Player settings, `FontStyle` in `lib/font.ts`, kept in this browser like the locale): Classic (Alegreya Sans, titles in Alegreya SC; the default), Ledger (Classic with every digit in Martian Mono), Terminal (Martian Mono) and Clear (Atkinson Hyperlegible Next). Each is a `[data-font=…]` rule in `index.css` setting `--font-body` and `--font-title`, which `font-sans` and `font-heading` use, so components never name a font. How it's kept small:
  - **Self-hosted** (Fontsource, pinned).
  - **Only Classic's `@font-face` rules ship with the first page.** The others' are in `lib/fonts/<style>.css`, loaded when the style is chosen or the select opens.
  - **Arabic's fonts load with its locale file** (`locales/ar.ts`). Japanese uses the system's fonts: the web fonts' CSS alone was 94 kB.
  - **Same text height in every style:** `font-size-adjust` gives each the same lowercase height, so sizes and layouts don't move with the style.
  - **Budgeted:** Classic's files count against the *Classic fonts* entry in `.size-limit.js`.
  - **Adding a style:** add it to `FontStyle`, its loader to `STYLE_FONTS`, its rule to `index.css`, and its name in every locale (`lord-dialog:font.names`).
