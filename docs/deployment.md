# Deployment

How to run Marchlands on a dedicated machine: installing it, moving the game over from another machine, HTTPS,
updates, backups and day-to-day operation. Everything runs in Docker Compose; the machine needs nothing else
except for the optional maintenance scripts (see [Maintenance scripts](#maintenance-scripts)).

The examples install into `/srv/marchlands` and use `game.example.com` as the domain. Replace both with yours.

## What runs

| Service | Image | Listens on | Public? | What it does |
|---|---|---|---|---|
| `postgres` | `postgres:17-alpine` | `127.0.0.1:5432` | no | the database; its data is the `marchlands_pgdata` volume |
| `migrate` | `marchlands/backend` | — | — | applies pending database migrations, then exits; runs before `api` and `worker` start |
| `api` | `marchlands/backend` | `127.0.0.1:3000` | no (through `web`) | HTTP API (`/api/v1`), WebSocket pushes (`/ws`), API docs (`/docs`) |
| `worker` | `marchlands/backend` | — | — | the game clock: seeds the world on first boot, runs timed events and periodic jobs |
| `web` | `marchlands/web` | `0.0.0.0:80` (or `127.0.0.1:8000` behind Caddy) | yes | nginx serving the browser client and proxying `/api`, `/ws` and `/docs` to `api` |
| `caddy` (optional, `https` profile) | `caddy:2.10-alpine` | `0.0.0.0:80`, `:443` | yes | HTTPS with automatic Let's Encrypt certificates, forwarding to `web` |
| `adminer` (optional, `tools` profile) | `adminer` | `127.0.0.1:8080` | no | a database browser, reached over an SSH tunnel |

Start order is enforced by Compose: `postgres` healthy → `migrate` finished successfully → `api` and `worker` →
`api` healthy → `web` → `caddy`. Every long-running service restarts automatically (`restart: unless-stopped`),
including after the machine reboots, as long as Docker itself starts at boot.

Two Compose files are used together:

- `docker-compose.yml`: the services, shared with development.
- `docker-compose.prod.yml`: the production differences. Secrets are required (no defaults), only `web` (or
  Caddy) is reachable from outside, container logs are rotated, and the optional Caddy service is defined.

Setting `COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml` in `.env` (the template does) makes every plain
`docker compose …` command use both. All commands below assume that and are run from `/srv/marchlands`.

## The machine

- **OS:** any 64-bit Linux that Docker supports (Ubuntu LTS or Debian is simplest). x86-64 or ARM64 both work:
  the images are built on the machine itself.
- **Memory:** 2 GB at least, 4 GB comfortable. Postgres is tuned for about that (`db/postgresql.conf`:
  `shared_buffers` 256 MB, `effective_cache_size` 768 MB); the API and worker use about 100 MB each.
- **Disk:** 20 GB or more. The database is small (a backup is a few MB) but images, build cache, logs and
  backups add up.
- **Network:** a fixed IP or a DNS name. For HTTPS, a domain whose DNS points at the machine, and ports 80 and 443
  reachable from the internet.
- **Software:** Docker Engine with the Compose plugin, version 2.24 or later (the overrides use `!override`).
  Git, to fetch the code. Node 24 only if you want the [maintenance scripts](#maintenance-scripts) on the host.

## First install

1. **Install Docker** (Engine and the Compose plugin) following <https://docs.docker.com/engine/install/>, make it
   start at boot and let your user run it:

   ```bash
   sudo systemctl enable --now docker
   sudo usermod -aG docker "$USER"   # then log out and back in
   docker compose version            # 2.24 or later
   ```

2. **Firewall.** Allow SSH and the web ports only:

   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp   # only with HTTPS
   sudo ufw enable
   ```

   Ports that Docker publishes bypass ufw on Linux. That is why `docker-compose.prod.yml` binds Postgres, the API
   and Adminer to `127.0.0.1`: the firewall alone would not keep them private.

3. **Get the code:**

   ```bash
   sudo mkdir -p /srv/marchlands && sudo chown "$USER" /srv/marchlands
   git clone <repository-url> /srv/marchlands
   cd /srv/marchlands
   ```

4. **Configure.** Copy the production template and fill it in:

   ```bash
   cp .env.production.example .env
   chmod 600 .env
   openssl rand -hex 32   # run twice: one value for POSTGRES_PASSWORD, one for JWT_SECRET
   ```

   In `.env`:
   - `POSTGRES_PASSWORD` and `JWT_SECRET`: the two generated values. Compose refuses to start without them.
     Put the same password into `DATABASE_URL` too (it is only used by the maintenance scripts).
   - `GAME_SPEED`: `1` is the original pace. The development stack usually runs faster (for example 60).
   - `ADMIN_USERNAMES`: your username, so your account is an operator. On an empty database the **first account
     ever registered** also becomes an operator, so register yours before anyone else can.
   - `WORLD_MAP` / `WORLD_SEED`: how the map is made on first boot. Ignored when you restore an existing game.
   - HTTPS: see [HTTPS](#https).
   - Every setting is listed in [Configuration](#configuration).

5. **Either start a new game, or bring over the existing one** ([Moving the game to this machine](#moving-the-game-to-this-machine)).
   For a new game:

   ```bash
   docker compose up -d --build
   ```

   The first build takes a few minutes. On first boot the worker creates the 800×800 map (a few seconds), then
   logs `world ready`.

6. **Check it** ([Checking that it works](#checking-that-it-works)), then set up [backups](#backups).

## Moving the game to this machine

To carry the current game over (players, cities, the map, everything), copy the database. The code and images
are rebuilt on the new machine; only the data moves.

**On the old machine** (for example the laptop), stop the services that change the game, then dump the
database:

```bash
docker compose stop api worker web
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > marchlands.dump
scp marchlands.dump <user>@<server>:/srv/marchlands/
```

Keep the old machine stopped from now on, or players could change a game that no longer counts.

**On the new machine**, after steps 1–4 of [First install](#first-install), and before starting anything else:

```bash
docker compose up -d postgres
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < marchlands.dump
docker compose up -d --build
```

- Restore into a **new, empty** database (a machine where Marchlands never ran, or after `docker compose down -v`).
  The worker sees the restored map and does not create a new one.
- `migrate` then applies any migrations the dump doesn't have yet.
- Everyone has to log in again: a new `JWT_SECRET` invalidates the old sessions.
- `GAME_SPEED`: timers already running (builds, marches, research) keep the end times they were given at the
  old speed. New ones use the new speed. Protection, truces and cooldowns are real time and unaffected.
- Delete `marchlands.dump` from both machines once the game runs, or keep it somewhere safe as a backup.

## HTTPS

Without a domain (a LAN or a test machine), `web` serves plain HTTP on port 80 and nothing else is needed.

With a domain, Caddy terminates HTTPS and gets and renews a Let's Encrypt certificate by itself:

1. Point the domain's DNS (an `A`, or `AAAA`, record) at the machine and open ports 80 and 443.
2. In `.env`:

   ```bash
   COMPOSE_PROFILES=https
   DOMAIN=game.example.com
   WEB_BIND=127.0.0.1
   WEB_PORT=8000
   ```

   (Caddy takes ports 80 and 443, so `web` moves to `127.0.0.1:8000`.)
3. `docker compose up -d`. The first request may take a few seconds while the certificate is issued
   (`docker compose logs caddy`). Plain `http://` is redirected to `https://`. Certificates live in the
   `marchlands_caddy-data` volume.

The client calls the API on the same origin (`/api`, `/ws`), so nothing else changes for HTTPS.

## Checking that it works

```bash
docker compose ps                 # postgres, api (healthy), worker, web up; migrate "Exited (0)"
docker compose logs migrate       # "migrations applied in …ms"
docker compose logs worker        # "world ready", then "worker started"
curl -s http://127.0.0.1:3000/health
```

Then open `http://<server>/` (or `https://game.example.com/`), register **your own account first** (it becomes
an operator on an empty database), and check `/docs` shows the API documentation.

For a full end-to-end check before inviting players, run the smoke tests against the API. They need Node 24 and
`npm ci` on the host ([Maintenance scripts](#maintenance-scripts)), create test players (named `alpha_…`,
`bravo_…`, `atk_…`, `def_…`, `mka…`, `mkb…`), and those must be deleted afterwards:

```bash
API=http://127.0.0.1:3000 npm run smoke
npm run delete-player -- <the test usernames>       # lists what it would delete
npm run delete-player -- <the test usernames> --yes
```

Run them only after your own account exists, or a test player becomes the first operator.

## Updating to a new version

Take a backup, fetch the code, rebuild, then restart:

```bash
cd /srv/marchlands
tools/ops/backup.sh
git pull
docker compose build
docker compose stop api worker
docker compose up -d
```

- `docker compose build` builds the new images while the game keeps running.
- `stop api worker`, then `up -d`: `migrate` applies any new migrations **before** the new API and worker start,
  so the old code never runs against a new schema. Players are disconnected for a few seconds and the client
  reconnects by itself.
- Check `docker compose ps` and `docker compose logs migrate api worker` afterwards.
- Old images pile up: `docker image prune -f` now and then (and `docker builder prune -f` for the build cache).

**Rolling back.** Migrations only go forward. To go back to an earlier version, restore the backup taken before
the update ([Restoring a backup](#restoring-a-backup)), then `git checkout <previous commit>`, build and start as
above. Anything players did since that backup is lost.

## Backups

`tools/ops/backup.sh` dumps the database (`pg_dump` custom format, a few MB) to `backups/` and deletes dumps
older than 14 days. `BACKUP_DIR` and `KEEP_DAYS` change both. Dumps are consistent while the game runs.

Schedule it with cron (`crontab -e`), for example every hour:

```cron
0 * * * *  /srv/marchlands/tools/ops/backup.sh >> /srv/marchlands/backups/backup.log 2>&1
```

Copy the backups off the machine as well (another machine, object storage, …): a backup on the same disk doesn't
survive the disk. For example, with `rsync` from another machine:

```bash
rsync -a <user>@<server>:/srv/marchlands/backups/ ./marchlands-backups/
```

### Restoring a backup

This replaces the whole game with the backup.

```bash
docker compose stop api worker web
docker compose down -v            # deletes the database volume (and the Caddy certificates)
docker compose up -d postgres
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < backups/marchlands-<time>.dump
docker compose up -d
```

`down -v` removes every volume of the project, including Caddy's certificates; Caddy gets new ones on start.
To keep them, remove only the database volume instead: `docker compose down` then
`docker volume rm marchlands_pgdata`.

Test a restore now and then, for example on another machine: a backup is only proven by restoring it.

## Day-to-day operations

| To | Run |
|---|---|
| See what runs | `docker compose ps` |
| Follow the logs | `docker compose logs -f api worker` (JSON lines; `--since 1h` to limit) |
| Restart a service | `docker compose restart api` |
| Stop the game | `docker compose stop` (`docker compose up -d` starts it again) |
| Open a database shell | `docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'` |
| Browse the database | `docker compose --profile tools up -d adminer`, then from your computer `ssh -L 8080:127.0.0.1:8080 <user>@<server>` and open `http://localhost:8080` (server `postgres`); `docker compose stop adminer` when done |
| Check disk use | `docker system df` |

- **Logs** are rotated by Docker: 5 files of 20 MB per container (`docker-compose.prod.yml`).
- **Operators:** the accounts in `ADMIN_USERNAMES`, plus the first account ever registered, have the operator
  tools in the client. Changing `ADMIN_USERNAMES` needs `docker compose up -d api`.
- **Changing a setting** in `.env`: `docker compose up -d` recreates the services whose settings changed.
- **Never** run `docker compose down -v` unless you mean to delete the game: `-v` deletes the database volume.

### Maintenance scripts

A few scripts run on the host, not in a container, and need Node 24 and the repository's packages:

```bash
# Node 24, e.g. from https://nodejs.org or your distribution's NodeSource packages
cd /srv/marchlands && npm ci
```

They connect with `DATABASE_URL` from `.env` (Postgres on `127.0.0.1`).

- `npm run delete-player -- <username>… [--yes]`: deletes accounts the way the game does (cities back to flat
  land, valleys released, empty alliances disbanded). Lists what it would delete until run with `--yes`. Never
  deletes operators. Never delete players with hand-written SQL.
- `npm run smoke`: end-to-end checks against a running API (`API=http://127.0.0.1:3000`); they create test
  players, so delete those afterwards.

## Configuration

Settings come from `.env` (template: `.env.production.example`). After changing one, `docker compose up -d`.

| Variable | Default | Used by | Meaning |
|---|---|---|---|
| `COMPOSE_FILE` | — | Compose | `docker-compose.yml:docker-compose.prod.yml` on the server |
| `COMPOSE_PROFILES` | — | Compose | `https` to run Caddy |
| `DOMAIN` | — | caddy | the domain Caddy serves and gets a certificate for |
| `POSTGRES_PASSWORD` | required | postgres, backend | database password |
| `JWT_SECRET` | required | api | signs login tokens (at least 8 characters; use 64 hex characters). Changing it logs everyone out |
| `POSTGRES_USER` / `POSTGRES_DB` | `marchlands` | postgres, backend | database user and name |
| `WEB_BIND` / `WEB_PORT` | `0.0.0.0` / `80` | web | where the client is served (`127.0.0.1` / `8000` behind Caddy) |
| `POSTGRES_PORT` / `API_PORT` / `ADMINER_PORT` | `5432` / `3000` / `8080` | — | their ports on `127.0.0.1` |
| `DATABASE_URL` | — | maintenance scripts | the database from the host (the containers build their own) |
| `GAME_SPEED` | `1` | api, worker | multiplies the speed of every game timer |
| `WORLD_MAP` | `generated` | worker | first boot only: `generated` (procedural) or `legacy` (the original layout) |
| `WORLD_SEED` | `marchlands` | worker | first boot only: the seed of the generated map |
| `ADMIN_USERNAMES` | — | api | usernames that are always operators (comma separated) |
| `LOG_LEVEL` | `info` | api | `trace` … `fatal` |
| `JWT_TTL` | `604800` | api | login lifetime in seconds (7 days) |
| `CORS_ORIGIN` | any | api | allowed browser origin for direct API calls; the client uses the same origin, so it rarely matters |
| `DB_POOL_SIZE` | `20` (api), `10` (worker) | api, worker | database connections per process (Postgres allows 200) |
| `WORKER_BATCH` / `WORKER_IDLE_MS` | `50` / `250` | worker | timed events claimed per round, and the pause when none are due |
| `STATS_FLUSH_MS` | `300000` | api, worker | how often player statistics are written (5 minutes) |

Set by the image, not in `.env`: `NODE_ENV=production` (JSON logs) and `WORLD_MAP_FILE` (the legacy map file).

## How the images are built

- **Backend** (`backend/Dockerfile`, one image for `migrate`, `api` and `worker`): a build stage installs the
  dependencies and bundles each entry point with esbuild (`tools/build/backend.mjs --minify`) into
  `dist/backend/bin/{api,worker,migrate}.mjs`, fully minified (function names too). The runtime stage is plain
  Alpine with only the `node` binary, the bundles and their source maps, the SQL migrations, Swagger UI's assets
  and the legacy map: no TypeScript sources, no `node_modules`, no npm (about 150 MB).
- **Source maps** (`dist/backend-maps/`) are in the image but Node never loads them: running with
  `--enable-source-maps` would cost about 45 MB per process. They are read only when you decode a stack trace
  ([Reading a stack trace](#reading-a-stack-trace)). They have to come from the same build as the bundles:
  esbuild names minified symbols differently on macOS and Linux, so maps from a build on your laptop don't fit
  the server's bundles.
- **Web** (`client/web/Dockerfile`): Vite builds the client and `tools/build/precompress.mjs` gzips its text files once, at
  the highest level; nginx (`client/web/nginx.conf`) sends those `.gz` copies as they are (`gzip_static`) and
  compresses API responses (JSON) on the fly. The first page is about 270 kB over the wire (three JavaScript files and
  the stylesheet); the game tabs and any language but English are separate files, fetched when needed. Hashed files
  under `/assets/` are cached for a year, `index.html` is always revalidated, so a deploy reaches players on their
  next page load. A page left open across a deploy reloads itself if it asks for a file the deploy removed.
- Development and the tests run the TypeScript sources directly; only the images use the bundles. A new backend
  dependency that reads its own files at run time must be listed in `OWN_FILES` in `tools/build/backend.mjs`;
  check one with a rebuilt image (`docker compose build && docker compose up -d`, then exercise it).

## Reading a stack trace

Errors are logged with their stack trace (`docker compose logs api worker`), but the positions point into the
minified bundles (`file:///app/dist/backend/bin/worker.mjs:13:17214`) and the function names are minified. The
image's trace tool maps them back to the source, using the source maps of that same image:

```bash
docker compose logs --no-log-prefix --since 1h worker | docker compose exec -T worker node tools/build/trace.mjs
```

Or save the log lines (or a pasted stack trace) to a file first:
`docker compose exec -T api node tools/build/trace.mjs < trace.txt`. It accepts plain stack traces and the JSON log
lines as they are. A frame like `at Q5 (file:///app/dist/backend/bin/worker.mjs:1:2345)` becomes
`at Q5 (backend/services/worker/src/main.ts:26:16)`; the file, line and column are the source's, and the function
name stays minified. Run it in a container of the image that logged the error: after an update, the new image's
maps no longer fit older log lines.

For errors you want to hear about without reading logs, see the error-tracking note in
[backlog.md](backlog.md#operations).

## Security checklist

- [ ] `.env` has generated `POSTGRES_PASSWORD` and `JWT_SECRET`, and is `chmod 600`.
- [ ] `COMPOSE_FILE` includes `docker-compose.prod.yml` (`docker compose config | grep host_ip` shows
      `127.0.0.1` for postgres and api).
- [ ] The firewall allows only SSH, 80 and 443.
- [ ] HTTPS is on if the game is reachable from the internet.
- [ ] Your account is an operator, registered before the game was opened to anyone.
- [ ] Hourly backups run, and are copied off the machine.
- [ ] SSH uses keys, not passwords; the OS gets security updates (`unattended-upgrades` on Ubuntu/Debian).
- [ ] Adminer runs only while you use it, through an SSH tunnel.

## Troubleshooting

| Symptom | Look at |
|---|---|
| `docker compose` says `required variable … is missing a value` | `POSTGRES_PASSWORD` or `JWT_SECRET` is empty in `.env` |
| `api` and `worker` never start | `docker compose logs migrate`: a failed migration stops them. Fix the cause, then `docker compose up -d` |
| `api` stays unhealthy | `docker compose logs api` (for example `JWT_SECRET must be at least 8 characters`, or no database) |
| The site loads but every request fails | is `api` healthy? `web` proxies `/api` and `/ws` to it |
| No HTTPS certificate | `docker compose logs caddy`: DNS must point at the machine and ports 80/443 be reachable |
| Timers don't finish, no world | `docker compose logs worker` |
| The disk fills up | `docker system df`; `docker image prune -f`, `docker builder prune -f`; old backups (`KEEP_DAYS`) |
| Lost the database password | it is in `.env`. Changing `POSTGRES_PASSWORD` later doesn't change it inside an existing database: change it there too (`ALTER USER marchlands PASSWORD '…'` in the database shell) |
