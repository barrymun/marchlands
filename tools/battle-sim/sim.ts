// Battle simulation CLI (findings: docs/battle-sims).
//
//   npm run sim -- compare [--preset archers-old,archers-best] [--troops archer=118250,peasants=1500] [--sources]
//   npm run sim -- grid --main archer --fodder peasants,militia [--from 500 --to 4000 --step 250]
//   npm run sim -- trace [--preset archers-best | --troops ...] [--seed 3]
//   npm run sim -- presets
//   npm run sim -- siege --plan age2-staged,age2-ballista [--level 12] [--day pikemen,lightCavalry,batteringRam] [--gap 1]
//     [--loyalty 100 --loyalty-per-win 3] [--wall 12] [--refill 0.1] [--city-research 10] [--seeds 10]   (plans: plans.ts; a historic city's
//     garrison refilling every second between waves, siege.ts)
//
// Common options: --level 10 (barbarian city level), --seeds N, and the lord: --research 10, the hero
// --hero-level 100 --power 169 --stratagem 18 (its own points, without gear), the gear --gear-level 10 --stars 10
// --gear-stat power, --no-attack-item --defense-item (defaults: DEFAULT_LORD in lib.ts).

import { parseArgs } from 'node:util';

import { GEAR_STATS, type GearStat, TROOP_KEY_LIST, type TroopCounts, type TroopKey } from '@marchlands/core';

import { armySize, attackNpc, DEFAULT_LORD, type Lord, lordGearPoints, type Summary, traceNpc } from './lib.ts';
import { PLANS } from './plans.ts';
import { PRESETS } from './presets.ts';
import { CITY_RESEARCH, HISTORIC_LEVELS, type HistoricLevel, historicResearch, type Rotation, runSiege, type SiegeResult } from './siege.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    level: { type: 'string', default: '10' },
    seeds: { type: 'string' },
    seed: { type: 'string', default: '0' },
    preset: { type: 'string' },
    troops: { type: 'string', multiple: true },
    sources: { type: 'boolean', default: false },
    research: { type: 'string' },
    'hero-level': { type: 'string' },
    power: { type: 'string' },
    stratagem: { type: 'string' },
    'gear-level': { type: 'string' },
    stars: { type: 'string' },
    'gear-stat': { type: 'string' },
    'no-attack-item': { type: 'boolean', default: false },
    'defense-item': { type: 'boolean', default: false },
    main: { type: 'string', default: 'archer' },
    fodder: { type: 'string', default: 'peasants,militia' },
    from: { type: 'string', default: '500' },
    to: { type: 'string', default: '4000' },
    step: { type: 'string', default: '250' },
    cap: { type: 'string', default: '125000' },
    carriage: { type: 'string', default: '3500' },
    top: { type: 'string', default: '10' },
    plan: { type: 'string' },
    day: { type: 'string', default: 'pikemen,lightCavalry,batteringRam' },
    gap: { type: 'string' },
    loyalty: { type: 'string', default: '100' },
    'loyalty-per-win': { type: 'string', default: '3' },
    wall: { type: 'string' },
    refill: { type: 'string', default: '0.1' },
    'city-research': { type: 'string' },
  },
});

const level = Number(values.level);
const num = (v: string | undefined, fallback: number) => (v != null ? Number(v) : fallback);
const gearStat = values['gear-stat'] ?? DEFAULT_LORD.gearStat;
if (!GEAR_STATS.includes(gearStat as GearStat)) throw new Error(`bad --gear-stat "${gearStat}": use ${GEAR_STATS.join(', ')}`);
const researchLevel = num(values.research, DEFAULT_LORD.researchLevel);
const lord: Lord = {
  researchLevel,
  heroLevel: num(values['hero-level'], DEFAULT_LORD.heroLevel),
  power: num(values.power, DEFAULT_LORD.power),
  stratagem: num(values.stratagem, DEFAULT_LORD.stratagem),
  // Hero Enhancement is research: it follows --research unless given
  gearLevel: num(values['gear-level'], values.research != null ? researchLevel : DEFAULT_LORD.gearLevel),
  gearStars: num(values.stars, DEFAULT_LORD.gearStars),
  gearStat: gearStat as GearStat,
  attackItem: !values['no-attack-item'],
  defenseItem: values['defense-item'],
};

