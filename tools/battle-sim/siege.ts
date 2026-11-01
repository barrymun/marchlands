// Sieges of historic cities: waves fought one after another against a garrison that keeps its losses between them and
// refills a little every second (docs/features/historical-cities.md, Testing how they're broken). The garrisons are
// Age 2's (docs/reference/historic-cities.md, Garrisons); what a win takes off loyalty isn't known, so it's an option.
// Findings live in docs/battle-sims/historic-cities.md.

import {
  BALANCE,
  createGuardHero,
  type FortCounts,
  type FortKey,
  type HistoricDay,
  historicGarrison,
  historicHeroStats,
  type HistoricLevel,
  historicResearch,
  injuredOf,
  type ResearchState,
  resolveCombat,
  seededRng,
  TROOP_KEY_LIST,
  type TroopCounts,
  type TroopKey,
} from '@marchlands/core';
import { armySize, DEFAULT_LORD, ITEM_BONUS, type Lord, lordHero, researchAt, unitValue } from './lib.ts';

export { HISTORIC_LEVELS, type HistoricLevel } from '@marchlands/core';
export type Rotation = HistoricDay;

/** The weakest day, the one Age 2 players waited for (sources 3, 11 and 13). */
export const WEAK_DAY: Rotation = { foot: 'pikemen', horse: 'lightCavalry', siege: 'batteringRam' };

/** The city's research level (every research but Archery; core historicResearch). */
export const CITY_RESEARCH = BALANCE.historic.researchLevel;

function historicHero(level: HistoricLevel) {
  const [power, stratagem] = historicHeroStats(level);
  const h = createGuardHero(100, seededRng(`historic-hero:${level}`), 0);
  return { ...h, level: 100, power, powerAdded: 0, powerBuffAdded: 0, stratagem, stratagemAdded: 0, stratagemBuffAdded: 0 };
}

/**
 * One stage of a plan: the same wave sent `waves` times, or until the garrison is broken (no troops left), one troop
 * type is cleared (`target`) or the city captured (loyalty at 0), at most `max` waves. `gap` overrides the plan's
 * seconds between waves.
 */
export interface Stage {
  name: string;
  troops: TroopCounts;
  waves?: number;
  until?: 'broken' | 'cleared' | 'captured';
  target?: TroopKey;
  max?: number;
  gap?: number;
  /** the hero's own Attack for this stage's waves (cheap trap waves can go with weak heroes); default the lord's */
  power?: number;
}

export interface Plan {
  name: string;
  /** seconds between one wave landing and the next */
  gap: number;
  stages: Stage[];
}

export interface SiegeOptions {
  level: HistoricLevel;
  day: Rotation;
  lord?: Lord;
  /** the walls' level (the city's level unless given) */
  wallLevel?: number;
  /** loyalty at the start, and what each win takes off it */
  loyalty?: number;
  loyaltyPerWin?: number;
  /** a share of the full garrison back every 6 minutes, spread over every second (0.1) */
  refillShare?: number;
  /** the city's research, historicResearch(CITY_RESEARCH) unless given */
  research?: ResearchState;
  seed?: number;
}

export interface StageResult {
  name: string;
  waves: number;
  wins: number;
  /** units lost by the attacker, and the resources to retrain them; `dead` leaves out the injured who come home */
  lost: TroopCounts;
  lostValue: number;
  deadValue: number;
  /** the garrison, fortifications and loyalty when the stage ends */
  troopsLeft: number;
  left: TroopCounts;
  forts: FortCounts;
  loyalty: number;
  /** seconds from the first wave to this stage's last */
  endsAt: number;
}

export interface SiegeResult {
  stages: StageResult[];
  broken: boolean;
  captured: boolean;
  waves: number;
  lostValue: number;
  deadValue: number;
  /** the largest wave sent, against the Rally Spot's cap */
  largestWave: number;
}

const value = (t: TroopCounts) => TROOP_KEY_LIST.reduce((s, k) => s + (t[k] ?? 0) * unitValue(k), 0);
const add = (a: TroopCounts, b: TroopCounts) => {
  for (const k of TROOP_KEY_LIST) if (b[k]) a[k] = (a[k] ?? 0) + (b[k] ?? 0);
};

