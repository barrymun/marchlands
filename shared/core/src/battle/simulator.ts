// Evony Age 1 field battle simulator: a bit-exact TypeScript port of
// EvonyAge1BattleCalc/BattleCalc/BattleCalc.cpp (CombatSimulator::fight).
//
// The C++ works in IEEE-754 binary32 (`float`); every float operation is reproduced with
// Math.fround in the same left-to-right order so results match the original regression data.
// Troop indices are troop type id - 2 (0 worker ... 11 catapult); fort indices are id - 14.

import { BALANCE } from '#/balance.ts';
import type { Rng } from '#/rng.ts';

const f = Math.fround;

export interface ResearchStats {
  militaryTradition: number;
  ironWorking: number;
  medicine: number;
  compass: number;
  horsebackRiding: number;
  archery: number;
  machinery: number;
}

export interface HeroBattleStats {
  /** hero power (unused by the original algorithm; fold into attackModifier) */
  attack: number;
  /** hero stratagem: reduces damage taken */
  intel: number;
  leadership: number;
}

export interface BattleSide {
  research: Partial<ResearchStats>;
  hero?: Partial<HeroBattleStats>;
  /** 12 troop counts by battle index */
  troops: number[];
  attackModifier?: number;
  defenceModifier?: number;
  lifeModifier?: number;
}

export interface DefenderSide extends BattleSide {
  /** [trap, abatis, archerTower, rollingLog, trebuchet] */
  fortifications?: number[];
  wallLevel?: number;
  trapKillPower?: number;
  logKillPower?: number;
  rockKillPower?: number;
}

export interface BattleOptions {
  rng: Rng;
  /**
   * Fix known bugs of the original (default false = bit-exact parity with the calculator we port):
   * abatis are consumed when they fire; a trebuchet volley big enough to wipe a group kills it.
   * (marchlands) Also follow Age 1 players' battle reports where the calculator differs: traps only hit ground troops,
   * and an attacking ranged group stops once the wall is in its range (docs/reference/ballista-farming-and-wall-range.md).
   */
  fixes?: boolean;
  /** (marchlands) observe the battle: every kill on an attacking group, and each round's end state (tools/battle-sim) */
  trace?: (e: TraceEvent) => void;
}

/** Who killed attacking troops: a defending troop type (battle index), or a fortification. */
export type KillSource = number | 'trap' | 'abatis' | 'log' | 'trebuchet' | 'tower';

export type TraceEvent =
  | { kind: 'kill'; round: number; source: KillSource; target: number; killed: number; location: number }
  | {
      kind: 'round';
      round: number;
      attacker: { location: number; count: number }[];
      defender: { location: number; count: number }[];
      towers: number;
      wallHitPoints: number;
      forts: number[];
    };

export interface BattleOutcome {
  attackerTroops: number[];
  defenderTroops: number[];
  /** surviving [trap, abatis, archerTower, rollingLog, trebuchet] */
  fortifications: number[];
  wallHitPoints: number;
  attackerAlive: boolean;
  defenderAlive: boolean;
  /** 1 attacker won, 2 defender won, 3 draw (both alive after 100 rounds), 0 both wiped */
  result: number;
  totalRounds: number;
}

interface TroopStat {
  life: number;
  attack: number;
  defense: number;
  speed: number;
  range: number;
}

interface Group {
  location: number;
  typeId: number;
  count: number;
  eff: number;
  stat: TroopStat;
}

const stat = (life: number, attack: number, defense: number, speed: number, range: number): TroopStat => ({
  life,
  attack,
  defense,
  speed,
  range,
});

export const BASE_STATS: readonly TroopStat[] = [
  stat(100, 5, 50, 180, 10), // worker
  stat(200, 50, 50, 200, 20), // warrior
  stat(100, 20, 50, 3000, 20), // scout
  stat(300, 150, 150, 300, 50), // pike
  stat(350, 100, 250, 275, 30), // swords
  stat(250, 120, 50, 250, 1200), // archer
  stat(700, 10, 60, 150, 10), // transporter
  stat(500, 250, 180, 1000, 100), // cavalry
  stat(1000, 350, 350, 750, 80), // cataphract
  stat(320, 450, 160, 100, 1400), // ballista
  stat(5000, 250, 160, 120, 600), // ram
  stat(480, 600, 200, 80, 1500), // catapult
];
export const BASE_FORT_STATS: readonly TroopStat[] = [
  stat(0, 0, 0, 0, 5000), // trap
  stat(0, 0, 0, 0, 5000), // abatis
  stat(2000, 300, 360, 0, 1300), // archer tower
  stat(0, 500, 0, 0, 1300), // rolling logs
  stat(0, 800, 0, 0, 5000), // trebuchet
];

