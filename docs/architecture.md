# Architecture

## From Spitfire to evony-re

| | Original (C++ Spitfire) | evony-re |
|---|---|---|
| Transport | AMF3 objects over TCP, 4-byte length prefix, Flash client | REST/JSON (`/api/v1`) + WebSocket pushes (`/ws`) |
| State | Everything in memory; written to MySQL by individual handlers and at clean shutdown | Postgres is the source of truth; every command is one transaction |
| Clock | One `TimerThread` polling all players every 100 ms | `timed_events` table with due times; workers claim rows with `FOR UPDATE SKIP LOCKED` |
| Resources | Ticked every minute for every city | Integrated lazily ("settled") when a city is read or changed |
| Concurrency | Network and timer threads mutated shared state with no locks | Row locks in a fixed order (players → cities → tiles → armies/orders) with retry on deadlock |
| Scaling | Single process | Stateless API replicas and any number of workers |

## Packages

```
@evony/core    pure rules, no I/O; deterministic given an Rng
     ▲
@evony/db      Drizzle schema + migrations; jsonb types come from core
     ▲
@evony/game    services: (ctx, playerId, ...args) => result, run inside a transaction
     ▲                 ▲
@evony/api       @evony/worker
```

- **core** contains the static data converted from the original `config_*` tables (`src/data/legacy/*.json`). It also holds:
  - the economy (`economy.ts`);
  - build, research and training timing and prerequisites (`construction.ts`);
  - heroes, march maths, items, quests, titles, map generation and NPC tables;
  - the battle simulator (`battle/simulator.ts`, a float32-exact port) and its game-level wrapper (`battle/resolve.ts`).
- **game** turns rules into persisted state changes. Each `services/*.ts` matches one packet group of the original (castle, tech, troop, hero, army, alliance, …). `combat.ts` handles army arrival: transport, reinforce, scout, build city and attack (player cities, barbarian cities and valleys).
- **api** is a thin Fastify layer. It validates input with zod, authenticates with a JWT and calls one service per request inside `runGame()`.
- **worker** seeds the world on first boot, processes due timed events and runs periodic jobs: rankings, zone stats, beginner-protection expiry and cleanup.

## A request

1. `POST /api/v1/cities/12/buildings {typeId: 1, positionId: 0}` reaches the API.
2. `game(req, …)` resolves the lord of the account and opens a transaction (`runGame`).
3. `buildings.construct()` runs these steps:
   - `openOwnCity()` locks the player row and then the city row, loads heroes, valleys and away-armies, and **settles** resources and population up to now;
   - core rules validate the request (slot, limits, prerequisites, queue) and deduct the cost;
   - `ctx.schedule({type:'building', dueAt, refKey:'building:12:0'})` queues the completion;
   - `ctx.push(playerId, 'server.BuildComplate', …)` queues a push.
4. On commit, the queued events are upserted into `timed_events`. Queued pushes are inserted into `push_messages` and announced with `pg_notify('evony_push', id)`. Both commit atomically with the state.
5. Every API replica `LISTEN`s and forwards the push to the sockets it holds for that player.

## The game clock

- **Rows.** `timed_events(type, due_at, ref_key, payload)` holds one row per pending completion. The types are `building`, `research`, `train`, `army`, `buff.expire`, `hero.buff` and `shipment`. `ref_key` is unique, so speed-ups and recalls simply move the same event.
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
| `players` | the lord: profile, prestige/honor, cents, title, alliance rank; `research`, `items`, `buffs`, `misc` as jsonb |
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

## Consistency rules

- Lock order is: players (ascending id), then cities (ascending), then tiles, then heroes, armies and orders. Use `lockPlayers()` when more than one lord is involved. Combat locks the attacker and the defender before touching any city.
- A market trade never locks the counterparty's city. Gold and goods move as `market_shipments` rows, and the worker delivers them.
- Retryable Postgres errors (40001 serialization failure, 40P01 deadlock) are retried by `runGame()`.
