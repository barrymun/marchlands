# Camp times: armies that land at a chosen second

**Status:** phase 1 built 2026-11-01 (landing at a chosen second, in order, by the server's clock); the wave planner and alliance plans are later phases. Started 2026-11-01. TODO.md item: *Camp times: arrive at an exact time.* Wanted first for the historical cities ([historical-cities.md](historical-cities.md)), whose garrisons refill between waves: breaking one takes many armies landing together, in a set order.

**The aim:** a player sends an army to land on a tile at a time they choose, to the second, so that waves from several cities (theirs, and later their alliance's) arrive together and in order: the trap clearers, then the main army, then the loyalty waves.

## Where things stand

- **An army leaves at once** (`sendArmy`, `backend/packages/game/src/services/armies.ts`): it arrives after its march time (`marchTimeMs`), which the send-army dialog shows. Nothing lets it leave later.
- **Camping exists, but only at the target, after it lands:** `restTime` (up to `BALANCE.maxRestTimeMs`, 24 hours) keeps an army that stays (reinforcing) there for a while before it goes home (`processArmy`, `engine/combat.ts`). The send-army dialog doesn't offer it.
- **When an army lands:** its timed event is due at `reachTime`. The worker claims due events one at a time, oldest `due_at` first (`processOne`, `backend/services/worker/src/worker.ts`), and looks again every 250 ms when none is due (`WORKER_IDLE_MS`). So:
  - armies due in the same millisecond are taken **in no fixed order** (`order by due_at` alone);
  - the battle is fought at the time the worker gets to it (`ctx.now`), a fraction of a second after `reachTime`, or more when the worker is busy;
  - each arrival is its own transaction, so one wave's battle is finished and saved before the next one starts.
- **NPC garrisons refill on a clock:** an NPC city or valley regains 10% of its full troops and fortifications every 6 game minutes (`BALANCE.npcRegenMs`, `regenerateNpc` in `shared/core/src/world.ts`), counted from when it was last refilled, and 1 loyalty every 6 real minutes. A wave that lands after a refill meets the traps and troops the earlier waves destroyed, partly rebuilt.
- **How Age 2 did it** ([reference/historic-cities.md](../reference/historic-cities.md), Timing): the send dialog showed when an army would arrive, and a *camp time* (minutes to wait at home before marching) set it to land at a chosen clock time. Players breaking a historic city landed waves 1 to 20 seconds apart from several nearby cities. The time shown followed the player's own computer clock, and the server was a few seconds late, so players measured the lag on a nearby target first and allowed for it.
- **Times are shown in the player's local time** (`dateTime`, `clockTime` in `client/web/src/lib/format.ts`), and the client's clock is trusted as it is: nothing corrects a device whose clock is a few seconds out.

## Decided

- **The army waits at home** (2026-11-01), as with Age 2's camp time: it leaves its city at the moment that lands it on time, and the target sees nothing until it marches.
- **Armies landing on one tile in the same second fight in the order they were sent** (2026-11-01): no wave number to fill in.
- **Historic cities refill every second** (2026-11-01, [historical-cities.md](historical-cities.md)), so a gap between waves always costs the attacker and landing them together is worth the precision.
- **A landing time, entered in UTC** (2026-11-01): the send-army dialog takes a date and a time to the second (UTC), offers a round minute just after the soonest landing, and shows when the army will leave. It stays set after sending, so the next wave lands in the same second.
- **Up to 24 hours ahead** (`BALANCE.landAtMaxAheadMs`), like the rest time.
- **Ties keep their order; the battle is still fought when the worker gets to it** (2026-11-01). The worker takes due events by `due_at`, then `id`, and an arrival is fought at `ctx.now`, a fraction of a second after `reachTime` (250 ms at most when idle). With today's 6-minute refills that can't change a result; when NPC garrisons refill every second (TODO.md) an arrival should be fought as of its `reachTime`, so a busy worker can't hand the garrison extra seconds. That goes with the per-second refill.
- **Rest time stays as it is** (camping at the target after landing, not offered in the dialog).

## The design (proposed)

### Choosing when it lands

- The send-army dialog gets a choice: **leave now** (as today) or **land at** a time, entered in UTC to the second (`hh:mm:ss`, and the date when it's not today). It shows when the army would leave, and refuses a time sooner than the march allows.
- **The army waits at home, then marches:** the server works out when it must leave (the landing time less the march time, fixed when it's sent) and holds it until then. Its troops, hero and resources leave the city's garrison at once, and it takes one of the Rally Spot's army slots, so waiting is a commitment. Recalling it before it leaves puts everything back at once.
- **Nobody else sees it until it leaves:** a waiting army is in its own player's armies list ("leaves at …"), not in the target's incoming attacks. Once it marches it shows as any army does.
- **Landing exactly together:** an army set to land at a second lands on that second's first millisecond. Armies landing on the same tile in the same second fight **in the order they were sent** (Decided), so the trap clearers are sent first.

### Fair timing on the server

- **Ties in order:** the worker takes due events by `due_at`, then by the order they were created, so the sending order holds.
- **The battle at the landing time:** an arrival is fought as of its `reachTime`, not the moment the worker gets to it, at least for what the clock decides (an NPC garrison's refills, loyalty, buffs running out). A busy worker then can't change the result.

### A clock players can trust

- **Server time on screen:** the game shows the server's time in UTC, to the second, near where armies are sent (the send-army dialog, the armies list).
- **The client's clock corrected:** the client measures how far its clock is from the server's (from the API's responses or the push socket) and uses the server's time for every countdown and for the landing time it sends.

### Later

- **Plans for several waves:** a planner listing waves from one or more cities, each with its troops, hero and order, all landing on one target at one time.
- **Alliance plans:** members add their own waves to a shared plan; each player still sends their own armies.

## Open questions

- **Fighting at the landing time:** fight each arrival as of its `reachTime` (its refills, loyalty, buffs running out) rather than when the worker takes it; with the per-second refill (Decided).
- **Things that change a march on the way:** Marchlands has none (Age 2's stratagems slowed or sped marching armies; we have no stratagems, [reference/items.md](../reference/items.md)). If one is ever added, a landing time would no longer hold.

## Phases

1. **Land at a time** (built 2026-11-01): the server side (holding an army, leaving on time, the order of ties, fighting at `reachTime`), the dialog's landing time in UTC, server time on screen and the client's clock corrected. Tested with the database tests (`test/services/armies-land-at.db.test.ts`; the worker's order in `worker.db.test.ts`) and the dialog on the running stack. Not yet: the waiting army in the armies list and its target's view, tried in the browser (a new account has no Rally Spot).
2. **The wave planner,** for one player's cities.
3. **Alliance plans.**
