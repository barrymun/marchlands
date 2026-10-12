import { describe, expect, it } from 'vitest';
import { simulateBattle, wallHitPoints } from '#/battle/simulator.ts';
import { resolveCombat } from '#/battle/resolve.ts';
import { BALANCE, seededRng, TechType } from '#/index.ts';
import { fixtureRng, loadBattleCases, loadBattleGoldens } from '#test/battle-fixtures.ts';

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

  it('keeps the outcome of battles with research, fortifications and walls', () => {
    const goldens = loadBattleGoldens();
    expect(goldens.length).toBe(300);
    const failures: number[] = [];
    goldens.forEach((g, i) => {
      const r = simulateBattle(g.atk, g.def, { rng: fixtureRng(g.rngSeed), fixes: g.fixes });
      const got = {
        rounds: r.totalRounds,
        attacker: r.attackerTroops,
        defender: r.defenderTroops,
        forts: r.fortifications,
        wall: r.wallHitPoints,
        result: r.result,
      };
      const want = { rounds: g.rounds, attacker: g.attacker, defender: g.defender, forts: g.forts, wall: g.wall, result: g.result };
      if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(i);
    });
    expect(failures).toEqual([]);
  });
});

describe('fortification kill power', () => {
  it('defaults to BALANCE.battle.fortKillPower', () => {
    const atk = Array(12).fill(0);
    atk[1] = 20_000;
    atk[5] = 3_000;
    const def = { research: {}, troops: Array(12).fill(0), fortifications: [3_000, 0, 0, 2_000, 1_000], wallLevel: 3 };
    const run = (extra = {}) => simulateBattle({ research: {}, troops: atk }, { ...def, ...extra }, { rng: noRng, fixes: true });
    const { trap, rollingLog, trebuchet } = BALANCE.battle.fortKillPower;
    expect(run()).toEqual(run({ trapKillPower: trap, logKillPower: rollingLog, rockKillPower: trebuchet }));
    expect(run({ trapKillPower: trap * 2 })).not.toEqual(run());
    expect(run({ logKillPower: rollingLog * 2 })).not.toEqual(run());
    expect(run({ rockKillPower: trebuchet * 2 })).not.toEqual(run());
  });
});

describe(wallHitPoints.name, () => {
  it('is BALANCE.battle.wallHitPointsFactor x level x (level + 1)', () => {
    expect(wallHitPoints(0)).toBe(0);
    expect(wallHitPoints(1)).toBe(BALANCE.battle.wallHitPointsFactor * 2);
    expect(wallHitPoints(10)).toBe(BALANCE.battle.wallHitPointsFactor * 110);
  });

  it('is the wall the simulator starts with', () => {
    const atk = Array(12).fill(0);
    atk[1] = 1; // a single warrior can't break a level 4 wall
    const r = simulateBattle({ research: {}, troops: atk }, { research: {}, troops: Array(12).fill(0), wallLevel: 4 }, { rng: noRng, fixes: true });
    expect(r.wallHitPoints).toBeGreaterThan(0);
    expect(r.wallHitPoints).toBeLessThanOrEqual(wallHitPoints(4));
  });
});

describe(resolveCombat.name, () => {
  it('adds BALANCE.battle.researchPct.attack % attack per Military Tradition level', () => {
    const troops = { militia: 10_000 };
    const defender = { troops: { militia: 10_000 }, research: {} };
    const level = 6;
    const a = resolveCombat({ troops, research: { [TechType.MILITARY_TRADITION]: { level } } }, defender, seededRng('mt'));
    const b = resolveCombat({ troops, research: {}, attackBonus: (BALANCE.battle.researchPct.attack / 100) * level }, defender, seededRng('mt'));
    expect(a.raw).toEqual(b.raw);
    const none = resolveCombat({ troops, research: {} }, defender, seededRng('mt'));
    expect(none.raw).not.toEqual(a.raw);
  });
});
