// Battle simulation harness: runs the game's own combat (resolveCombat, the inputs the server builds in
// backend/packages/game/src/services/combat.ts attackNpc) over many seeds and sums up losses, loot and
// what killed what. Findings live in docs/battle-sims.

import {
  armyLoad,
  BALANCE,
  createGuardHero,
  GEAR_PIECES,
  type GearStat,
  heroGearBonus,
  type HeroStats,
  injuredOf,
  type KillSource,
  npcTemplate,
  type ResearchState,
  resolveCombat,
  seededRng,
  syncHeroGear,
  TechType,
  type TraceEvent,
  TROOP_ID_BY_KEY,
  TROOP_KEY_LIST,
  troopConfig,
  type TroopCounts,
  type TroopKey,
} from '@marchlands/core';

/**
 * The attacking lord: research, the hero leading the army, the lord's hero gear and the items running. The hero's
 * gear points come from the game's own gear rules (syncHeroGear in core), as on the server.
 */
export interface Lord {
  /** every research at this level */
  researchLevel: number;
  /** the hero's level: its gear tier is level ÷ 10 */
  heroLevel: number;
  /** hero Attack (power) and Intelligence (stratagem): the hero's own points (base + assigned), without gear */
  power: number;
  stratagem: number;
  /** Hero Enhancement level (the gear pieces' level) and the stars on every piece */
  gearLevel: number;
  gearStars: number;
  /** the attribute the gear boosts */
  gearStat: GearStat;
  /** attack item (Ivory Horn / War Horn): +20% attack */
  attackItem: boolean;
  /** defense item (Ultra Corselet / Corselet): +20% defense */
  defenseItem: boolean;
}

/**
 * barrymun on 2026-10-16: every research at 10 (Hero Enhancement too), 10 stars on every gear piece, ATK - 70 in lol
 * (level 100, Attack 169 + 1,050 gear, Intelligence 18), the attack item running.
 */
export const DEFAULT_LORD: Lord = {
  researchLevel: 10,
  heroLevel: 100,
  power: 169,
  stratagem: 18,
  gearLevel: 10,
  gearStars: 10,
  gearStat: 'power',
  attackItem: true,
  defenseItem: false,
};

/** The lord's gear: every piece at `gearLevel` with `gearStars` stars. */
export const lordGearOf = (lord: Lord) => ({
  level: lord.gearLevel,
  stars: Object.fromEntries(GEAR_PIECES.map((p) => [p.id, lord.gearStars])),
});

/** Gear points the lord's hero gets (on its gear attribute). */
export const lordGearPoints = (lord: Lord) => heroGearBonus(lord.heroLevel, lordGearOf(lord));

/** The attack / defense item bonus (combat.ts buffBonus). */
const ITEM_BONUS = 0.2;

export function researchAt(level: number): ResearchState {
  const r: ResearchState = {};
  for (const id of Object.values(TechType)) r[id] = { level };
  return r;
}

function lordHero(lord: Lord): HeroStats {
  const h = createGuardHero(lord.heroLevel, seededRng('lord-hero'));
  const hero = { ...h, level: lord.heroLevel, power: lord.power, stratagem: lord.stratagem, gearStat: lord.gearStat, powerBuffAdded: 0, stratagemBuffAdded: 0 };
  syncHeroGear(hero, lordGearOf(lord));
  return hero;
}

/** Resources to train one unit (food + lumber + stone + iron + gold). */
export function unitValue(k: TroopKey): number {
  const c = troopConfig(TROOP_ID_BY_KEY[k])?.cost;
  return c ? c.food + c.wood + c.stone + c.iron + c.gold : 0;
}

const valueOf = (t: TroopCounts) => TROOP_KEY_LIST.reduce((s, k) => s + (t[k] ?? 0) * unitValue(k), 0);
export const armySize = (t: TroopCounts) => TROOP_KEY_LIST.reduce((s, k) => s + (t[k] ?? 0), 0);