const millions = (n: number) => `${(n / 1e6).toFixed(2)}M`;
const count = (n: number) => Math.round(n).toLocaleString('en-US');
const units = (t: Partial<Record<TroopKey, number>>) =>
  TROOP_KEY_LIST.filter((k) => (t[k] ?? 0) >= 0.5)
    .map((k) => `${k} ${count(t[k] ?? 0)}`)
    .join(', ') || 'none';

function parseTroops(spec: string): TroopCounts {
  const t: TroopCounts = {};
  for (const part of spec.split(',')) {
    const [k, n] = part.split('=');
    if (!TROOP_KEY_LIST.includes(k as TroopKey) || !Number.isFinite(Number(n)))
      throw new Error(`bad troops "${part}": use key=count with keys ${TROOP_KEY_LIST.join(', ')}`);
    t[k as TroopKey] = Number(n);
  }
  return t;
}

/** The armies named by --preset and --troops (default: every preset). */
function armies(): [string, TroopCounts][] {
  const out: [string, TroopCounts][] = [];
  for (const name of values.preset?.split(',') ?? []) {
    if (!PRESETS[name]) throw new Error(`unknown preset "${name}": ${Object.keys(PRESETS).join(', ')}`);
    out.push([name, PRESETS[name]]);
  }
  for (const spec of values.troops ?? []) out.push([spec, parseTroops(spec)]);
  return out.length ? out : Object.entries(PRESETS);
}

function printSummary(name: string, s: Summary) {
  console.log(
    `${name}\n  ${count(s.size)} troops · won ${s.winPct.toFixed(1)}% · ${s.rounds.toFixed(1)} rounds · carries ${millions(s.load)} (loot ${millions(s.loot)})` +
      `\n  lost ${millions(s.lostValue)} per battle (dead ${millions(s.deadValue)}): ${units(s.lost)}`,
  );
  if (values.sources) {
    for (const [k, row] of Object.entries(s.bySource)) {
      const parts = Object.entries(row)
        .sort((a, b) => b[1] - a[1])
        .map(([src, n]) => `${src} ${count(n)}`);
      console.log(`    ${k} killed by: ${parts.join(', ')}`);
    }
  }
}

function describeLord() {
  const gear = lordGearPoints(lord);
  const attr = (stat: GearStat, own: number) => (lord.gearStat === stat && gear > 0 ? `${own} + ${count(gear)} gear = ${count(own + gear)}` : String(own));
  return (
    `lord: research ${lord.researchLevel}, hero Lv ${lord.heroLevel} Attack ${attr('power', lord.power)} / Intelligence ${attr('stratagem', lord.stratagem)} ` +
    `(gear Lv ${lord.gearLevel}, ${lord.gearStars} stars), ` +
    `attack item ${lord.attackItem ? 'on' : 'off'}, defense item ${lord.defenseItem ? 'on' : 'off'} · barbarian city level ${level}`
  );
}

const command = positionals[0] ?? 'compare';

