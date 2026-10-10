# AGENTS.md

How to work in this repository. Read [README.md](README.md) for what Marchlands is and the repository layout, and [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Ground rules

- **Git:** the maintainer manages git. Don't commit, push or branch unless asked. When asked for a commit message, keep it concise, and don't use double quotes, backticks or `$` in it (it gets pasted into `git commit -m "..."`).
- **Player-facing language is neutral:** say "player", never "lord" or "lady", in anything a player reads (UI text, item and quest descriptions, error messages, mail). Code identifiers and comments may still say lord.
- **Deviations are documented:** every rule that differs from the original Evony Age 1 server goes in [docs/deviations.md](docs/deviations.md), marked *(design change)*. Every tunable number lives in `shared/core/src/balance.ts` (`BALANCE`); don't hard-code game values elsewhere.
- **Don't change behaviour while restructuring.** A refactor moves code; a rule change is its own change, documented as above.

## Commands

Run from the repo root.

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc` for the backend + shared packages, then for the client |
| `npm test` | vitest: `shared/*/test`, `backend/**/test`, and `client/web/src/**/*.test.ts` |
| `npm run lint` / `npm run lint:fix` | ESLint (code quality only) |
| `npm run format` / `npm run format:check` | Prettier (all formatting) |
| `npm run gen:api` | regenerate the OpenAPI spec, the typed client and `docs/api-endpoints.md`. Run it after changing anything in `shared/contracts` or an API route. |
| `npm run sim -- …` | battle simulations, see [docs/battle-sims](docs/battle-sims/README.md) |
| `API=http://localhost:3100 node tools/smoke/smoke.mjs` (also `war.mjs`, `market.mjs`) | end-to-end checks against the running stack |

Before finishing any change: `npm run typecheck`, `npm run lint`, `npm test` and `npm run format:check` all pass.

**Running stack** (Docker Compose project `marchlands`; ports come from `.env`):

- Rebuild after a change: `docker compose up -d --build api worker web`, or only the services you touched.
- If the change adds a migration: `docker compose stop api worker` first, then rebuild, so the one-shot `migrate` service runs before they start.
- Testing with the API creates players. Use temporary accounts and delete them, and any alliances left empty, when done. Never touch the maintainer's own player.

## Formatting and linting

- **Prettier owns formatting:** single quotes, 160-character lines (`.prettierrc.json`). Generated files, migrations, the original game's data JSON and Markdown are ignored (`.prettierignore`).
- **ESLint owns code quality** (`eslint.config.js`): the JS and TypeScript recommended rules, plus react-hooks and react-refresh in the client. Its style rules are off (`eslint-config-prettier`), so the two never disagree.
- An unused name prefixed with `_` is allowed.
- **Don't read the time during render:** use the `useNow()` hook (`client/web/src/hooks/use-now.ts`).
- **Don't call setState synchronously in an effect.** Derive the value while rendering instead, or use `useSyncExternalStore`.

## Shared code (`shared/core`, `shared/contracts`)

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
- **`shared/contracts` is the API's single source of types.** Changing it means running `npm run gen:api`, then using the generated types in the client (`@marchlands/api-client`).

## Database

- The Drizzle schema in `backend/packages/db/src/schema.ts` is the source of truth.
- **Column changes:** generate the migration with `drizzle-kit generate`.
- **Data-only migrations** are written by hand:
  1. Add `migrations/NNNN_name.sql`.
  2. Copy the previous `meta/NNNN_snapshot.json`, with a new `id` and `prevId`.
  3. Append an entry to `meta/_journal.json`.
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
lib/                           app-wide helpers (api, format, tones, genders, utils) and their tests
```

Worked examples: `components/military-panel/`, `components/buildings-panel/`, `components/reports-panel/`.

### Rules

1. **One component per `.tsx` file**, exported. The file and its folder are named in kebab-case after the component: `TrainEstimate` lives at `train-estimate/train-estimate.tsx`. Every component gets a folder, however small.
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
5. **Imports use the full path,** e.g. `@/components/military-panel/production/production`. There are no `index.ts` barrel files, and nothing is re-exported. Use `import type { X }` for type-only imports.
6. **Order within a file:** imports, then the component. The exported component is the last thing in the file.

### Tests

- **Every `utils.ts` has a `utils.test.ts` beside it,** covering every function: normal cases and edge cases.
- **Name each block after the function:** `describe(areaOf.name, () => { … })`, not a string.
- **Tests run in plain Node** (no DOM, no JSX).
  - Stub browser globals with `vi.stubGlobal(...)` and restore them in `afterEach` with `vi.unstubAllGlobals()`.
  - Set game speed with `setGameSpeed` from core, and reset it afterwards.
- **Prefer real game data** from `@marchlands/core` (item effects and prices, troop names, `BuffId`) over invented fixtures.
- **Assert behaviour you've read in the code** or confirmed by running it. Locale-formatted numbers in particular are best confirmed by running.

### UI conventions

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
