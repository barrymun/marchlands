# Inactive holders of historic cities

**Status:** proposed 2026-11-07, for the maintainer to decide. Nothing is built. TODO.md item: *Inactive holders of historic cities.*

**The aim:** with PvP off nobody can take a historic city from its holder ([deviations.md](../deviations.md), Switched off for now), so a player who stops playing would keep it for good, and with a capital or Atlantis its title, tribute and share of market fees too. Nobody could ever win them again. The rule frees a city like that, without touching anyone who is still playing or away for a while on purpose.

## Where things stand

- **What frees a held seat today:** a rival taking it (PvP on only), its holder abandoning it, restarting or being deleted ([abandoning-a-city.md](abandoning-a-city.md)). `releaseCityTile` (`engine/city-loss.ts`) then stands it up again whole, with full loyalty and nobody holding it. Its title and a capital's rule over its state are worked out from who holds it, so they go by themselves (`seatTitles`, `stateRulers`).
- **This goes against one decision, in part.** On 2026-11-05 the maintainer removed upkeep and unrest, so a seat "stays held whatever it lacks, until a rival takes it or its holder leaves the game" ([historical-cities.md](historical-cities.md), Holding costs and rewards). That was while a rival could still take one. This rule asks nothing of a holder who is playing, only that they haven't left in all but name.
- **What the game knows of activity:** `players.lastSeenAt`, written at sign-in and when a socket opens or closes (`ws/gateway.ts`), and shown in the alliance's member list. It is **not** written while a socket stays open, and the worker can't see the API's sockets, so someone with a tab open for weeks looks absent. That needs fixing first (Phases).
- **Holiday mode** already says "I'm away on purpose": up to 30 days, paid for in gold, all armies home first (`services/player.ts`).
- **The game sends no real email.** Its mail is in-game only, so a warning can't reach someone who has stopped signing in, and anyone who signs in to read one has already reset the clock.
- **A holder always has a regular city** (abandoning-a-city.md), so the rule never leaves anyone with no city.

## What the original did

Not found. One web search on 2026-11-07 found nothing on what became of a historic city whose holder went inactive, or on Evony deleting inactive accounts. In the original a rival simply took it, which is what PvP on does here.

## The rule (proposed)

**A held historic city stands again once its holder has been away too long, while PvP is off.**

| | Proposed | Why |
|---|---|---|
| **Which cities** | Held historic cities only | Regular cities harm nobody, and flat land is plentiful. A player's valleys also can't be taken, but there are many and each is worth little (Open questions) |
| **When it applies** | Only with PvP off | With PvP on, rivals deal with an empty seat, as they always have |
| **How long away** | 14 real days for a capital (16) or Atlantis (18), 30 for a level 12 or 14 | The few cities everyone wants shouldn't sit empty for a month; there are 1,795 level 12s, so one held by an absent player costs nobody much. In `BALANCE.historic`, not scaled by `GAME_SPEED` |
| **What counts as being there** | Signing in, or having the game open | A low bar on purpose: the rule is for cities nobody is looking after, not for judging how well someone plays. Flows running by themselves don't count |
| **The clock starts from** | The latest of `lastSeenAt`, the end of a running holiday, and when the seat was captured | Holiday mode is the way to be away for longer, and a flow capturing a seat while its holder is away starts its clock afresh |
| **What happens** | The seat stands again whole, as when abandoned (`releaseCityTile`) | The same place, the same state, no new rules for what comes after. Its valleys go free and other players' troops go home |
| **What's in it** | Troops at home, injured troops and resources go to the holder's other cities, and heroes to a free Feasting Hall slot, as moving out does (`moveOutCity`). Armies still out, heroes with no slot and research running there are lost | See below |
| **Telling the holder** | A report waiting for them when they return, saying what happened and where things went; and a line on the seat's card while they hold it, saying how long they may be away | There's no way to warn someone who isn't signing in |
| **Telling everyone else** | A message to all players when a capital or Atlantis stands again; nothing for levels 12 and 14 | So those are a fair race rather than won by whoever noticed. There are too many of the others to announce |

**Why not lose everything in it, as abandoning does?** The maintainer chose that for abandoning "so the player really needs to consider what they are doing", and for a seat taken by a rival so that nobody can keep more by being beaten. Neither reason fits here: the player chose nothing, and might be back after an illness or a long trip. Losing the city itself is enough. Nobody gains by this, since going away for two weeks or more costs far more than moving troops by hand. This is the one place it differs from the rule the maintainer set, so it's the first question below.

### Other ways considered

- **Let rivals attack an absent holder's seat, as with PvP on.** Keeps the siege and hands the winner the city without a reset, but it brings attacks on players back into a release without them, against whatever troops were left there, which may be too many to break or none at all.
- **Hand it to the holder's alliance.** Would let an alliance gain a city with no siege, and needs a member with a free slot under the holding limits. An alliance can still win it back in the open.
- **Upkeep or unrest.** Built and removed on 2026-11-05 (above): they punish players who are playing. This rule doesn't.
- **Counting only game actions as being there.** Harder to satisfy by accident but no harder on purpose: anyone determined to hold a city can do one action a fortnight. It would catch people who look in and do nothing, who are the least harm.

### What it can't do

Someone who signs in once a fortnight only to keep a capital keeps it. This rule frees cities nobody is looking after, and only PvP, or a limit of a different kind, can deal with that. An open tab also counts, and that is accepted.

## Open questions

1. **What's in the city:** moved out as proposed, or lost as when abandoning? (Above.)
2. **The clocks:** 14 and 30 days, or something else?
3. **Announcing:** capitals and Atlantis only, or none?
4. **Valleys held by an absent player:** left alone as proposed, or freed by the same rule? Freeing them is little work once this exists, if players ever run short.
5. **Should other players see it coming?** Proposed no: a holder's absence stays private beyond what the alliance's member list already shows, and a whole garrison gives nobody an instant win anyway. The alternative is a note on the seat's card some days before.
6. **Banned accounts:** a banned player can't sign in, so the clock should run out by itself. To check when building: that a ban also closes their open socket.

## Phases

1. **Seeing who's there:** write `lastSeenAt` about once an hour while a socket stays open (`ws/gateway.ts`, one update for all connected players), so it can be trusted. No rule changes; useful for the member list anyway.
2. **The rule:** a pure function in core for when a seat lapses (level, last seen, holiday end, capture time), with tests at each edge; `seatLapsedJob` in the worker, hourly, doing nothing with PvP on; the release shared with `completeAbandon` and the moving out with `moveOutCity`. Service tests for each row of the table above, including PvP on, holiday, returning a minute before, and a capital's state going back to its faction.
3. **What players see:** the report, the line on the seat's card and the announcement, in every locale. The rule change in deviations.md, *(design change)*.