if (command === 'presets') {
  for (const [name, t] of Object.entries(PRESETS)) console.log(`${name.padEnd(14)} ${units(t)}`);
} else if (command === 'compare') {
  const seeds = Number(values.seeds ?? 500);
  console.log(`${describeLord()} · ${seeds} battles each\n`);
  for (const [name, t] of armies()) printSummary(name, attackNpc(t, { level, seeds, lord }));
} else if (command === 'grid') {
  // every combination of the fodder counts; the main troop fills the rest of the cap (after transporters)
  const seeds = Number(values.seeds ?? 40);
  const fodder = values.fodder.split(',') as TroopKey[];
  const main = values.main as TroopKey;
  const steps: number[] = [];
  for (let n = Number(values.from); n <= Number(values.to); n += Number(values.step)) steps.push(n);
  const combos: number[][] = fodder.reduce<number[][]>((acc) => acc.flatMap((c) => steps.map((n) => [...c, n])), [[]]);
  console.log(`${describeLord()} · ${combos.length} armies × ${seeds} battles\n`);
  const results = combos
    .map((c) => {
      const t: TroopCounts = { carriage: Number(values.carriage) };
      fodder.forEach((k, i) => (t[k] = c[i]));
      t[main] = Number(values.cap) - armySize(t);
      return { t, s: attackNpc(t, { level, seeds, lord }) };
    })
    .filter((r) => r.s.winPct === 100)
    .sort((a, b) => a.s.lostValue - b.s.lostValue);
  for (const { t, s } of results.slice(0, Number(values.top))) printSummary(units(t), s);
} else if (command === 'trace') {
  const [first] = armies();
  if (!first) throw new Error('trace: no army to run');
  const [name, t] = first;
  console.log(`${describeLord()} · ${name} · seed ${values.seed}\n`);
  const kills: string[] = [];
  for (const e of traceNpc(t, { level, seed: Number(values.seed), lord })) {
    if (e.kind === 'kill') {
      if (e.killed > 0)
        kills.push(
          `${typeof e.source === 'number' ? `defending ${TROOP_KEY_LIST[e.source]}` : e.source} killed ${count(e.killed)} ${TROOP_KEY_LIST[e.target]}`,
        );
      continue;
    }
    const groups = (side: { location: number; count: number }[]) =>
      side
        .map((g, i) => (g.count > 0 ? `${TROOP_KEY_LIST[i]} ${count(g.count)} @${g.location}` : null))
        .filter(Boolean)
        .join(', ') || 'none';
    console.log(`round ${e.round}`);
    console.log(`  attacker: ${groups(e.attacker)}`);
    console.log(`  defender: ${groups(e.defender)} · towers ${count(e.towers)} · wall ${count(e.wallHitPoints)}`);
    if (kills.length) console.log(`  ${kills.join('; ')}`);
    kills.length = 0;
  }
} else if (command === 'siege') {
  const siegeLevel = (values.level === '10' ? 12 : level) as HistoricLevel;
  if (!HISTORIC_LEVELS.includes(siegeLevel)) throw new Error(`bad --level ${siegeLevel}: historic cities are ${HISTORIC_LEVELS.join(', ')}`);
  const [foot, horse, siege] = values.day.split(',');
  const day = { foot, horse, siege } as Rotation;
  const seeds = Number(values.seeds ?? 10);
  const names = values.plan?.split(',') ?? Object.keys(PLANS);
  const opts = {
    level: siegeLevel,
    day,
    lord,
    wallLevel: values.wall != null ? Number(values.wall) : undefined,
    loyalty: Number(values.loyalty),
    loyaltyPerWin: Number(values['loyalty-per-win']),
    refillShare: Number(values.refill),
    research: historicResearch(num(values['city-research'], CITY_RESEARCH)),
  };
  console.log(
    `${describeLord().replace(/ · barbarian city level \d+$/, '')}\nhistoric city level ${siegeLevel} (${foot}, ${horse}, ${siege}), research ${num(values['city-research'], CITY_RESEARCH)} but Archery 0, wall ${opts.wallLevel ?? siegeLevel}, ` +
      `loyalty ${opts.loyalty} less ${opts.loyaltyPerWin} a win, ${opts.refillShare * 100}% back every 6 minutes · ${seeds} sieges each\n`,
  );
  for (const name of names) {
    const base = PLANS[name];
    if (!base) throw new Error(`unknown plan "${name}": ${Object.keys(PLANS).join(', ')}`);
    const plan = values.gap != null ? { ...base, gap: Number(values.gap) } : base;
    const runs: SiegeResult[] = [];
    for (let s = 0; s < seeds; s++) runs.push(runSiege(plan, { ...opts, seed: s }));
    const avg = (f: (r: SiegeResult) => number) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
    const captured = runs.filter((r) => r.captured).length;
    console.log(`${name}: ${plan.name}, waves ${plan.gap} s apart`);
    console.log(
      `  captured ${captured}/${seeds} · ${avg((r) => r.waves).toFixed(1)} waves · lost ${millions(avg((r) => r.lostValue))} (dead ${millions(avg((r) => r.deadValue))})` +
        ` · largest wave ${count(Math.max(...runs.map((r) => r.largestWave)))}`,
    );
    const [first] = runs;
    if (!first) continue;
    for (const st of first.stages)
      console.log(
        `    ${st.name.padEnd(9)} ${String(st.waves).padStart(3)} waves, ${String(st.wins).padStart(3)} won · lost ${millions(st.lostValue).padStart(7)}: ${units(st.lost)}` +
          `\n              then ${count(st.troopsLeft)} troops, traps ${count(st.forts.trap ?? 0)}, towers ${count(st.forts.arrowTower ?? 0)}, ` +
          `logs ${count(st.forts.rollingLogs ?? 0)}, trebuchets ${count(st.forts.rockfall ?? 0)}, loyalty ${st.loyalty} at ${st.endsAt} s`,
      );
    console.log();
  }
} else {
  console.error(`unknown command "${command}": use compare, grid, trace, siege or presets`);
  process.exit(1);
}
