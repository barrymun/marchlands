// High-level combat: builds simulator inputs from game state, runs the battle and derives
// losses, hero experience, honor and plunder. The original never wired attacks up (spec
// battle.md §7.3); this follows its recommended mapping.

import { BALANCE } from '#/balance.ts';
import { TechType, TROOP_ID_BY_KEY, TROOP_KEY_LIST } from '#/constants.ts';
import { troopConfig } from '#/data/index.ts';
import { researchLevel } from '#/economy.ts';
import { heroBattleAttackBonus, heroPower, heroStratagem, type HeroStats } from '#/heroes.ts';
import type { Rng } from '#/rng.ts';
import { arrayToForts, arrayToTroops, fortsToArray, troopsToArray, unitsExp } from '#/troops.ts';
import type { FortCounts, ResearchState, ResourceSet, TroopCounts } from '#/types.ts';
import { simulateBattle, type BattleOutcome, type ResearchStats, type TraceEvent } from '#/battle/simulator.ts';

export interface CombatantInput {
  troops: TroopCounts;
  research: ResearchState;
  hero?: HeroStats | null;
  /** +fraction to attack (e.g. 0.2 for a War Horn style buff) */
  attackBonus?: number;
  /** +fraction to defense */
  defenseBonus?: number;
}

export interface DefenderInput extends CombatantInput {
  forts?: FortCounts;
  wallLevel?: number;
}

export interface CombatResult {
  attackerWon: boolean;
  defenderWon: boolean;
  draw: boolean;
  rounds: number;
  attacker: { before: TroopCounts; after: TroopCounts; lost: TroopCounts };
  defender: { before: TroopCounts; after: TroopCounts; lost: TroopCounts };
  forts: { before: FortCounts; after: FortCounts; lost: FortCounts };
  wallHitPoints: number;
  attackerHeroExp: number;
  defenderHeroExp: number;
  /** honor earned by each side for the enemy troops it killed */
  attackerHonor: number;
  defenderHonor: number;
  raw: BattleOutcome;
}

const toResearch = (r: ResearchState): Partial<ResearchStats> => ({
  militaryTradition: researchLevel(r, TechType.MILITARY_TRADITION),
  ironWorking: researchLevel(r, TechType.IRON_WORKING),
  medicine: researchLevel(r, TechType.MEDICINE),
  compass: researchLevel(r, TechType.COMPASS),
  horsebackRiding: researchLevel(r, TechType.HORSEBACK_RIDING),
  archery: researchLevel(r, TechType.ARCHERY),
  machinery: researchLevel(r, TechType.MACHINERY),
});

/**
 * Attack multiplier: the simulator ignores hero attack and Military Tradition, so they are folded
 * into attack_modifier as the spec recommends: 1 + power/100 + 5% per Military Tradition level (BALANCE.battle.researchPct.attack)
 * ((marchlands) hero power soft-capped with BALANCE.heroSoftCap.battle).
 */
function attackModifier(c: CombatantInput): number {
  const power = c.hero ? heroPower(c.hero) : 0;
  return (
    1 + heroBattleAttackBonus(power) + (BALANCE.battle.researchPct.attack / 100) * researchLevel(c.research, TechType.MILITARY_TRADITION) + (c.attackBonus ?? 0)
  );
}

const sub = (a: TroopCounts, b: TroopCounts): TroopCounts => {
  const out: TroopCounts = {};
  for (const k of TROOP_KEY_LIST) {
    const v = (a[k] ?? 0) - (b[k] ?? 0);
    if (v > 0) out[k] = v;
  }
  return out;
};

/** Experience a hero earns for the enemy troops (and fortifications) its army killed. */
function killExp(killed: TroopCounts, forts: FortCounts = {}): number {
  return Math.floor(unitsExp(killed, forts) * BALANCE.heroExpPerKill);
}
/** Honor for killed enemy troops: their food upkeep, a proxy for unit value. */
function killHonor(killed: TroopCounts): number {
  let h = 0;
  for (const k of TROOP_KEY_LIST) h += (killed[k] ?? 0) * (troopConfig(TROOP_ID_BY_KEY[k])?.upkeep ?? 0);
  return h;
}

export function resolveCombat(attacker: CombatantInput, defender: DefenderInput, rng: Rng, trace?: (e: TraceEvent) => void): CombatResult {
  const raw = simulateBattle(
    {
      research: toResearch(attacker.research),
      hero: attacker.hero ? { attack: heroPower(attacker.hero), intel: heroStratagem(attacker.hero) } : undefined,
      troops: troopsToArray(attacker.troops),
      attackModifier: attackModifier(attacker),
      defenceModifier: 1 + (attacker.defenseBonus ?? 0),
    },
    {
      research: toResearch(defender.research),
      hero: defender.hero ? { attack: heroPower(defender.hero), intel: heroStratagem(defender.hero) } : undefined,
      troops: troopsToArray(defender.troops),
      fortifications: fortsToArray(defender.forts ?? {}),
      wallLevel: defender.wallLevel ?? 0,
      attackModifier: attackModifier(defender),
      defenceModifier: 1 + (defender.defenseBonus ?? 0),
    },
    { rng, fixes: true, trace },
  );
  const atkAfter = arrayToTroops(raw.attackerTroops);
  const defAfter = arrayToTroops(raw.defenderTroops);
  const fortsBefore = defender.forts ?? {};
  const fortsAfter = arrayToForts(raw.fortifications);
  const atkLost = sub(attacker.troops, atkAfter);
  const defLost = sub(defender.troops, defAfter);
  const fortsLost: FortCounts = {};
  for (const [k, v] of Object.entries(fortsBefore) as [keyof FortCounts, number][]) {
    const d = v - (fortsAfter[k] ?? 0);
    if (d > 0) fortsLost[k] = d;
  }
  return {
    attackerWon: raw.attackerAlive && !raw.defenderAlive,
    defenderWon: raw.defenderAlive && !raw.attackerAlive,
    draw: raw.attackerAlive === raw.defenderAlive,
    rounds: raw.totalRounds,
    attacker: { before: { ...attacker.troops }, after: atkAfter, lost: atkLost },
    defender: { before: { ...defender.troops }, after: defAfter, lost: defLost },
    forts: { before: { ...fortsBefore }, after: fortsAfter, lost: fortsLost },
    wallHitPoints: raw.wallHitPoints,
    attackerHeroExp: attacker.hero ? killExp(defLost, fortsLost) : 0,
    defenderHeroExp: defender.hero ? killExp(atkLost) : 0,
    attackerHonor: killHonor(defLost),
    defenderHonor: killHonor(atkLost),
    raw,
  };
}

/**
 * Split a carry capacity over the available resources, taking as evenly as possible across the
 * five resource types (Evony behaviour) and never more than available.
 */
export function plunder(available: ResourceSet, capacity: number): ResourceSet {
  const out: ResourceSet = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  let cap = Math.max(0, Math.floor(capacity));
  let keys = (Object.keys(out) as (keyof ResourceSet)[]).filter((k) => available[k] >= 1);
  while (cap > 0 && keys.length > 0) {
    const share = Math.floor(cap / keys.length);
    if (share <= 0) break;
    const next: (keyof ResourceSet)[] = [];
    for (const k of keys) {
      const left = Math.floor(available[k]) - out[k];
      const take = Math.min(left, share);
      out[k] += take;
      cap -= take;
      if (left - take > 0) next.push(k);
    }
    keys = next;
  }
  return out;
}
