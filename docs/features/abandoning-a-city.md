# Abandoning a city

**Status:** designed 2026-11-05, the maintainer's choices made. Nothing built. TODO.md item: *Abandoning a city.*

**The aim:** a player can give up a city they no longer want, above all to free a city slot. Prince, the last title, allows 10 cities (`maxCitiesFor`, `shared/core/src/titles.ts`), so a player holding 10 can break Atlantis and leave it at 0 loyalty but never capture it (`canHoldHistoric`, `engine/combat.ts`). Found simulating that attack, 2026-11-03 ([battle-sims/historic-cities.md](../battle-sims/historic-cities.md)).

## Where things stand

- **A player can't give up a city.** The only ways a city leaves a player today:

  | Path | Where | The tile afterwards | What it does with the rest |
  |---|---|---|---|
  | Teleport | `moveCity`, `services/interior.ts` | flat land | moves the whole city; refused with armies out or other players' troops there; valleys go free |
  | Restart or deleted player | `restartPlayer`, `services/player.ts` | flat land, a seat a whole historic city | deletes everything; other players' armies go home |
  | A seat taken by a rival | `takeSeat` and `clearSeat`, `engine/combat.ts` | stays a city, the winner's | heroes, armies, plan waves, orders and shipments lost; valleys go free; other cities' troops go home; troops gone |

- **Tiles keep their level** when a city leaves them: a captured level 10 barbarian city teleported away leaves a level 10 flat. Nothing brings a barbarian city back once it's captured, so their number only falls.
- **Player cities can't be captured** (deviations.md), only plundered. Only a seat can change hands.
- **Moving things out already works:** an army reinforcing the player's own city moves in for good, with its troops, goods and hero, the hero if the Feasting Hall there has a free slot (`engine/combat.ts`).

## What the original did

- **Our copy of the original server has no abandon command,** so this comes from guides, which are thin:
  - An abandoned city became a barbarian city of its level until the server's overnight maintenance removed it ([aeroagg-complete-guide.md](../reference/aeroagg-complete-guide.md), Taking NPC cities).
  - Players used it to make a barbarian city beside them to capture ([historic-cities.md](../reference/historic-cities.md), Requirements), and to start again with beginner protection (aeroagg, on chasing heroes).
  - Age 2's colonies took 24 hours to hand over, an item making it instant ([colonies.md](../reference/colonies.md)).
- **Not found:** what the original required first (empty of troops, heroes?), and what became of a historic city abandoned ([historic-cities.md](../reference/historic-cities.md), Not covered yet). One web search on 2026-11-05 found nothing for Age 1.

## Decided

**By the maintainer, 2026-11-05:**

- **Abandoning a city loses what's in it, on purpose.** Its heroes, its troops, its resources, its armies on the march, its market orders and its shipments are all gone, with nothing moved to another city or refunded, "so the player really needs to consider what they are doing". The warning has to make that very clear.
- **A seat taken by a rival loses everything in it too:** its old holder's heroes, armies, plan waves, market orders and shipments, with nothing moved to another city (built 2026-11-05, `clearSeat`). The two rules are the same, so a player can't keep more by being taken than by leaving.
- **Its valleys are released.**
- **The tile becomes flat land,** of the level it had, as teleporting and restarting leave it. Not a barbarian city as in the original: that needs a job to remove it overnight, and lets a player build a level 10 target beside them, with medals for each win and 10,000 prestige for each capture. It can be added later without undoing anything.
- **It takes 1 real hour, and can be cancelled until then** (`BALANCE.abandon.delayMs`, not scaled by `GAME_SPEED`). Meanwhile the city plays on as normal and can be attacked, and it still counts against the city limit.

**What follows from those (our reading):**

| Thing | When the hour is up |
|---|---|
| The player's heroes in the city, its mayor and locked heroes included | deleted |
| The city's troops at home, injured, in queues; fortifications; resources; buildings | gone with the city, no refund |
| Its armies in any state (waiting to leave, marching out, stationed elsewhere, coming home) | deleted, with their troops, goods and heroes, whatever they were on their way to do |
| Unsent plan waves from it | deleted (`war_plan_waves` cascades) |
| Market orders and shipments | deleted, the escrow and the goods on the road with them |
| Valleys | go free, a fresh garrison (`troops` and `state` cleared), any of the player's troops stationed there lost with the armies |
| Flows | a flow's chosen cities already skip one the player no longer owns (`engine/flows.ts`); a run under way there to be tested |

**Not lost with the city:**

