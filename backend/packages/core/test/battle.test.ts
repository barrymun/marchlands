import { describe, expect, it } from 'vitest';
import { simulateBattle } from '../src/battle/simulator.ts';
import { loadBattleCases } from './battle-fixtures.ts';

const noRng = { next: () => 0 };

describe('battle simulator', () => {
  it('matches every regression case of the original C++ calculator', () => {
    const cases = loadBattleCases();
    expect(cases.length).toBeGreaterThan(36_000);
    const failures: string[] = [];
    for (const c of cases) {
      const r = simulateBattle({ research: {}, troops: c.atk }, { research: {}, troops: c.def }, { rng: noRng });
      let good = r.totalRounds === c.rounds;
      for (let i = 0; i < 12 && good; i++) {
        if (r.attackerTroops[i] !== c.atk[i] - c.atkLoss[i] || r.defenderTroops[i] !== c.def[i] - c.defLoss[i]) good = false;
      }
      if (!good && failures.length < 10) failures.push(`${c.file}: ${c.line}`);
    }
    expect(failures).toEqual([]);
  });

  it('worked example: 1000 archers vs 2,000,000 workers (spec §9.3)', () => {
    const atk = Array(12).fill(0);
    atk[5] = 1000;
    const def = Array(12).fill(0);
    def[0] = 2_000_000;
    const r = simulateBattle({ research: {}, troops: atk }, { research: {}, troops: def }, { rng: noRng });
    expect(r.totalRounds).toBe(7);
    expect(r.attackerTroops[5]).toBe(0);
    expect(r.defenderTroops[0]).toBe(2_000_000 - 5415);
    expect(r.result).toBe(2);
  });

  it('walls must be broken before the attacker wins', () => {
    const atk = Array(12).fill(0);
    atk[7] = 20_000;
    const r = simulateBattle(
      { research: {}, troops: atk },
      { research: {}, troops: Array(12).fill(0), fortifications: [0, 10_000, 0, 0, 0], wallLevel: 1 },
      { rng: noRng },
    );
    expect(r.attackerAlive).toBe(true);
    expect(r.wallHitPoints).toBe(0);
    expect(r.attackerTroops[7]).toBeLessThan(20_000);
    expect(r.fortifications[1]).toBe(10_000); // parity: abatis never consumed
    const fixed = simulateBattle(
      { research: {}, troops: atk },
      { research: {}, troops: Array(12).fill(0), fortifications: [0, 10_000, 0, 0, 0], wallLevel: 1 },
      { rng: noRng, fixes: true },
    );
    expect(fixed.fortifications[1]).toBeLessThan(10_000);
  });
});
