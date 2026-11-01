# Battle simulations

A knowledge base of battle findings: how the battle engine behaves in practice, and which armies work best against given targets. Each finding comes from running the game's own battle code (`resolveCombat` in `shared/core/src/battle/resolve.ts`, with the same inputs the server builds) over hundreds of seeded battles. Each one was checked against real battle reports where those exist.

| Page | What it covers |
|---|---|
| [mechanics.md](mechanics.md) | How a field battle plays out: positions, targeting, fortifications, and the quirks that decide losses |
| [npc-level-10.md](npc-level-10.md) | Farming level 10 barbarian cities: the best army, items and hero, and why losses can't reach zero |
| [old-guides.md](old-guides.md) | The old guides' strategies (ballista farming, AeroAgg's waves, suicide waves, walls) run through the simulator: which still work and why |
| [historic-cities.md](historic-cities.md) | Breaking historic cities of levels 12 to 18 (before they exist): what a siege takes, the weakest attacker that can, and how much the gaps between waves matter |

## Hero attributes

The code and the original game data use different names from the ones the game shows.

| In the game | In the code | In battle |
|---|---|---|
| Politics | `management` | Nothing |
| Attack | `power` | Army attack: +`power`/100, soft-capped above 200 (`heroBattleAttackBonus`) |
| Intelligence | `stratagem` | Army defense factor (see [mechanics.md](mechanics.md#the-defense-factor)) |

## Re-running

The scripts are in `tools/battle-sim` (`lib.ts` is the harness, `presets.ts` the named armies, `siege.ts` and `plans.ts` the sieges of historic cities):

```bash
npm run sim -- compare --preset archers-old,archers-best --sources
```

| Command | What it does |
|---|---|
| `compare` | Every preset, or the ones named with `--preset` / `--troops archer=118250,peasants=1500,...`. `--sources` adds what killed each troop type. |
| `grid --main archer --fodder peasants,militia --from 500 --to 4000 --step 250` | Tries every fodder combination, filling the rest of the 125k cap (`--cap`, after `--carriage` transporters) with the main troop. Shows the cheapest winners. |
| `trace --preset archers-best --seed 3` | One battle round by round: positions, the towers and wall, and every kill. |
| `presets` | Lists the named armies |
| `siege --plan archers-best,age2-ballista --level 16 --gap 1` | Waves fought one after another against a historic city whose garrison keeps its losses and refills every second (`siege.ts`, plans in `plans.ts`); `--day`, `--loyalty`, `--loyalty-per-win`, `--wall` and `--refill` set the city. See [historic-cities.md](historic-cities.md). |

- **Common options:** `--level` (barbarian city level, default 10) and `--seeds`.
- **The lord:** `--research` (every research at that level) and `--tech archery=3,horseback-riding=8` (some at other levels, by `TechType` name), the hero (`--hero-level`, and `--power` and `--stratagem`: its own points, without gear), the lord's gear (`--gear-level` for Hero Enhancement, which follows `--research` unless given, `--stars` on every piece, and `--gear-stat` for the attribute it boosts), `--no-attack-item` and `--defense-item`. The defaults are the maintainer's account on 2026-10-16; see `DEFAULT_LORD` in `lib.ts`.
- **What defends** (`compare`, `grid`, `trace`; `Defence` in `lib.ts`): `--garrison 0.42` keeps that share of the barbarian city's troops and fortifications (a city part refilled since the last wave); `--defenders militia=1000` (or `none`) and `--forts arrowTower=18333` (or `none`) replace them, for a player's city and wall at `--level`; `--defender-research 10` gives the defender every research at that level (a barbarian city has none).
- **Seeds:** the scripts use their own seeds, so averages can differ slightly (by about 0.05M) from the figures on these pages.

## How the simulations are run

- **Attacker:** the lord's real research, hero and active items. The hero's gear points come from the game's own gear rules (`syncHeroGear` in `shared/core/src/gear.ts`), so they follow any change to them. Attack bonus = 1 + hero attack bonus + 5% per Military Tradition level + the attack item. Defense = 1 + the defense item.
- **Defender:** `npcTemplate(level)` troops and fortifications unless the options above change them, the wall at the NPC's level, no research unless given, and a random guard hero (`createGuardHero(level × 10)`).
- **Seeds:** each setup runs over many seeds (usually 500). They vary the guard hero and how many traps fire each round, and results are averages.
- **Value of losses:** the sum of food, lumber, stone and iron to train each lost unit. With Medicine 10, half of an attacking army's losses come home injured (`BALANCE.attackersGetInjured`) and can be healed with honor. "Dead" is the other half.
