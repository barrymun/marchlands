import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

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