- **Other players' troops,** stationed or on their way, go home (`turnHome`, as `restartPlayer`).
- **Running research** carries on: research is the player's, not the city's, so its timed event must survive.

**The rest of the rules:**

- **Refused for the player's last city:** there must be another city not itself being abandoned. Checked again when the hour is up; with none left, it's cancelled and the player told.
- **Any other city may go,** the first included, and a held seat too. A seat stands again whole, with full loyalty and nobody holding it, as when its holder restarts.
- **No cooldown:** with flat land, dropping a city gains nothing to repeat.
- **No item or gold to skip the hour.**
- **Attackers on their way** turn back on arrival (`army.nothingToAttack`); on a seat they carry on against the unheld city.
- **Prestige, honour and title stay.** Population and rankings follow from the next rankings job. A seat's tribute, state tribute and titles go with the city row. Reports and mail keep the city's name, as for a lost seat. **Beginner protection isn't reset:** starting again is what restarting is for.
- **Capture of a seat being abandoned** (`takeSeat`) cancels it: it's the winner's now, and nothing of it is deleted beyond what capture does. A restart deletes the city and its timed events, leaving nothing to do.

### The warning

- **In the city settings** (`city-dialog/city-form/abandon-city/`), under the teleport, in `LOSS_TEXT`, saying what abandoning does before the button.
- **The confirmation** (`ConfirmDialog`, whose `disabled` and `children` allow this) lists what this city would lose, with its real numbers: the heroes by name (locked ones too), troops at home and injured, resources, armies out with what's in them, valleys, market orders, shipments and unsent plan waves. **Its button stays disabled until the city's name is typed in,** as this can't be got back. It says plainly that an army sent away during the hour and still on the road when it ends is lost too.
- **While the hour runs:** a countdown with Cancel on the city's card in the list and in the settings, in `LOSS_TEXT`, repeated in a banner on the city's screens.
- **When it's done:** a report (`report.title.cityAbandoned`) naming the city. The client has no redirect for a city that's gone (`game.tsx`; `app.tsx` only sends unknown addresses to the first city), so a screen on it needs one: once `castles` no longer holds `nav.cityId`, go to the player's first city, keeping the screen.

### Known consequences

- **Move things out before starting, not during the hour.** Marches between far cities can take over an hour (Rome to Atlantis at 60× is 81 minutes), and an army still on the road when the hour ends is lost, so the hour can't be counted on as time to evacuate. The warning says so.
- **An hour doesn't stop every dodge.** A holder who sees a rival's army more than an hour out can drop a seat before it lands, denying the capture: the seat stands again unheld and at full loyalty. With a seat taken losing everything too, this costs the holder nothing a capture wouldn't: a holder about to lose a seat anyway can always deny it to the winner, given an hour's warning. It's left as it is. A longer delay, or refusing it while a rival's army is on its way, would close it if it turns out to be a problem.
- **The Atlantis case:** to have a slot free when the last wave lands, abandon a city that isn't in the plan, at least an hour before landing, with its troops and heroes moved out first.

## Bugs in the code nearby, all gone

Five went on 2026-11-05 with what caused them:

- **Prisoners being removed** ended another player's hero being deleted with the city and a captive's way home being lost.
- **Rising up being removed** ended armies, shipments and research being left stuck for good, as only a rising deleted their timed events.
- **A seat taken losing everything** ended the other city's mayor being sacked: it came from moving the seat's mayor there, and nothing moves now.

## How it would be built

- **Data:** `cities.abandon_at` (ms, 0 none), a generated migration.
- **Time:** a timed event `city.abandon`, ref `abandon:<cityId>`, handled in `events.ts`; the handler checks `abandon_at` is due, so a stale event does nothing. Clearing a city's timed events leaves research alone, or it would be stuck for good.
- **Code:** `engine/abandon.ts`, sharing with `clearSeat` what both do (what's lost, valleys, other players' troops).
- **API:** `POST /cities/{cityId}/abandon`, `DELETE /cities/{cityId}/abandon`, `abandonAt` on `CityBean`, then `npm run gen:api`.
- **Docs:** a `deviations.md` entry *(design change)*, `BALANCE.abandon`, text in every locale.
- **Tests:** `services/abandon.db.test.ts` for each row of the table, each refusal and each early end, with an army in every state.

## To watch

Once it's played: whether an hour proves too short as a safety net or against dodging.

## Phases

0. **A seat taken loses everything in it** (`clearSeat`). Done 2026-11-05.
1. **The server:** the rules, data, API, messages, `deviations.md` and tests.
2. **The client:** the settings section, the confirmation with its real numbers, the countdown and banner, the redirect, the locales.