const IS_MELEE = [true, true, true, true, true, false, true, true, true, false, true, false];
const isMelee = (typeId: number) => IS_MELEE[typeId] ?? false; // archer tower (14) reads as false
const RANGED = [5, 9, 11];
const MECH = [9, 10, 11];
const MOUNTED = [7, 8];
const GROUND = [0, 1, 2, 3, 4, 5];
const MOVEMENT_ORDER = [2, 7, 8, 3, 4, 1, 0, 6, 10, 5, 9, 11];
const ATTACK_ORDER = [2, 7, 8, 3, 4, 5, 1, 0, 6, 10, 9, 11];
const NON_RANGED = [7, 8, 3, 4, 1, 0, 6, 2, 10];
const FIELD_TYPES = [0, 1, 3, 4, 6, 5, 7, 8, 9, 10, 11];
const NON_SCOUT_TYPES = [0, 1, 3, 4, 5, 7, 8, 9, 10, 11];
const TOWER_TYPE_ID = 14;

/** damageModifiers[actor][target]; 0 means x1. Column 14 is the archer tower. */
function damageModifier(actor: number, target: number): number {
  const { damage, towerDamageTaken } = BALANCE.battle;
  if (target === TOWER_TYPE_ID) return f(towerDamageTaken);
  if (actor === 3 && (target === 7 || target === 8)) return f(damage.pikemanVsMounted);
  if (actor === 4 && target === 3) return f(damage.swordsmanVsPikeman);
  if ((actor === 7 || actor === 8) && target === 5) return f(damage.mountedVsArcher);
  return 0;
}

function research(r: Partial<ResearchStats>): ResearchStats {
  return {
    militaryTradition: r.militaryTradition ?? 0,
    ironWorking: r.ironWorking ?? 0,
    medicine: r.medicine ?? 0,
    compass: r.compass ?? 0,
    horsebackRiding: r.horsebackRiding ?? 0,
    archery: r.archery ?? 0,
    machinery: r.machinery ?? 0,
  };
}

const cdiv = (a: number, b: number) => Math.trunc(a / b); // C integer division

function modifyStats(base: TroopStat[], r: ResearchStats, intel: number, atkMod: number, defMod: number, lifeMod: number, fixes: boolean) {
  const pct = BALANCE.battle.researchPct;
  for (let i = 0; i < 12; i++) {
    // max((float)(1000 - ((iw*5+100)/100)*((100+intel)/100)*defense*defMod)/1000, 0.5)
    // the original truncates (integer division), so Iron Working has no effect below level 20;
    // with `fixes` it gives the intended +5% per level
    const iwFactor = fixes ? f((r.ironWorking * pct.defence + 100) / 100) : cdiv(r.ironWorking * pct.defence + 100, 100);
    const intelFactor = f(f(100 + intel) / 100);
    let v = f(iwFactor * intelFactor);
    v = f(v * base[i].defense);
    v = f(v * defMod);
    v = f(1000 - v);
    v = f(v / 1000);
    base[i].defense = f(v > 0.5 ? v : 0.5);
  }
  for (const i of GROUND) {
    base[i].life = f(f(f(base[i].life * (r.medicine * pct.life + 100)) * lifeMod) / 100);
    base[i].attack = f(base[i].attack * atkMod);
    base[i].speed = f(f(base[i].speed * (r.compass * pct.footSpeed + 100)) / 100);
  }
  for (const i of MECH) {
    base[i].life = f(base[i].life * lifeMod);
    base[i].attack = f(base[i].attack * atkMod);
    base[i].speed = f(f(base[i].speed * (r.horsebackRiding * pct.mountedSpeed + 100)) / 100);
  }
  for (const i of RANGED) {
    base[i].range = f(f(base[i].range * (r.archery * pct.range + 100)) / 100);
  }
  for (const i of MOUNTED) {
    base[i].life = f(base[i].life * lifeMod);
    base[i].attack = f(base[i].attack * atkMod);
    base[i].speed = f(f(base[i].speed * (r.horsebackRiding * pct.mountedSpeed + 100)) / 100);
  }
}

