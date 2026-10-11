# Backlog

Design notes and known quirks to come back to. Each entry says what happens now, where, and why it was left. Rules that already differ from the original server are in [deviations.md](deviations.md); move an entry there once it is decided and built.

## Design ideas

- **Valley upgrades and flat land.** `upgradeValley` (`backend/packages/game/src/services/combat.ts`) accepts flat land, because `VALLEY_TYPES` includes `TileType.FLAT`, and the client offers it. Flat land can never be attacked or held, so the upgrade only raises the tile's level. That level stays with the tile: settling or teleporting a city onto it keeps it under the city, and teleporting away leaves a flat of that same level behind (`interior.moveCity` only changes the tile's type). Generated flats are levels 1–10, low levels more common. Kept for now; there are ideas for what upgraded flats could mean.

## Known quirks

- **An unreachable refusal in `trainSplit`.** `training.trainSplit` refuses a fortification with `training.fortsAtWalls`, but `assertCanTrain(…, fort = false)` refuses it first with the vaguer `common.invalidTroopType` (`backend/packages/game/src/services/training.ts`). The request is refused either way; only the message is less specific. Fix: check for a fortification before `assertCanTrain`, or drop the second check.
- **`readReport` returns the read flag from before it was opened.** It reports `isRead: false` the first time a report is opened (and marks it read), while `mail.readMail` returns `isRead: true` (`backend/packages/game/src/services/reports.ts`). The client does not use the flag from this response.
- **Alliance member counts can be stale.** `alliances.memberCount` is only refreshed by `refreshAllianceStats` (the rankings job), so `allianceInfo`, `listAlliances` and `myInvites` show the count from the last refresh, while `myAlliance` counts live (`backend/packages/game/src/services/alliance.ts`). Accepted for now.
- **Rescheduling a timed event keeps its old player and city.** `flush` (`backend/packages/game/src/context.ts`) upserts a timed event by its ref key, updating its time, payload and type but not `player_id` / `city_id`. No caller reuses a key for another player or city today.
- **A failed stats write loses fractions.** When `flushStats` (`backend/packages/game/src/stats.ts`) fails it puts the counters back for the next try, but already rounded.
- **An empty `?techId=` reads as tech 0.** The research speed-up cost route coerces an empty query value to 0 and answers `research.notResearching` for it, instead of refusing the request.
