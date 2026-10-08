# db

Postgres-side assets. The schema and migrations live with the code in
`backend/packages/db` (Drizzle; SQL migrations in `backend/packages/db/migrations`) and are
applied by the one-shot `migrate` compose service.

| Path | Purpose |
|---|---|
| `postgresql.conf` | server tuning mounted into the postgres container |
| `init/` | scripts run once when the data volume is first created (extensions) |
| `seed/legacy-map-800.bin.gz` | the original `s2` 800x800 tile layout (`[type, level]` per tile id), produced by `tools/legacy-import/convert.mjs`; used when `WORLD_MAP=legacy` |

Reset the world: `docker compose down -v && docker compose up -d` (deletes all data).
Backup: `docker compose exec postgres pg_dump -U marchlands marchlands > backup.sql`.