/** Run one siege: every stage in order against the garrison, which refills between waves. */
export function runSiege(plan: Plan, o: SiegeOptions): SiegeResult {
  const lord = o.lord ?? DEFAULT_LORD;
  const research = researchAt(lord.researchLevel);
  const full = historicGarrison(o.level, o.day);
  const cityResearch = o.research ?? historicResearch();
  // the simulations run at GAME_SPEED 1: 6 real minutes
  const refillPerSecond = (o.refillShare ?? BALANCE.historic.refillShare) / (BALANCE.npcRegenMs / 1000);
  // the garrison as fractions, so a refill of less than one unit a second adds up; battles see whole units
  const troops: Record<string, number> = { ...full.troops };
  const forts: Record<string, number> = { ...full.forts };
  let loyalty = o.loyalty ?? BALANCE.historic.loyalty;
  const perWin = o.loyaltyPerWin ?? BALANCE.historic.loyaltyPerWin;
  const hero = historicHero(o.level);
  const rng = seededRng(`siege:${o.seed ?? 0}`);
  let t = 0;
  let first = true;
  let largestWave = 0;
  const stages: StageResult[] = [];

  const refill = (seconds: number) => {
    for (const [k, max] of Object.entries(full.troops)) troops[k] = Math.min(max, (troops[k] ?? 0) + max * refillPerSecond * seconds);
    for (const [k, max] of Object.entries(full.forts)) forts[k] = Math.min(max, (forts[k] ?? 0) + max * refillPerSecond * seconds);
  };
  const whole = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.floor(v)]));
  const troopsLeft = () => Object.values(troops).reduce((s, v) => s + Math.floor(v), 0);

  for (const stage of plan.stages) {
    const result: StageResult = {
      name: stage.name,
      waves: 0,
      wins: 0,
      lost: {},
      lostValue: 0,
      deadValue: 0,
      troopsLeft: 0,
      left: {},
      forts: {},
      loyalty,
      endsAt: t,
    };
    const max = stage.until ? (stage.max ?? 100) : (stage.waves ?? 1);
    const waveHero = stage.power != null ? lordHero({ ...lord, power: stage.power }) : lordHero(lord);
    largestWave = Math.max(largestWave, armySize(stage.troops));
    for (let i = 0; i < max; i++) {
      if (stage.until === 'broken' && troopsLeft() === 0) break;
      if (stage.until === 'cleared' && stage.target && (troops[stage.target] ?? 0) < 1) break;
      if (loyalty <= 0) break;
      if (!first) {
        const gap = stage.gap ?? plan.gap;
        t += gap;
        refill(gap);
      }
      first = false;
      const defTroops = whole(troops) as TroopCounts;
      const defForts = whole(forts) as FortCounts;
      const r = resolveCombat(
        { troops: stage.troops, research, hero: waveHero, attackBonus: lord.attackItem ? ITEM_BONUS : 0, defenseBonus: lord.defenseItem ? ITEM_BONUS : 0 },
        { troops: defTroops, research: cityResearch, hero, forts: defForts, wallLevel: o.wallLevel ?? o.level },
        rng,
      );
      // the losses come off the fractional garrison, keeping what refilled below one unit
      for (const k of Object.keys(troops) as TroopKey[]) troops[k] = (troops[k] ?? 0) - (r.defender.lost[k] ?? 0);
      for (const k of Object.keys(forts) as FortKey[]) forts[k] = (forts[k] ?? 0) - (r.forts.lost[k] ?? 0);
      result.waves++;
      if (r.attackerWon) {
        result.wins++;
        // a win means the garrison and the wall fell; after the break, a win against what refilled since counts too
        loyalty -= perWin;
      }
      add(result.lost, r.attacker.lost);
      const injured = BALANCE.attackersGetInjured ? injuredOf(r.attacker.lost, research) : {};
      result.lostValue += value(r.attacker.lost);
      result.deadValue += value(r.attacker.lost) - value(injured);
      if (stage.until === 'captured' && loyalty <= 0) break;
    }
    result.troopsLeft = troopsLeft();
    result.left = whole(troops);
    result.forts = whole(forts);
    result.loyalty = Math.max(0, loyalty);
    result.endsAt = t;
    stages.push(result);
  }
  return {
    stages,
    broken: stages.some((s) => s.troopsLeft === 0),
    captured: loyalty <= 0,
    waves: stages.reduce((s, r) => s + r.waves, 0),
    lostValue: stages.reduce((s, r) => s + r.lostValue, 0),
    deadValue: stages.reduce((s, r) => s + r.deadValue, 0),
    largestWave,
  };
}