export interface Summary {
  battles: number;
  winPct: number;
  rounds: number;
  size: number;
  /** carry capacity and what one win takes (capped by the NPC's stock) */
  load: number;
  loot: number;
  /** average units lost per battle, by type */
  lost: Partial<Record<TroopKey, number>>;
  /** average resources to retrain everything lost; `dead` excludes the share that comes home injured */
  lostValue: number;
  deadValue: number;
  /** average units lost per battle, by troop type and what killed them */
  bySource: Partial<Record<TroopKey, Record<string, number>>>;
}

const sourceName = (s: KillSource) => (typeof s === 'number' ? `${TROOP_KEY_LIST[s]} (defender)` : s);

/** Attack a full-strength barbarian city of `level` with `troops`, once per seed (0 .. seeds-1). */
export function attackNpc(troops: TroopCounts, opts: { level?: number; seeds?: number; lord?: Lord } = {}): Summary {
  const level = opts.level ?? 10;
  const seeds = opts.seeds ?? 500;
  const lord = opts.lord ?? DEFAULT_LORD;
  const research = researchAt(lord.researchLevel);
  const hero = lordHero(lord);
  const t = npcTemplate(level);
  const stock = t.resources.gold + t.resources.food + t.resources.wood + t.resources.stone + t.resources.iron;

  let wins = 0;
  let rounds = 0;
  let lostValue = 0;
  let deadValue = 0;
  const lost: Partial<Record<TroopKey, number>> = {};
  const bySource: Partial<Record<TroopKey, Record<string, number>>> = {};
  const trace = (e: TraceEvent) => {
    if (e.kind !== 'kill' || e.killed <= 0) return;
    const k = TROOP_KEY_LIST[e.target];
    const row = (bySource[k] ??= {});
    const src = sourceName(e.source);
    row[src] = (row[src] ?? 0) + e.killed / seeds;
  };
  for (let s = 0; s < seeds; s++) {
    // a fresh garrison and guard hero, as after a regeneration
    const guard = createGuardHero(level * 10, seededRng(`guard:${s}`));
    const r = resolveCombat(
      { troops, research, hero, attackBonus: lord.attackItem ? ITEM_BONUS : 0, defenseBonus: lord.defenseItem ? ITEM_BONUS : 0 },
      { troops: { ...t.troops }, research: {}, hero: guard, forts: { ...t.forts }, wallLevel: level },
      seededRng(`battle:${s}`),
      trace,
    );
    if (r.attackerWon) wins++;
    rounds += r.rounds;
    for (const k of TROOP_KEY_LIST) if (r.attacker.lost[k]) lost[k] = (lost[k] ?? 0) + r.attacker.lost[k]! / seeds;
    const injured = BALANCE.attackersGetInjured ? injuredOf(r.attacker.lost, research) : {};
    lostValue += valueOf(r.attacker.lost) / seeds;
    deadValue += (valueOf(r.attacker.lost) - valueOf(injured)) / seeds;
  }
  const load = armyLoad(troops, research);
  return {
    battles: seeds,
    winPct: (100 * wins) / seeds,
    rounds: rounds / seeds,
    size: armySize(troops),
    load,
    loot: Math.min(load, stock),
    lost,
    lostValue,
    deadValue,
    bySource,
  };
}

/** One battle, round by round: where each group stands and what was killed. */
export function traceNpc(troops: TroopCounts, opts: { level?: number; seed?: number; lord?: Lord } = {}): TraceEvent[] {
  const level = opts.level ?? 10;
  const s = opts.seed ?? 0;
  const lord = opts.lord ?? DEFAULT_LORD;
  const t = npcTemplate(level);
  const events: TraceEvent[] = [];
  resolveCombat(
    {
      troops,
      research: researchAt(lord.researchLevel),
      hero: lordHero(lord),
      attackBonus: lord.attackItem ? ITEM_BONUS : 0,
      defenseBonus: lord.defenseItem ? ITEM_BONUS : 0,
    },
    { troops: { ...t.troops }, research: {}, hero: createGuardHero(level * 10, seededRng(`guard:${s}`)), forts: { ...t.forts }, wallLevel: level },
    seededRng(`battle:${s}`),
    (e) => events.push(e),
  );
  return events;
}
