// Battle simulation harness: runs the game's own combat (resolveCombat, the inputs the server builds in
// backend/packages/game/src/services/combat.ts attackNpc) over many seeds and sums up losses, loot and
// what killed what. Findings live in docs/battle-sims.

import {
  armyLoad,
  BALANCE,
  createGuardHero,
  type HeroStats,
  injuredOf,
  type KillSource,
  npcTemplate,
  type ResearchState,
  resolveCombat,
  seededRng,
  TechType,
  type TraceEvent,
  TROOP_ID_BY_KEY,
  TROOP_KEY_LIST,
  troopConfig,
  type TroopCounts,
  type TroopKey,
} from '@marchlands/core';

/** The attacking lord: research, the hero leading the army and the items running. */
export interface Lord {
  /** every research at this level */
  researchLevel: number;
  /** hero Attack (power, including added points) */
  power: number;
  /** hero Intelligence (stratagem) */
  stratagem: number;
  /** attack item (Ivory Horn / War Horn): +20% attack */
  attackItem: boolean;
  /** defense item (Ultra Corselet / Corselet): +20% defense */
  defenseItem: boolean;
}

/** barrymun on 2026-10-09: every research at 10, ATK - 70 in lol, the attack item running. */
export const DEFAULT_LORD: Lord = { researchLevel: 10, power: 1359, stratagem: 18, attackItem: true, defenseItem: false };

/** The attack / defense item bonus (combat.ts buffBonus). */
const ITEM_BONUS = 0.2;

export function researchAt(level: number): ResearchState {
  const r: ResearchState = {};
  for (const id of Object.values(TechType)) r[id] = { level };
  return r;
}

function lordHero(lord: Lord): HeroStats {
  const h = createGuardHero(100, seededRng('lord-hero'));
  return { ...h, power: lord.power, powerAdded: 0, powerBuffAdded: 0, stratagem: lord.stratagem, stratagemAdded: 0, stratagemBuffAdded: 0 };
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
