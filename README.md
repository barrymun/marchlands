# evony-re

A from-scratch TypeScript rewrite of the **Evony (Age 1)** game server. It is based on the open-source C++ server *Spitfire* (`../evony-private-server`) and the Age 1 battle calculator (`../EvonyAge1BattleCalc`).

The original spoke AMF3 over a raw socket to a Flash client. This server instead offers:

- a **REST + JSON API** (OpenAPI docs at `/docs`) for every client command;
- a **WebSocket** at `/ws` for the live `server.*` push messages;

so a new client can be written in anything.

The original left a lot unimplemented: attacks, transport, reinforcement, the market, quests, friends, alliance permissions and more. This rewrite implements a complete, playable game. Each formula the original *did* have is ported exactly. The battle simulator is bit-exact against all 36,567 regression cases of the original calculator. The gaps are filled following Evony Age 1, and every deviation is listed in [docs/deviations.md](docs/deviations.md).

## Quick start

```bash
cp .env.example .env          # adjust ports / secrets if needed
docker compose up -d --build  # postgres, migrate (one-shot), worker, api
```

- API: http://localhost:3000/api/v1 (`API_PORT`)
- Interactive docs: http://localhost:3000/docs
- WebSocket: ws://localhost:3000/ws?token=JWT
- Database browser: `docker compose --profile tools up -d adminer`, then http://localhost:8080

On first boot the worker seeds the 800×800 world. It uses a procedural map by default; set `WORLD_MAP=legacy` to use the original `s2` tile layout instead. The **first account registered becomes an operator**, and so do any usernames listed in `ADMIN_USERNAMES`.

Set `GAME_SPEED=50` (or higher) to make every timer, production and march faster. This is handy while developing.

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
evony-re/
├── docker-compose.yml        postgres · migrate · worker · api · (adminer)
├── backend/                  TypeScript (Node 24 runs .ts directly — no build step)
│   ├── Dockerfile            one image for every backend service
│   ├── packages/
│   │   ├── core/             pure game rules: static data, economy, construction, heroes,
│   │   │                     troops & marching, battle simulator, map generation, items, quests
│   │   ├── db/               Drizzle schema, SQL migrations, connection helpers
│   │   └── game/             transactional game services shared by api + worker
│   │                         (one service module per original packet group)
│   └── services/
│       ├── api/              Fastify HTTP API + WebSocket push gateway
│       └── worker/           game clock: timed events (builds, research, training, marches,
│                             battles, deliveries, buff expiry) + periodic jobs
├── db/                       postgres config, init scripts, seed data (legacy map)
├── client/                   (future) game client
├── docs/
│   ├── architecture.md       how it fits together
│   ├── api-endpoints.md      every endpoint, mapped to the original commands
│   ├── websocket.md          push messages
│   ├── deviations.md         what differs from the C++ server and why
│   └── spec/                 reverse-engineering specs of the original server
└── tools/
    ├── legacy-import/        converts the original MySQL dumps into data files
    ├── smoke/                end-to-end scenario tests against a running stack
    └── docs/                 doc generators
```

## Development

```bash
npm install
docker compose up -d postgres
npm run db:migrate                      # uses DATABASE_URL from .env
npm run dev:worker                      # in one terminal
npm run dev:api                         # in another (pretty logs, auto-reload)

npm run typecheck
npm test                                # unit tests incl. the 36k-case battle regression suite
API=http://localhost:3000 npm run smoke # end-to-end scenarios (needs GAME_SPEED>=50 and an operator)
```

To change the schema, edit `backend/packages/db/src/schema.ts`, then run `npm run db:generate` to write a new SQL migration into `backend/packages/db/migrations`.

To rebuild the static game data from the original dumps, run `npm run legacy:convert -- ../evony-private-server/DB`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `evony` | database credentials |
| `POSTGRES_PORT`, `API_PORT` | 5432, 3000 | host ports |
| `DATABASE_URL` | – | for services run outside docker |
| `JWT_SECRET` | `change-me-in-production` | token signing key (**change it**) |
| `JWT_TTL` | 604800 | token lifetime, seconds |
| `GAME_SPEED` | 1 | multiplies the speed of every timer and of production |
| `WORLD_MAP` | `generated` | `generated` (procedural) or `legacy` (original s2 layout) |
| `WORLD_SEED` | `evony` | seed of the procedural map |
| `ADMIN_USERNAMES` | – | comma-separated usernames that are operators |
| `CORS_ORIGIN` | any | allowed browser origin(s) |
| `LOG_LEVEL` | `info` | pino log level |
| `WORKER_BATCH`, `WORKER_IDLE_MS` | 50, 250 | worker tuning |

Gameplay constants are collected in `backend/packages/core/src/balance.ts`. Values marked `(orig)` come from the original server; values marked `(evony)` fill gaps the original never implemented.
