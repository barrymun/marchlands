# Marchlands

A browser strategy game based on **Evony (Age 1)**: a from-scratch TypeScript rewrite of its game server that has since grown its own rules (see [docs/deviations.md](docs/deviations.md)). It is based on the open-source C++ server *Spitfire* ([sonya75/evony-private-server](https://github.com/sonya75/evony-private-server)) and the Age 1 battle calculator ([sonya75/EvonyAge1BattleCalc](https://github.com/sonya75/EvonyAge1BattleCalc)).

The original spoke AMF3 over a raw socket to a Flash client. This server instead offers:

- a **REST + JSON API** (OpenAPI docs at `/docs`) for every client command;
- a **WebSocket** at `/ws` for the live `server.*` push messages;

so a new client can be written in anything.

The original left a lot unimplemented: attacks, transport, reinforcement, the market, quests, friends, alliance permissions and more. This rewrite implements a complete, playable game. Each formula the original *did* have is ported exactly. The battle simulator is bit-exact against all 36,567 regression cases of the original calculator. The gaps are filled following Evony Age 1, and every deviation is listed in [docs/deviations.md](docs/deviations.md).

## Quick start

```bash
cp .env.example .env          # adjust ports / secrets if needed
docker compose up -d --build  # postgres, migrate (one-shot), worker, api, web
```

- Web client: http://localhost:8000 (`WEB_PORT`)
- API: http://localhost:3000/api/v1 (`API_PORT`)
- Interactive docs: http://localhost:3000/docs
- WebSocket: ws://localhost:3000/ws?token=JWT
- Database browser: `docker compose --profile tools up -d adminer`, then http://localhost:8080

On first boot the worker seeds the 800×800 world. It uses a procedural map by default; set `WORLD_MAP=legacy` to use the original `s2` tile layout instead. The **first account registered becomes an operator**, and so do any usernames listed in `ADMIN_USERNAMES`.

Set `GAME_SPEED=50` (or higher) to make every timer, production and march faster. This is handy while developing.

This is the development setup. To host the game on a server (secrets, HTTPS, backups, updates, moving an existing game), follow [docs/deployment.md](docs/deployment.md).

### A first session with curl

```bash
API=http://localhost:3000/api/v1
TOKEN=$(curl -s $API/auth/register -H 'content-type: application/json' \
  -d '{"username":"daisy","email":"daisy@example.com","password":"secret123"}' | jq -r .data.token)
# create the lord + first city (zone = one of the 16 states, -1 = random)
TOKEN=$(curl -s $API/player -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"userName":"Daisy","castleName":"Avalon","flag":"DSY","sex":1,"zone":-1}' | jq -r .data.token)
CITY=$(curl -s $API/player -H "authorization: Bearer $TOKEN" | jq .data.castles[0].id)
# build a cottage in slot 0
curl -s $API/cities/$CITY/buildings -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"typeId":1,"positionId":0}'
```

## Repository layout

```
marchlands/
├── docker-compose.yml        postgres · migrate · worker · api · web · (adminer)
├── shared/                   packages used by the backend *and* the client
│   ├── core/                 pure game rules: static data, persisted-state schemas, economy,
│   │                         construction, heroes, troops & marching, battle simulator, map, items
│   ├── contracts/            zod schemas of every request, response and WebSocket push
│   │                         (row shapes derived from the Drizzle tables via drizzle-zod)
│   └── api-client/           typed HTTP client (generated from OpenAPI) + WebSocket client
├── backend/                  TypeScript (Node 24 runs .ts directly in dev and tests)
│   ├── Dockerfile            one image for every backend service: esbuild bundles, no sources or node_modules
│   ├── packages/
│   │   ├── db/               Drizzle schema (source of truth), SQL migrations, connection helpers
│   │   └── game/             transactional game services shared by api + worker
│   │                         (one service module per original packet group)
│   └── services/
│       ├── api/              Fastify HTTP API + WebSocket push gateway
│       └── worker/           game clock: timed events (builds, research, training, marches,
│                             battles, deliveries, buff expiry) + periodic jobs
├── client/
│   └── web/                  Vite + React + Tailwind + shadcn/ui browser client (react-i18next: en-GB, en-US, ja-JP)
├── db/                       postgres config, init scripts, seed data (legacy map)
├── docs/
│   ├── architecture.md       how it fits together (incl. the type pipeline)
│   ├── deployment.md         hosting it on a server: install, HTTPS, updates, backups, operations
│   ├── api-endpoints.md      every endpoint, mapped to the original commands
│   ├── websocket.md          push messages
│   ├── deviations.md         what differs from the C++ server and why
│   └── spec/                 reverse-engineering specs of the original server
└── tools/
    ├── legacy-import/        converts the original MySQL dumps into data files
    ├── smoke/                end-to-end scenario tests against a running stack
    └── docs/                 doc generators
```

## Types: one source, every app

```
backend/packages/db/src/schema.ts ──► SQL migrations (drizzle-kit)
          │  (jsonb columns typed by shared/core/src/types.ts zod schemas)
          ▼
shared/contracts  (drizzle-zod row schemas → API responses, requests, pushes)
          │  route schemas: validation, response serialization, compile-time checks
          ▼
backend/services/api ──► OpenAPI 3.1 (shared/api-client/openapi.json; operationId = method + path)
          │                         │  Hey API (@hey-api/openapi-ts)
          ▼                         ▼
       /docs              shared/api-client/src/generated/  SDK functions, types,
                                                            TanStack Query options ──► client/web
```

Change a column, contract or route, then run `npm run gen:api` (no database or server needed) to refresh the OpenAPI document, the generated client (SDK functions, types and TanStack Query options) and `docs/api-endpoints.md`. `npm run typecheck` then flags every backend handler and client call that no longer fits. Responses are validated on the way out and unknown keys are stripped, so the contract is exactly what clients receive.

## Development

```bash
npm install
docker compose up -d postgres
npm run db:migrate                      # uses DATABASE_URL from .env
npm run dev:worker                      # in one terminal
npm run dev:api                         # in another (pretty logs, auto-reload)
npm run dev:web                         # Vite dev server on :5173, proxies /api and /ws to API_PORT

npm run gen:api                         # after changing contracts/routes: OpenAPI + client types + docs
npm run typecheck                       # backend and client
npm test                                # unit tests incl. the 36k-case battle regression suite
API=http://localhost:3000 npm run smoke # end-to-end scenarios (needs GAME_SPEED>=50 and an operator)
```

To change the schema, edit `backend/packages/db/src/schema.ts`, then run `npm run db:generate` to write a new SQL migration into `backend/packages/db/migrations`.

To rebuild the static game data from the original dumps, clone [evony-private-server](https://github.com/sonya75/evony-private-server) next to this repository and run `npm run legacy:convert -- ../evony-private-server/DB`.

### Moving the dev stack to another machine

The code comes from git. Three things don't, so copy them yourself:

- **`.env`**: it's gitignored. It holds this machine's ports, `JWT_SECRET`, `GAME_SPEED` and `ADMIN_USERNAMES`. Copy it, or start again from `.env.example`. With the same `JWT_SECRET`, players stay logged in.
- **The database**, as a dump (below). Players, cities and the map all live there.
- **Optional:** the high-resolution art samples (AGENTS.md, Game art), and the sibling clones `../evony-private-server` and `../EvonyAge1BattleCalc`. Only `legacy:convert` needs `../evony-private-server`.

**On the old machine,** stop the services that change the game, dump the database to `backups/` (gitignored), then stop Postgres:

```bash
docker compose stop api worker web
tools/ops/backup.sh                      # writes backups/marchlands-<UTC time>.dump
docker compose stop postgres
```

**On the new machine,** clone the repository and put `.env` and the dump in place. Restore the dump into a fresh database before anything else starts. If the worker starts first, it seeds a new map.

```bash
npm install
docker compose up -d postgres
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < backups/marchlands-<time>.dump
docker compose up -d --build             # migrate applies any migrations the dump lacks
```

- **The database must be empty.** That means a machine where Marchlands never ran, or one where the old volume was removed: `docker compose down`, then `docker volume rm marchlands_pgdata`.
- **To check a dump without touching the game,** restore it into a scratch database. Run `createdb` / `pg_restore -d <scratch>` / `dropdb` inside the postgres container.

The same steps move a hosted game: [docs/deployment.md](docs/deployment.md), Moving the game to this machine.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `marchlands` | database credentials |
| `POSTGRES_PORT`, `API_PORT`, `WEB_PORT` | 5432, 3000, 8000 | host ports |
| `DATABASE_URL` | – | for services run outside docker |
| `JWT_SECRET` | `change-me-in-production` | token signing key (**change it**) |
| `JWT_TTL` | 604800 | token lifetime, seconds |
| `GAME_SPEED` | 1 | multiplies the speed of every timer and of production |
| `WORLD_MAP` | `generated` | `generated` (procedural) or `legacy` (original s2 layout) |
| `WORLD_SEED` | `marchlands` | seed of the procedural map |
| `ADMIN_USERNAMES` | – | comma-separated usernames that are operators |
| `CORS_ORIGIN` | any | allowed browser origin(s) |
| `LOG_LEVEL` | `info` | pino log level |
| `WORKER_BATCH`, `WORKER_IDLE_MS` | 50, 250 | worker tuning |
| `STATS_FLUSH_MS` | 300000 | how often the API and worker write buffered lord statistics |

Gameplay constants are collected in `shared/core/src/balance.ts`. Values marked `(orig)` come from the original server; values marked `(evony)` fill gaps the original never implemented.
