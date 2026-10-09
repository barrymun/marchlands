# Architecture

## From Spitfire to Marchlands

| | Original (C++ Spitfire) | Marchlands |
|---|---|---|
| Transport | AMF3 objects over TCP, 4-byte length prefix, Flash client | REST/JSON (`/api/v1`) + WebSocket pushes (`/ws`) |
| State | Everything in memory; written to MySQL by individual handlers and at clean shutdown | Postgres is the source of truth; every command is one transaction |
| Clock | One `TimerThread` polling all players every 100 ms | `timed_events` table with due times; workers claim rows with `FOR UPDATE SKIP LOCKED` |
| Resources | Ticked every minute for every city | Integrated lazily ("settled") when a city is read or changed |
| Concurrency | Network and timer threads mutated shared state with no locks | Row locks in a fixed order (players → cities → tiles → armies/orders) with retry on deadlock |
| Scaling | Single process | Stateless API replicas and any number of workers |

## Packages

```
@marchlands/core        pure rules + persisted-state zod schemas, no I/O (shared/, also used by the client)
     ▲
@marchlands/db          Drizzle schema + migrations; jsonb column types come from core
     ▲
@marchlands/contracts   zod schemas of the API surface; row shapes via drizzle-zod (shared/)
     ▲
@marchlands/game        services: (ctx, playerId, ...args) => result, run inside a transaction;
     ▲                     ▲      DTO builders and ctx.push are typed by the contracts
@marchlands/api       @marchlands/worker

@marchlands/api-client  openapi-fetch over types generated from the API's OpenAPI document,
     ▲                  plus a typed WebSocket client (push types from contracts)
@marchlands/web         Vite + React client (client/web)
```

- **core** contains the static data converted from the original `config_*` tables (`src/data/legacy/*.json`). It also holds:
  - the economy (`economy.ts`);
  - build, research and training timing and prerequisites (`construction.ts`);
  - heroes, march maths, items, quests, titles, map generation and NPC tables;
  - the battle simulator (`battle/simulator.ts`, a float32-exact port) and its game-level wrapper (`battle/resolve.ts`).
- **game** turns rules into persisted state changes. Each `services/*.ts` matches one packet group of the original (castle, tech, troop, hero, army, alliance, …). `combat.ts` handles army arrival: transport, reinforce, scout, build city and attack (player cities, barbarian cities and valleys).
- **contracts** declares every request body, query, response and push as a zod schema. Shapes that mirror a table are `createSelectSchema(table).pick(...).extend(...)`, so a column change propagates. Named schemas carry `.meta({ id })` and become OpenAPI components.
- **api** is a thin Fastify layer. Each route passes its contract schemas to `doc(tag, summary, DataSchema, { params, body, querystring })`; fastify-type-provider-zod validates input, serializes output through the schema (stripping unknown keys) and type-checks the handler's return value against it. It authenticates with a JWT and calls one service per request inside `runGame()`. `src/openapi.ts` writes the OpenAPI document without a database (`npm run gen:api`).
- **worker** seeds the world on first boot, processes due timed events and runs periodic jobs: rankings, zone stats, beginner-protection expiry and cleanup.

## A request

1. `POST /api/v1/cities/12/buildings {typeId: 1, positionId: 0}` reaches the API.
2. `game(req, …)` resolves the lord of the account and opens a transaction (`runGame`).
3. `buildings.construct()` runs these steps:
   - `openOwnCity()` locks the player row and then the city row, loads heroes, valleys and away-armies, and **settles** resources and population up to now;
   - core rules validate the request (slot, limits, prerequisites, queue) and deduct the cost;
   - `ctx.schedule({type:'building', dueAt, refKey:'building:12:0'})` queues the completion;
   - `ctx.push(playerId, 'server.BuildComplate', …)` queues a push.
4. On commit, the queued events are upserted into `timed_events`. Queued pushes are inserted into `push_messages` and announced with `pg_notify('marchlands_push', id)`. Both commit atomically with the state.
5. Every API replica `LISTEN`s and forwards the push to the sockets it holds for that player.

## The game clock