/** A wall's hit points at `level`. */
export function wallHitPoints(level: number): number {
  return BALANCE.battle.wallHitPointsFactor * level * (level + 1);
}

const value = (g: Group) => f(g.stat.attack * f(g.eff));

export function simulateBattle(atk: BattleSide, def: DefenderSide, opts: BattleOptions): BattleOutcome {
  const fixes = opts.fixes ?? false;
  const trace = opts.trace;
  /** report a kill on an attacking group (before it is applied) */
  const killed = (round: number, source: KillSource, target: Group, n: number) =>
    trace?.({ kind: 'kill', round, source, target: target.typeId, killed: Math.min(n, target.eff), location: target.location });
  const atkStats = BASE_STATS.map((s) => ({ ...s }));
  const defStats = BASE_STATS.map((s) => ({ ...s }));
  const atkModA = f(atk.attackModifier ?? 1);
  const atkModD = f(atk.defenceModifier ?? 1);
  const atkModL = f(atk.lifeModifier ?? 1);
  const defModA = f(def.attackModifier ?? 1);
  const defModD = f(def.defenceModifier ?? 1);
  const defModL = f(def.lifeModifier ?? 1);
  const atkResearch = research(atk.research);
  const defResearch = research(def.research);
  const atkIntel = f(atk.hero?.intel ?? 0);
  const defIntel = f(def.hero?.intel ?? 0);
  modifyStats(atkStats, atkResearch, atkIntel, atkModA, atkModD, atkModL, fixes);
  modifyStats(defStats, defResearch, defIntel, defModA, defModD, defModL, fixes);

  const wallLevel = def.wallLevel ?? 0;
  const forts = [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.floor(def.fortifications?.[i] ?? 0)));
  const fortStats = BASE_FORT_STATS.map((s) => ({ ...s }));
  {
    const t = fortStats[2];
    const pct = BALANCE.battle.researchPct;
    t.life = f(f((defResearch.medicine * pct.life + 100) * t.life) / 100);
    t.attack = f(t.attack * defModA);
    // max(1 - (iw*5+100)*(100+intel)*defense*defMod/10000000, 0.5)
    let v = f((defResearch.ironWorking * pct.defence + 100) * f(100 + defIntel));
    v = f(v * t.defense);
    v = f(v * defModD);
    v = f(v / 10_000_000);
    v = f(1 - v);
    t.defense = f(v > 0.5 ? v : 0.5);
    t.range = f((t.range * (defResearch.archery * pct.range + wallLevel * BALANCE.battle.wallTowerRangePct + 100)) / 100);
  }

  let wallHp = wallHitPoints(wallLevel);
  let fieldSize = 0;
  const atkTroops = troopArray(atk.troops);
  const defTroops = troopArray(def.troops);
  for (const i of FIELD_TYPES) {
    if (atkTroops[i] > 0 || defTroops[i] > 0) fieldSize = Math.max(fieldSize, Math.trunc(200 + BASE_STATS[i].range));
  }
  for (let i = 0; i < 5; i++) if (forts[i] > 0) fieldSize = Math.max(fieldSize, Math.trunc(200 + BASE_FORT_STATS[i].range));

  const A: Group[] = atkTroops.map((n, i) => ({ location: 0, typeId: i, count: n, eff: n, stat: atkStats[i] }));
  const D: Group[] = defTroops.map((n, i) => ({ location: fieldSize, typeId: i, count: n, eff: n, stat: defStats[i] }));
  const tower: Group = { location: fieldSize, typeId: TOWER_TYPE_ID, count: forts[2], eff: forts[2], stat: fortStats[2] };

  let trapCount = forts[0];
  let abatisCount = forts[1];
  let logCount = forts[3];
  let rockCount = forts[4];
  const trapDieRate = trapCount > 0 ? cdiv(trapCount * (5 + Math.floor(opts.rng.next() * 5)), 100) : 0;
  const abatisDieRate = cdiv(abatisCount, 10);
  const logDieRate = cdiv(logCount, 10);
  const maxRockDieRate = cdiv(rockCount, 10);
  const trapKillPower = f(def.trapKillPower ?? BALANCE.battle.fortKillPower.trap);
  const logKillPower = f(def.logKillPower ?? BALANCE.battle.fortKillPower.rollingLog);
  const rockKillPower = f(def.rockKillPower ?? BALANCE.battle.fortKillPower.trebuchet);

  let attackerAlive = false;
  let defenderAlive = false;
  let round: number;
  for (round = 0; round < 100; ++round) {
    // ---- movement ----
    for (const i of MOVEMENT_ORDER) {
      let pq = D[i];
      if (i !== 2 && i !== 6 && pq.count > 0) {
        let nearest = 0;
        let inRange = false;
        const maxRange = Math.trunc(f(pq.location - pq.stat.range));
        for (const xp of A) {
          if (xp.count > 0) {
            if (xp.location >= maxRange) {
              inRange = true;
              break;
            }
            nearest = Math.max(nearest, xp.location);
          }
        }
        if (!inRange) pq.location = Math.trunc(Math.max(nearest, f(pq.location - pq.stat.speed)));
      }
      if (i === 2 || i === 6) {
        if (NON_SCOUT_TYPES.some((t) => A[t].count > 0)) continue;
      }
      pq = A[i];
      if (pq.count > 0) {
        let nearest = fieldSize;
        // (marchlands, fixes) a ranged group stands off once the wall is in its range while the wall or a tower stands,
        // as it stops for an enemy group, and shoots the towers and then the wall from there
        const maxRange = Math.trunc(f(pq.location + pq.stat.range));
        let inRange = fixes && RANGED.includes(i) && maxRange >= fieldSize && (wallHp > 0 || tower.eff > 0);
        for (const xp of D) {
          if (xp.count > 0) {
            if (xp.location <= maxRange) {
              inRange = true;
              break;
            }
            nearest = Math.min(nearest, xp.location);
          }
        }
        if (!inRange) pq.location = Math.trunc(Math.min(nearest, f(pq.location + pq.stat.speed)));
      }
    }

    // ---- troop attacks ----
    for (const i of ATTACK_ORDER) {
      // defender group i
      let pq = D[i];
      if (pq.count > 0) {
        let target: Group | null = null;
        let atkValue = 0;
        const maxRange = Math.trunc(f(pq.location - pq.stat.range));
        if (isMelee(i)) {
          let minDistance = -1;
          for (const lp of A) {
            if (lp.eff > 0 && lp.location >= maxRange) {
              const d = pq.location - lp.location;
              if (minDistance === -1 || minDistance > d || (minDistance === d && value(lp) > atkValue)) {
                target = lp;
                atkValue = value(lp);
                minDistance = d;
              }
            }
          }
        } else {
          for (const j of RANGED) {
            const lp = A[j];
            if (lp.eff > 0 && lp.location >= maxRange && value(lp) > atkValue) {
              atkValue = value(lp);
              target = lp;
            }
          }
          if (!target) target = fastest(A, (lp) => lp.location >= maxRange);
        }
        if (target) {
          const dmg = troopDamage(pq, target, pq.location - target.location);
          if (trace) killed(round, i, target, dmg);
          applyKill(target, dmg);
        }
      }

      // attacker group i
      pq = A[i];
      if (pq.count > 0) {
        let target: Group | null = null;
        let atkValue = 0;
        const maxRange = Math.trunc(f(pq.location + pq.stat.range));
        if (isMelee(i)) {
          let minDistance = -1;
          for (const lp of D) {
            if (lp.eff > 0 && lp.location <= maxRange) {
              const d = lp.location - pq.location;
              if (minDistance === -1 || minDistance > d || (minDistance === d && value(lp) > atkValue)) {
                target = lp;
                atkValue = value(lp);
                minDistance = d;
              }
            }
          }
          if (!target && tower.eff > 0 && fieldSize <= maxRange && value(tower) > atkValue) target = tower;
        } else {
          for (const j of RANGED) {
            const lp = D[j];
            if (lp.eff > 0 && lp.location <= maxRange && value(lp) > atkValue) {
              atkValue = value(lp);
              target = lp;
            }
          }
          if (tower.eff > 0 && fieldSize <= maxRange && value(tower) > atkValue) target = tower;
          if (!target) target = fastest(D, (lp) => lp.location <= maxRange);
        }
        if (target) applyKill(target, troopDamage(pq, target, target.location - pq.location));
        else if (wallHp > 0 && maxRange >= fieldSize) {
          wallHp = Math.trunc(Math.max(f(wallHp - Math.floor(f(f(pq.count) * pq.stat.attack))), 0));
        }
      }
    }

    // ---- traps ----
    if (trapCount > 0) {
      const pos = fieldSize - 5000;
      // (marchlands, fixes) traps only stop ground troops; mounted troops, transporters and siege engines pass them
      const inZone = (lp: Group) => lp.eff > 0 && lp.location >= pos && lp.location < fieldSize && (!fixes || GROUND.includes(lp.typeId));
      const groups = A.filter(inZone).length;
      if (groups > 0) {
        const maxTraps = Math.min(trapCount, trapDieRate);
        const kills = Math.trunc(f(f(maxTraps * 0.5 * trapKillPower) / groups));
        for (const lp of A) {
          if (!inZone(lp)) continue;
          if (trace) killed(round, 'trap', lp, kills);
          lp.eff = Math.max(0, lp.eff - kills);
        }
        trapCount -= maxTraps;
      }
    }

    // ---- abatis ----
    if (abatisCount > 0) {
      const pos = fieldSize - 5000;
      const inZone = (lp: Group) => lp.eff > 0 && lp.location >= pos && lp.location < fieldSize;
      const target = inZone(A[7]) ? A[7] : inZone(A[8]) ? A[8] : null;
      if (target) {
        const fired = Math.min(abatisCount, abatisDieRate);
        if (trace) killed(round, 'abatis', target, Math.trunc(fired * 0.535));
        target.eff = Math.max(target.eff - Math.trunc(fired * 0.535), 0);
        if (fixes) abatisCount -= fired;
      }
    }

    // ---- rolling logs ----
    if (logCount > 0) {
      const pos = Math.trunc(fieldSize - fortStats[3].range);
      let best = 0;
      let target: Group | null = null;
      for (const i of GROUND) {
        const lp = A[i];
        if (lp.eff > 0 && lp.location >= pos && lp.location < fieldSize && value(lp) > best) {
          target = lp;
          best = value(lp);
        }
      }
      if (target) {
        const fired = Math.min(logCount, logDieRate);
        // the original multiplies by defence (no life division), so a few hundred logs wipe out any
        // army; with fixes on they kill like every other attack: damage / (defence x life)
        const dmg = fixes
          ? Math.floor(f(f(f(fired * logKillPower) * fortStats[3].attack) / f(target.stat.defense * target.stat.life)))
          : Math.floor(f(f(f(fired * logKillPower) * fortStats[3].attack) * target.stat.defense));
        if (trace) killed(round, 'log', target, dmg);
        target.eff = Math.trunc(Math.max(f(target.eff - dmg), 0));
        logCount -= fired;
      }
    }

    // ---- trebuchets ----
    if (rockCount > 0) {
      const pos = Math.trunc(fieldSize - fortStats[4].range);
      let best = 0;
      let target: Group | null = null;
      for (const lp of A) {
        if (lp.eff > 0 && lp.location >= pos && lp.location < fieldSize && value(lp) > best) {
          target = lp;
          best = value(lp);
        }
      }
      if (target) {
        const totalDef = f(f(f(target.eff) * target.stat.life) * target.stat.defense);
        const totalAtk = f(f(maxRockDieRate * rockKillPower) * fortStats[4].attack);
        if (totalDef > totalAtk) {
          rockCount -= maxRockDieRate;
          const n = Math.floor(f(f(f(maxRockDieRate * fortStats[4].attack) * rockKillPower) / f(target.stat.defense * target.stat.life)));
          if (trace) killed(round, 'trebuchet', target, n);
          target.eff = Math.trunc(Math.max(f(target.eff - n), 0));
        } else {
          const used = Math.ceil(f(f(f(target.stat.defense * target.stat.life) * target.eff) / f(rockKillPower * fortStats[4].attack)));
          rockCount = Math.max(0, Math.trunc(f(rockCount - used)));
          if (fixes) {
            if (trace) killed(round, 'trebuchet', target, target.eff);
            target.eff = 0;
          }
        }
      }
    }

    // ---- archer towers ----
    tower.count = tower.eff;
    if (tower.count > 0) {
      let target: Group | null = null;
      let atkValue = 0;
      const maxRange = Math.trunc(f(fieldSize - tower.stat.range));
      for (const j of RANGED) {
        const lp = A[j];
        if (lp.eff > 0 && lp.location >= maxRange && value(lp) > atkValue) {
          atkValue = value(lp);
          target = lp;
        }
      }
      if (!target) target = fastest(A, (lp) => lp.location >= maxRange);
      if (target) {
        const distance = fieldSize - target.location;
        const mod = distance > f(tower.stat.range / 2) ? f(0.5) : 1;
        const n = Math.trunc(f(f(f(tower.stat.attack * f(tower.count)) * mod) / f(target.stat.defense * target.stat.life)));
        if (trace) killed(round, 'tower', target, n);
        target.eff = n > target.eff ? 0 : target.eff - n;
      }
    }

    // ---- end of round ----
    attackerAlive = false;
    defenderAlive = false;
    for (const g of A) {
      g.count = g.eff;
      if (g.count > 0) attackerAlive = true;
    }
    for (const g of D) {
      g.count = g.eff;
      if (g.count > 0) defenderAlive = true;
    }
    if (wallHp > 0) defenderAlive = true;
    trace?.({
      kind: 'round',
      round,
      attacker: A.map((g) => ({ location: g.location, count: g.count })),
      defender: D.map((g) => ({ location: g.location, count: g.count })),
      towers: tower.count,
      wallHitPoints: wallHp,
      forts: [trapCount, abatisCount, tower.count, logCount, rockCount],
    });
    if (!attackerAlive || !defenderAlive) break;
  }

  return {
    attackerTroops: A.map((g) => g.count),
    defenderTroops: D.map((g) => g.count),
    fortifications: [trapCount, abatisCount, tower.count, logCount, rockCount],
    wallHitPoints: wallHp,
    attackerAlive,
    defenderAlive,
    result: (attackerAlive ? 1 : 0) | (defenderAlive ? 2 : 0),
    totalRounds: Math.min(round + 1, 100),
  };
}

