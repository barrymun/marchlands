# Backlog

Design notes and known quirks to come back to. Each entry says what happens now, where, and why it was left. Rules that already differ from the original server are in [deviations.md](deviations.md); move an entry there once it is decided and built.

## Design ideas

- **Valley upgrades and flat land.** `upgradeValley` (`backend/packages/game/src/services/combat.ts`) accepts flat land, because `VALLEY_TYPES` includes `TileType.FLAT`, and the client offers it. Flat land can never be attacked or held, so the upgrade only raises the tile's level. That level stays with the tile: settling or teleporting a city onto it keeps it under the city, and teleporting away leaves a flat of that same level behind (`interior.moveCity` only changes the tile's type). Generated flats are levels 1–10, low levels more common. Kept for now; there are ideas for what upgraded flats could mean.

## Known quirks

- **An unreachable refusal in `trainSplit`.** `training.trainSplit` refuses a fortification with `training.fortsAtWalls`, but `assertCanTrain(…, fort = false)` refuses it first with the vaguer `common.invalidTroopType` (`backend/packages/game/src/services/training.ts`). The request is refused either way; only the message is less specific. Fix: check for a fortification before `assertCanTrain`, or drop the second check.
- **`readReport` returns the read flag from before it was opened.** It reports `isRead: false` the first time a report is opened (and marks it read), while `mail.readMail` returns `isRead: true` (`backend/packages/game/src/services/reports.ts`). The client does not use the flag from this response.
- **Alliance member counts can be stale.** `alliances.memberCount` is only refreshed by `refreshAllianceStats` (the rankings job, `backend/packages/game/src/engine/alliance.ts`), so `allianceInfo`, `listAlliances` and `myInvites` show the count from the last refresh, while `myAlliance` counts live (`backend/packages/game/src/services/alliance.ts`). Accepted for now.
- **Rescheduling a timed event keeps its old player and city.** `flush` (`backend/packages/game/src/context.ts`) upserts a timed event by its ref key, updating its time, payload and type but not `player_id` / `city_id`. No caller reuses a key for another player or city today.
- **A failed stats write loses fractions.** When `flushStats` (`backend/packages/game/src/stats.ts`) fails it puts the counters back for the next try, but already rounded.
- **An empty `?techId=` reads as tech 0.** The research speed-up cost route coerces an empty query value to 0 and answers `research.notResearching` for it, instead of refusing the request.

## Operations

- **Error tracking (alerts and grouping) instead of reading logs.** Today errors only reach the container logs, and production stack traces are decoded by hand with the image's trace tool ([deployment.md, Reading a stack trace](deployment.md#reading-a-stack-trace)). The bundles are fully minified and their source maps ship in the image unused, because Node's `--enable-source-maps` costs about 45 MB per process (measured on the API: 85 MB → 130 MB at steady state). An error tracker would email on new errors, group repeats and show source-mapped traces itself (maps uploaded per release at build time, e.g. with `sentry-cli`). It does not save memory: it adds an SDK to the API and the worker (to measure; likely 10–40 MB each with performance tracing off) and, if self-hosted, the tracker itself. Options weighed in October 2026:
  - *Sentry self-hosted*: about 16 GB of RAM and around 40 containers; far too heavy for one game server.
  - *GlitchTip*: MIT, uses the Sentry SDKs, about 256–512 MB (web, worker, Postgres, optionally Redis/Valkey), source maps uploaded per release with `sentry-cli` or its own CLI (reportedly not the newer debug-ID uploads), needs a persistent volume for them, also does uptime checks. The best open-source fit: its own database in the existing Postgres, on a machine with 4 GB or more.
  - *Bugsink*: one container on SQLite, Sentry-SDK compatible, lists source-map support; source-available under Polyform Shield (free for your own use, not OSI open source).
  - *A hosted service* (Sentry's free tier, small monthly quota): no RAM on the machine and no upkeep, and it still alerts when the machine itself is down; the data leaves the machine.
  - Whichever is chosen, add an external uptime check too: a tracker on the same machine can't report that machine going down.
  - Sources: [Sentry self-hosted requirements](https://shop.zimaspace.com/pages/sentry-self-hosted-hardware-requirements), [SSD Nodes on Sentry alternatives](https://www.ssdnodes.com/learn/lang/de/self-hosted-error-tracking-sentry-alternatives), [GlitchTip CLI](https://glitchtip.com/documentation/cli), [GlitchTip source maps with sentry-cli](https://glitchtip.com/blog/2022-04-25-glitchtip-1-12), [GlitchTip source maps need a volume](https://railway.com/deploy/sentry-compatible-error-tracking-glitchtip-v623-source-maps-survive-redeploys--sentry-compatible-error-tracking-or-glit), [Bugsink overview](https://noted.lol/bugsink/), [Bugsink licence](https://openapps.pro/apps/bugsink).
