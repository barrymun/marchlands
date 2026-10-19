# NPC (barbarian) city garrisons in Evony Age 2

**Version:** Evony Age 2, compared with the Age 1 table Marchlands already uses.

**Source:** *NPC Troops and Defences – Advanced Guide*, Evony Age 2 blog (2015): <https://evony-age2.blogspot.com/2015/05/npc-troops-and-defences-advanced-guide.html> (read 2026-10-19). Two tables of the troops and fortifications in NPC cities of levels 1–5 and 6–10.

## Compared with ours

Marchlands' NPC garrisons come from the original Age 1 server (`NPC_TABLE` in `shared/core/src/world.ts`, from `NpcCity::Initialize`; deviations.md, NPC cities). The Age 2 tables match it **in every cell but one**:

| | Level 4 traps |
|---|---|
| This source (Age 2) | 2,500 |
| `NPC_TABLE` (Age 1 server) | 4,500 |

That one cell may be a typo in the source, or a change in Age 2; nothing else suggests the garrisons changed between versions. Everything else agrees, including the oddities:
- a level 10 NPC city holds only warriors (400,000) and no other troops;
- the first defensive trebuchets appear at level 6.

The source gives no resources, population or loyalty, so those can't be compared.

## What this tells us

- Our NPC garrisons are faithful to the live game as players met it, in Age 2 as well as Age 1.
- Historic city garrisons are much larger. A level 12 holds about 1.12 million warriors, against a level 10's 400,000 warriors and nothing else, and two to four times its fortifications (historic-cities.md, Level 12). That's a big step up from a level 10 NPC city, as intended: historic cities were a prize for strong players.