function troopArray(troops: number[]): number[] {
  return Array.from({ length: 12 }, (_, i) => Math.max(0, Math.floor(troops[i] ?? 0)));
}

/** Fastest in-range non-ranged group (ties: earlier in NON_RANGED order). */
function fastest(side: Group[], inRange: (g: Group) => boolean): Group | null {
  let best = -1;
  let target: Group | null = null;
  for (const j of NON_RANGED) {
    const lp = side[j];
    if (lp.eff > 0 && inRange(lp) && lp.stat.speed > best) {
      target = lp;
      best = lp.stat.speed;
    }
  }
  return target;
}

function troopDamage(actor: Group, target: Group, distance: number): number {
  if (isMelee(actor.typeId)) {
    let mod = damageModifier(actor.typeId, target.typeId);
    if (mod === 0) mod = 1;
    let v = f(mod * f(actor.count));
    v = f(v * actor.stat.attack);
    v = f(v * target.stat.defense);
    return Math.trunc(f(v / target.stat.life));
  }
  let mod: number;
  if (distance <= target.stat.range && isMelee(target.typeId)) mod = f(0.25);
  else if (distance > f(actor.stat.range / 2)) mod = f(0.5);
  else mod = 1;
  let v = f(actor.stat.attack * target.stat.defense);
  v = f(v * f(actor.count));
  v = f(v * mod);
  return Math.ceil(f(v / target.stat.life));
}

function applyKill(target: Group, killed: number) {
  target.eff = killed > target.eff ? 0 : target.eff - killed;
}
