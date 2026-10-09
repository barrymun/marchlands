# Battle simulations

A knowledge base of battle findings: how the battle engine behaves in practice, and which armies work best against given targets. Each finding comes from running the game's own battle code (`resolveCombat` in `shared/core/src/battle/resolve.ts`, with the same inputs the server builds) over hundreds of seeded battles. Each one was checked against real battle reports where those exist.

| Page | What it covers |
|---|---|
| [mechanics.md](mechanics.md) | How a field battle plays out: positions, targeting, fortifications, and the quirks that decide losses |
| [npc-level-10.md](npc-level-10.md) | Farming level 10 barbarian cities: the best army, items and hero, and why losses can't reach zero |

## Hero attributes

The code and the original game data use different names from the ones the game shows.

| In the game | In the code | In battle |
|---|---|---|
| Politics | `management` | Nothing |
| Attack | `power` | Army attack: +`power`/100, soft-capped above 200 (`heroBattleAttackBonus`) |
| Intelligence | `stratagem` | Army defense factor (see [mechanics.md](mechanics.md#the-defense-factor)) |

## Re-running

The scripts are in `tools/battle-sim` (`lib.ts` is the harness, `presets.ts` the named armies):

```bash
npm run sim -- compare --preset archers-old,archers-best --sources
```

| Command | What it does |
|---|---|
| `compare` | Every preset, or the ones named with `--preset` / `--troops archer=118250,peasants=1500,...`. `--sources` adds what killed each troop type. |
| `grid --main archer --fodder peasants,militia --from 500 --to 4000 --step 250` | Tries every fodder combination, filling the rest of the 125k cap (`--cap`, after `--carriage` transporters) with the main troop. Shows the cheapest winners. |
| `trace --preset archers-best --seed 3` | One battle round by round: positions, the towers and wall, and every kill. |
| `presets` | Lists the named armies |

- **Common options:** `--level` (barbarian city level, default 10) and `--seeds`.
- **The lord:** `--research`, `--power`, `--stratagem`, `--no-attack-item` and `--defense-item`. The defaults are barrymun on 2026-10-09; see `DEFAULT_LORD` in `lib.ts`.
- **Seeds:** the scripts use their own seeds, so averages can differ slightly (by about 0.05M) from the figures on these pages.

## How the simulations are run

- **Attacker:** the lord's real research, hero and active items. Attack bonus = 1 + hero attack bonus + 5% per Military Tradition level + the attack item. Defense = 1 + the defense item.
- **Defender:** `npcTemplate(level)` troops and fortifications, the wall at the NPC's level, no research, and a random guard hero (`createGuardHero(level × 10)`).
- **Seeds:** each setup runs over many seeds (usually 500). They vary the guard hero and how many traps fire each round, and results are averages.
- **Value of losses:** the sum of food, lumber, stone and iron to train each lost unit. With Medicine 10, half of an attacking army's losses come home injured (`BALANCE.attackersGetInjured`) and can be healed with honor. "Dead" is the other half.
