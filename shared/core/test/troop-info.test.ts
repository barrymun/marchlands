import { describe, expect, it } from 'vitest';
import { BALANCE, troopConfig, troopDescription, TROOPS } from '#/index.ts';

describe(troopDescription.name, () => {
  it('describes every troop and fortification with a troopInfo message', () => {
    for (const t of TROOPS) expect(troopDescription(t.troopId)?.code, String(t.troopId)).toMatch(/^troopInfo\./);
  });

  it('is undefined for an unknown id', () => {
    expect(troopDescription(0)).toBeUndefined();
    expect(troopDescription(99)).toBeUndefined();
  });

  it('quotes the load of workers and transporters as the plural count', () => {
    expect(troopDescription(2)).toEqual({ code: 'troopInfo.worker', params: { count: troopConfig(2)!.load } });
    expect(troopDescription(8)).toEqual({ code: 'troopInfo.transporter', params: { count: troopConfig(8)!.load } });
  });

  it('quotes fortification wall space from BALANCE', () => {
    expect(troopDescription(14)?.params?.space).toBe(BALANCE.fortSpace[14] ?? 1);
    expect(troopDescription(18)?.params?.space).toBe(BALANCE.fortSpace[18] ?? 1);
  });

  it('refers to other troops by id', () => {
    expect(troopDescription(9)?.params).toMatchObject({ target: { ref: 'troop', id: 7 }, abatis: { ref: 'troop', id: 15 } });
  });

  it('quotes the damage multipliers and the tower damage taken from BALANCE.battle', () => {
    const { damage, towerDamageTaken } = BALANCE.battle;
    expect(troopDescription(5)?.params?.multiplier).toBe(damage.pikemanVsMounted);
    expect(troopDescription(6)?.params?.multiplier).toBe(damage.swordsmanVsPikeman);
    expect(troopDescription(9)?.params?.multiplier).toBe(damage.mountedVsArcher);
    expect(troopDescription(10)?.params?.multiplier).toBe(damage.mountedVsArcher);
    expect(troopDescription(16)?.params?.percent).toEqual({ share: towerDamageTaken });
  });
});