- **Rows.** `timed_events(type, due_at, ref_key, payload)` holds one row per pending completion. The types are `building`, `research`, `train`, `army`, `buff.expire`, `hero.buff`, `shipment`, and for flows `flow.resume`, `flow.queue` and `flow.heal` (see [Flows](#flows)). `ref_key` is unique, so speed-ups and recalls simply move the same event.
- **Claiming.** The worker loop selects one due row with `FOR UPDATE SKIP LOCKED`, deletes it and dispatches it, all in the same transaction. If the handler fails, the transaction rolls back and the worker records the error and retries with backoff, giving up after 5 attempts.
- **Idempotent handlers.** Each handler re-reads the state and does nothing if the event is stale. For example, a building that was cancelled or already completed by a coin speed-up is skipped. When a delayed event is found early, the handler reschedules it.
- **Game speed.** `GAME_SPEED` divides every duration through `scaled()`. Production and population ticks also scale, so a whole game can be compressed for testing.

## Lazy economy

Each city stores `resources_at` and its resource amounts. `settleCity()` integrates production from `resources_at` to now:

- **Production.** It accounts for fields, work rates, worker efficiency, tech, mayor and valley bonuses, buffs, troop upkeep and hero salaries.
- **Population and loyalty.** It applies the original 6-minute drift ticks at their exact boundaries.
- **Food shortages.** When food runs out, troops desert.

Whenever something changes a city's rates, the city is settled first. Examples are a tax change, a completed building or a production buff. Changes that affect every city of a lord (research, buffs) settle all of them.

## Data model (Postgres)

| Table | Content |
|---|---|
| `accounts` | login identities (scrypt password hashes), operator flag, bans |
| `players` | the lord: profile, prestige/honor, title, alliance rank; `research`, `items`, `buffs`, `misc` as jsonb |
| `cities` | resources and their timestamp, population, loyalty, tax, work rates; `buildings`, `troops`, `forts`, `troop_queues`, `fort_queue`, `injured_troops` as jsonb |
| `tiles` | 640,000 rows: type, level, city on it, valley owner; NPC/valley garrison and state as jsonb (lazy regeneration) |
| `heroes` | hired heroes, tavern offers (`in_tavern`), captives (`captured_by_player_id`) |
| `armies` | marching (forward/backward) and stationed armies |
| `timed_events` | the game clock |
| `mails`, `reports`, `chat_messages`, `push_messages` | messaging and outbox |
| `alliances`, `alliance_relations`, `alliance_requests`, `alliance_events` | alliances |
| `player_relations` | friends and blocks |
| `market_orders`, `market_shipments` | order book with escrow; goods and gold in transit |
| `quest_progress`, `world_state` | claimed quests; world metadata and cached zone stats |
| `player_stats` | (marchlands) lord statistics: one row per lord, city (0 = lord-wide) and day, or month once older than 60 days; `counters` jsonb (see [Statistics](#statistics)) |
| `flows` | (marchlands) a lord's saved flows: actions, cities and the `repeat` switch, plus the current run's state (`status`, `next_action`, `army_ids`, `wait_until`, `held_since`, `last_run`) |

## Consistency rules

- Lock order is: players (ascending id), then cities (ascending), then tiles, then heroes, armies and orders. Use `lockPlayers()` when more than one lord is involved. Combat locks the attacker and the defender before touching any city.
- A market trade never locks the counterparty's city. Gold and goods move as `market_shipments` rows, and the worker delivers them.
- Retryable Postgres errors (40001 serialization failure, 40P01 deadlock) are retried by `runGame()`.
- `savepoint(ctx, fn)` runs `fn` in a savepoint of the current transaction: if it throws, its writes and the pushes and events it queued are discarded and the outer transaction carries on. Flows use it to roll back one city at a time.

## Flows

(marchlands; `backend/packages/game/src/services/flows.ts`, rules in [deviations.md](deviations.md).) A flow is a list of actions run on some or all of a lord's cities.

- **Parts.** Wait actions split a run into parts. A part runs the actions between two waits in every city of the run, in one transaction with a savepoint per city. A city whose action fails is rolled back to the start of the part; the other cities finish it, then the flow stops (`repeat` goes off). Nothing outside the transaction ever sees a part half done (e.g. an Attack mayor swapped in to train and swapped back).
- **Serialising.** Every flow operation (run, repeat, stop, save, and the worker's flow events) first locks all of the lord's `flows` rows with `SELECT … FOR UPDATE` in `created_at` order. So a lord's flows act one at a time, a part at a time; other flows run during a flow's waits.
- **Waits.** A wait sets `status = 'waiting'` and `wait_until`, and schedules `flow.resume` (`ref_key flow:<id>`). A time wait ends after its real minutes. An armies-home wait ends when every army in the run's `army_ids` has stopped moving; until then the resume reschedules itself at the expected return, then every 5 s.
- **Heroes home.** Before each part, a flow checks the run's cities for armies with a hero that are marching out or coming back (`armies.hero_id is not null and direction in (forward, backward)`). If there are any, the flow is held: `held_since` is set and `flow.resume` is scheduled for the expected return. A flow that is not held also holds while another flow has an earlier `held_since`. A resume of any held flow carries on the held flows oldest first and stops at the first one still blocked, so a repeating farming flow cannot starve the others.
- **Repeat and queue.** At the end of a run, a repeating flow becomes `queued` with `not_before` set to 1 minute after its run started. `flow.queue` (`ref_key flowqueue:<playerId>`) carries on held flows and then starts every queued flow whose `not_before` has passed.
- **Updates.** Every change to a flow's row pushes `server.FlowUpdate`. A run that stops on its own also sends a `server.SystemInfoMsg` with the reason.

## Statistics

(marchlands; `backend/packages/game/src/stats.ts`, read by `services/statistics.ts`, shown in the Stats tab.) Lord statistics are counted where things happen and never recomputed. They are written in batches, so they are allowed to be a few minutes behind.

- **Counting.** Game code calls `ctx.stat(playerId, cityId, counters)` with flat keys such as `trained.archer`, `killed.trap`, `produced.food`, `spent.building.wood` or `attacks.won.npc`. City 0 holds lord-wide counters (items). The counters stay on the transaction's context: a rollback or retry discards them; a commit merges them into an in-memory buffer of the process. The hot path does no database work.
- **Production.** `settleCity()` returns what each settled span produced (gross, gold as tax), wasted (storage full), fed to troops and paid to heroes. `settle()` notes these on the city row, and `saveCity()` counts them, so a settle that is never saved (an in-memory view) is never counted.
- **Writing.** The API and the worker each flush their buffer every 5 minutes (`STATS_FLUSH_MS`) and on shutdown, in one `insert … on conflict do update` whose counters merge with the `stats_add(a, b)` SQL function. A crash loses at most the last few minutes of counters.
- **Compaction.** The worker's hourly `stats` job folds daily rows older than 60 days into one row per month.
- **History.** Nothing before `world_state.statsStartedAt` is counted (migration 0012 cleared the first day's counters and restarted counting, so every counter covers the same span).
