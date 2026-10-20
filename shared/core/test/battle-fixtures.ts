import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import type { BattleSide, DefenderSide } from '#/battle/simulator.ts';

export interface BattleCase {
  file: string;
  line: string;
  atk: number[];
  def: number[];
  rounds: number;
  atkLoss: number[];
  defLoss: number[];
}

const parseList = (s: string) => {
  const out = new Array(12).fill(0);
  for (const part of s.split(',').filter(Boolean)) {
    const [i, n] = part.split('_').map(Number);
    out[i] = n;
  }
  return out;
};

/** Regression lines from EvonyAge1BattleCalc: `atk|def|rounds|atkLoss|defLoss`. */
export function loadBattleCases(): BattleCase[] {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/battlecalc-testdata.txt.gz');
  const text = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
  const cases: BattleCase[] = [];
  let current = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) {
      current = line.slice(2);
      continue;
    }
    const parts = line.split('|');
    if (parts.length !== 5) continue;
    cases.push({
      file: current,
      line,
      atk: parseList(parts[0]),
      def: parseList(parts[1]),
      rounds: Number(parts[2]),
      atkLoss: parseList(parts[3]),
      defLoss: parseList(parts[4]),
    });
  }
  return cases;
}

export interface BattleGolden {
  atk: BattleSide;
  def: DefenderSide;
  fixes: boolean;
  /** seed of the test's random number generator (`fixtureRng`) */
  rngSeed: number;
  rounds: number;
  attacker: number[];
  defender: number[];
  forts: number[];
  wall: number;
  result: number;
}

/**
 * Random battles with research, hero stratagem, fortifications and walls, and their outcome as the
 * simulator gave it when every battle rule was a number written into it (before BALANCE.battle). The
 * original's regression data has no research or walls, so this pins those rules. The 149 run with `fixes`
 * were regenerated on 2026-10-20, when traps began hitting only ground troops and ranged groups stopping
 * once the wall is in range (docs/deviations.md); the others are unchanged.
 */
export function loadBattleGoldens(): BattleGolden[] {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/battle-research-walls.jsonl.gz');
  return zlib
    .gunzipSync(fs.readFileSync(file))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BattleGolden);
}

/** The random number generator the golden battles were run with. */
export function fixtureRng(seed: number) {
  let x = seed;
  return { next: () => ((x = (x * 69069 + 1) % 4294967296), x / 4294967296) };
}
