# Abandoning a city

**Status:** built 2026-11-05 (the server, the client and the decisions below).

**The aim:** a player can give up a city they no longer want, above all to free a city slot. Prince, the last title, allows 10 cities (`maxCitiesFor`, `shared/core/src/titles.ts`), so a player holding 10 can break Atlantis and leave it at 0 loyalty but never capture it (`canHoldHistoric`, `engine/combat.ts`). Found simulating that attack, 2026-11-03 ([battle-sims/historic-cities.md](../battle-sims/historic-cities.md)).

## Where things stand

- **Before this, a player couldn't give up a city.** The other ways a city leaves a player:

  | Path | Where | The tile afterwards | What it does with the rest |
  |---|---|---|---|
  | Teleport | `moveCity`, `services/interior.ts` | flat land | moves the whole city; refused with armies out or other players' troops there; valleys go free |
  | Restart or deleted player | `restartPlayer`, `services/player.ts` | flat land, a seat a whole historic city | deletes everything; other players' armies go home |
  | A seat taken by a rival | `takeSeat`, `engine/combat.ts`, and `loseCityContents`, `engine/city-loss.ts` | stays a city, the winner's | heroes, armies, research running there, plan waves, orders and shipments lost; valleys go free; other cities' troops go home; troops gone |

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
- **A seat taken by a rival loses everything in it too:** its old holder's heroes, armies, plan waves, market orders and shipments and the research running there, with nothing moved to another city (built 2026-11-05, `loseCityContents`). The two rules are the same, so a player can't keep more by being taken than by leaving.
- **Research running in the city is cancelled, with no refund** (the maintainer, 2026-11-05): the player starts it again in another city. Its level stays. Left running, it couldn't be cancelled or sped up, both needing the city, and its tech stayed blocked until it finished.
- **Its valleys are released.**
- **The tile becomes flat land,** of the level it had, as teleporting and restarting leave it. Not a barbarian city as in the original: that needs a job to remove it overnight, and lets a player build a level 10 target beside them, with medals for each win and 10,000 prestige for each capture. It can be added later without undoing anything.
- **It takes 1 real hour, and can be cancelled until then** (`BALANCE.abandon.delayMs`, not scaled by `GAME_SPEED`). Meanwhile the city plays on as normal and can be attacked, and it still counts against the city limit.

**What follows from those (our reading):**

| Thing | When the hour is up |
|---|---|
| The player's heroes in the city, its mayor and locked heroes included | deleted |
| The city's troops at home, injured, in queues; fortifications; resources; buildings | gone with the city, no refund |
| Its armies in any state (waiting to leave, marching out, stationed elsewhere, coming home) | deleted, with their troops, goods and heroes, whatever they were on their way to do |
| Research running in it | cancelled, no refund; the level stays |
| Unsent plan waves from it | deleted (`war_plan_waves` cascades) |
| Market orders and shipments | deleted, the escrow and the goods on the road with them |
| Valleys | go free, a fresh garrison (`troops` and `state` cleared), any of the player's troops stationed there lost with the armies |
| Flows | it goes from every flow of the player's when the hour ends: its targets, the cities chosen, a run under way (`dropCityFromFlows`, `engine/flows.ts`). A flow that chose only that city stays, with none, and won't run until one is chosen. The last run's report keeps it. During the hour it stays in them, so calling it off changes nothing, and flows skip it (`planCities`, `runPart`) |

**Not lost with the city:**

- **Other cities' troops,** the player's own included, stationed there or reinforcing or transporting on their way there, go home (`sendBack`, `turnHome`).

**The rest of the rules:**

- **A player always keeps at least one regular city** (the maintainer, 2026-11-05): their last city can't be abandoned, and their last city can't be a historic city, as a rival can capture one and a regular city can't be captured. So abandoning a regular city is refused unless another regular city remains that isn't itself being abandoned. Checked again when the hour is up; with none left, it's cancelled and the player told. This is what stops a seat being taken from ever leaving a player with no city. A barbarian city the player captured counts as regular: it has no loyalty once it's theirs.
- **Any other city may go,** the first included, and a held seat whenever a regular city remains. A seat stands again whole, with full loyalty and nobody holding it, as when its holder restarts.
- **No cooldown, but a quick abandon takes back the capture's prestige** (the maintainer, 2026-11-05). Capturing gives 1000 × the city's level in prestige, so capturing, abandoning to free the slot and capturing again would farm it, on a barbarian city after barbarian city and on a historic city over and over. Abandoning a city within 7 real days of capturing it (`BALANCE.abandon.prestigeBackMs`, `abandonPrestigeBack`) takes that back, never below 0; the settings and the confirmation say so, and the report. A cooldown on capturing was rejected: it would stop the very thing this is for, freeing a slot to capture Atlantis. The medals and the stock a capture gives aren't taken back, and each barbarian city captured and abandoned is still gone from the map.
- **No item or gold to skip the hour.**
- **Attackers on their way** turn back on arrival (`army.nothingToAttack`); on a seat they carry on against the unheld city.
- **Prestige (but for the above), honour and title stay.** Population and rankings follow from the next rankings job. Flows act no more in a city being abandoned (`planCities`, `runPart`): a repeating farming list would otherwise lose armies with no warning. A city lost leaves the player's flows (`dropCityFromFlows`), a seat a rival takes too (`loseCityContents`). A seat's tribute, state tribute and titles go with the city row. Reports and mail keep the city's name, as for a lost seat. **Beginner protection isn't reset:** starting again is what restarting is for.
- **Capture of a seat being abandoned** (`takeSeat`) cancels it: it's the winner's now, and nothing of it is deleted beyond what capture does. A restart deletes the city and its timed events, leaving nothing to do.

### The warning

- **In the city settings** (`city-dialog/city-form/abandon-city/`), under the teleport, in `LOSS_TEXT`, saying what abandoning does before the button, which is disabled with the reason when no other regular city would remain (`keepsRegularCity`).
- **The confirmation** (`ConfirmDialog`, whose `disabled` and `children` allow this) lists what this city would lose, with its real numbers: the heroes by name (locked ones too), troops at home, in training and injured, fortifications built and being built, resources, armies out with what's in them, valleys, market orders, shipments and unsent plan waves. **Its button stays disabled until the city's name is typed in,** as this can't be got back. It says plainly that an army sent away during the hour and still on the road when it ends is lost too.
- **While the hour runs:** `AbandonNotice` (`components/abandon-notice/`), a countdown with Keep this city, in `LOSS_TEXT`: on the city's card in the list, in the settings and in a banner under the top bar.
- **When it's done:** a report (`report.title.cityAbandoned`) naming the city. The city-lost push (`CASTLE_UPDATE`, `updateType: 1`, sent for a seat taken too) refreshes the player's cities, and once `castles` no longer holds `nav.cityId` the game goes to their first city, keeping the screen (`game.tsx`).

### Known consequences

- **An army still on the road when the hour ends is lost**, so one sent away during it, or a far one called home, can't be counted on. Troops, resources and chosen heroes don't march: they can be moved out at once (below).
- **An hour doesn't stop every dodge.** A holder who sees a rival's army more than an hour out can drop a seat before it lands, denying the capture: the seat stands again unheld and at full loyalty. With a seat taken losing everything too, this costs the holder nothing a capture wouldn't: a holder about to lose a seat anyway can always deny it to the winner, given an hour's warning. It's left as it is. A longer delay, or refusing it while a rival's army is on its way, would close it if it turns out to be a problem.
- **A hero can only move to a city with a free Feasting Hall slot.** With none the troops and goods stay there and the hero's army marches back to the city it left (`arriveReinforce`). The settings and the confirmation both say so, as it's found out too late from the report otherwise (the maintainer's own plan ran into this, 2026-11-06).
- **A city's own armies coming home during its hour** move in as ever, so they go with it unless moved out again. They're going home rather than being sent, so nothing stops them (found in a real hour's run of `tools/smoke/abandon.mjs`, 2026-11-06).
- **Moving a big city out takes a lot of armies.** A Rally Spot level gives an army 10,000 troops and the city one army out (`rallySpotTroopsPerLevel`, `rallySpotArmiesPerLevel`): at level 10, 10 armies of 100,000, or 125,000 with a War Ensign. A Transporter carried 10,000 at the research checked (`armyLoad`). Marches between near cities take seconds, so it can all be moved, but send by send, which is why a city being abandoned can now be moved out at once (below).
- **The Atlantis case:** to have a slot free when the last wave lands, abandon a city that isn't in the plan, at least an hour before landing, with its troops and heroes moved out first.

## Moving a city out at once

**Asked for by the maintainer, 2026-11-06,** having tried to plan it: a big city takes hundreds of armies to empty by hand (Known consequences). A city being abandoned can send its troops and resources straight to the player's other cities.

**Decided by the maintainer, 2026-11-06:**

- **It's instant, and free,** and shares everything evenly between the cities chosen.
- **Only during the hour** (`city.moveOutNotAbandoning`): it belongs to giving a city up, not to everyday logistics.
- **The screen** (`components/move-out/`, in the settings once the hour has started, loaded on first use): tick the cities, see what each would get, confirm. Keep this city asks first once it has been moved out (`AbandonNotice`, `movedOut` on `CityBean`).
- **Keeping the city afterwards doesn't bring anything back, and costs 24 real hours** with no moving any city out (`BALANCE.abandon.moveOutCooldownMs`, `misc.moveOutBlockedUntil`). Without a price, starting the hour, moving and calling it off would teleport a whole army to any city. It can be done as often as wanted during the hour, for what's produced meanwhile; only changing your mind costs anything. Calling it off by the game (no regular city would remain) costs nothing.
- **Refused with an enemy army on its way** (`city.moveOutUnderAttack`): otherwise an attack could be dodged in one click. Only an attack that has set off counts: one still waiting to leave at a landing time is hidden from the player, and a refusal would give it away. Scouts don't count.
- **Injured troops move too:** they can't march out any other way.
- **Heroes move too, if chosen, each to its own city** with a free Feasting Hall slot (`hero.noVacancy`), the mayor included, and only heroes can be moved without the rest. Without a slot a hero still can't go, so a full city needs a hero dismissed first. Added at the maintainer's word, 2026-11-06, having first been left out.
- **No army can be sent to a city being abandoned** (`army.destinationAbandoning`, a Reinforce or a Transport, the player's or a friend's), as it could only be lost; one on its way when the hour starts turns back on arrival, or goes home when the hour ends. An enemy's attack or scout isn't told, and carries on as before. The maintainer, 2026-11-06.

**What follows from those (our reading):**

- **Armies out, queues and fortifications stay,** and so does a hero out with an army. The warning lists them.
- **Shares** are per kind of troop and resource: whole units each, and what's left over to the first city chosen (`splitEvenly`), so nothing is lost. Rounding can't make a share differ by more than the number of cities.
- **Any of the player's other cities** may receive it, historic ones included, but not one being abandoned (`city.moveOutTarget`). There's no limit on what a city holds, as with an army moving in.
- **A later hour starts clean:** `misc.movedOutFor` holds the `abandonAt` of the hour moved in, so nothing needs clearing when an hour ends any other way.
- **A report** names the cities it went to (`report.title.cityMovedOut`).

**To watch:** this makes an abandoned city's contents safe in one click, so a holder losing a seat an hour ahead keeps its troops as well as denying the capture (Known consequences, *An hour doesn't stop every dodge*), as long as no attack has set off yet. Refusing during an attack limits it; a longer hour would close it.

## Bugs in the code nearby, all gone

Five went on 2026-11-05 with what caused them:

- **Prisoners being removed** ended another player's hero being deleted with the city and a captive's way home being lost.
- **Rising up being removed** ended armies, shipments and research being left stuck for good, as only a rising deleted their timed events.
- **A seat taken losing everything** ended the other city's mayor being sacked: it came from moving the seat's mayor there, and nothing moves now.

## How it's built

- **Data:** `cities.abandon_at` (ms, 0 none), a generated migration.
- **Time:** a timed event `city.abandon`, ref `abandon:<cityId>`, handled in `events.ts`; the handler checks `abandon_at` is due, so a stale event does nothing. Clearing a city's timed events takes research's too, so it's cancelled first (`cancelCityResearch`, `engine/research.ts`), or it would be stuck for good.
- **Code:** `engine/abandon.ts` (`completeAbandon`, `keepsRegularCity`) and `services/abandon.ts`, sharing with `takeSeat` what's lost (`loseCityContents`) and with `restartPlayer` what a tile becomes (`releaseCityTile`), both in `engine/city-loss.ts`.
- **API:** `POST /cities/{cityId}/abandon`, `DELETE /cities/{cityId}/abandon`, `abandonAt` on `CityBean`, then `npm run gen:api`.
- **Docs:** a `deviations.md` entry *(design change)*, `BALANCE.abandon`, text in every locale.
- **Teleporting during the hour** is allowed: the city still goes when it's up, from where it then stands.
- **Tests:** `services/abandon.db.test.ts` for each row of the table, each refusal and each early end, with an army in every state; the routes in the API's `cities/interior.db.test.ts`; `abandon-city/utils.test.ts`; end to end against the running stack, `tools/smoke/abandon.mjs` (`--real` to wait out the hour).

## What a review found, 2026-11-05

An independent read of the code, all fixed then: the capture farm above; flows that couldn't be saved naming a city lost (`dropCityFromFlows`, then `dropCityTargets`, and `saveFlow` forgets a city that's gone); a taken seat's queues stopping when its old holder restarted (their events pass to the winner in `takeSeat`); an attacker landing unseen on a city that appeared on the tile (`armiesNowAimAtCity`); a seat deleted mid-job failing that job; and screens left stale (friends' armies, market, plans, attackers bound for a released valley, a push missed while offline, dialogs carrying what was typed to another city).

## To watch

Once it's played: whether an hour proves too short as a safety net or against dodging.

## Phases

0. **A seat taken loses everything in it** (`loseCityContents`). Done 2026-11-05.
1. **The server:** the rules, data, API, messages, `deviations.md` and tests. Done 2026-11-05.
2. **The client:** the settings section, the confirmation with its real numbers, the countdown and banner, the redirect, the locales. Done 2026-11-05.
