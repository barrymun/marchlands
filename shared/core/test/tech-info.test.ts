import { describe, expect, it } from 'vitest';
import { BALANCE, BuildingType, FortType, MSG_CODES, msgParamNames, ref, TECH_IDS, techEffect, techInfo, TechType, TroopType } from '#/index.ts';

describe(techInfo.name, () => {
  it('describes every technology with a techInfo message', () => {
    for (const id of TECH_IDS) {
      const { summary } = techInfo(id);
      expect(summary.code.startsWith('techInfo.summary.'), `tech ${id}`).toBe(true);
      expect(MSG_CODES).toContain(summary.code);
      expect(Object.keys(summary.params ?? {}).sort()).toEqual([...msgParamNames(summary.code)].sort());
    }
  });

  it('takes its numbers from BALANCE and names game data by reference', () => {
    expect(techInfo(TechType.LUMBERING).summary).toEqual({
      code: 'techInfo.summary.resource',
      params: { resource: ref.resource('wood'), pct: { share: BALANCE.resourceTechBonusPerLevel } },
    });
    expect(techInfo(TechType.METAL_CASTING).summary.params?.troops).toEqual(
      [TroopType.TRANSPORTER, TroopType.BALLISTA, TroopType.RAM, TroopType.CATAPULT].map(ref.troop),
    );
  });

  it('lists what a tech unlocks by id, at the lowest level needed, in level order', () => {
    const unlocks = techInfo(TechType.ARCHERY).unlocks;
    expect(unlocks[0]).toEqual({ kind: 'troop', id: TroopType.ARCHER, level: 1 });
    expect(unlocks.map((u) => u.level)).toEqual([...unlocks.map((u) => u.level)].sort((a, b) => a - b));
    expect(unlocks).toContainEqual(expect.objectContaining({ kind: 'troop', id: FortType.ARCHER_TOWER }));
    // a fortification is listed as the troop it is, never as a building
    expect(unlocks.some((u) => u.kind === 'building' && u.id === BuildingType.ARCHER_TOWER)).toBe(false);
    expect(techInfo(TechType.LUMBERING).unlocks).toContainEqual({ kind: 'tech', id: TechType.MASONRY, level: 1 });
  });
});

describe(techEffect.name, () => {
  it('is null at level 0 and for techs with no effect', () => {
    expect(techEffect(TechType.AGRICULTURE, 0)).toBeNull();
    expect(techEffect(TechType.MACHINERY, 3)).toBeNull();
  });

  it('gives the total effect at a level', () => {
    expect(techEffect(TechType.CONSTRUCTION, 2)?.code).toBe('techInfo.effect.construction');
    expect((techEffect(TechType.CONSTRUCTION, 2)?.params?.pct as { share: number }).share).toBeCloseTo(0.19);
    expect(techEffect(TechType.MEDICINE, 20)?.params?.injured).toEqual({ share: BALANCE.medicineMaxShare });
    expect(techEffect(TechType.INFORMATICS, 1)?.code).toBe('techInfo.effect.informaticsHeroes');
    expect(techEffect(TechType.INFORMATICS, 2)?.code).toBe('techInfo.effect.informaticsBuildings');
  });

  it('has a message with exactly its params at every level', () => {
    for (const id of TECH_IDS)
      for (let level = 1; level <= 10; level++) {
        const m = techEffect(id, level);
        if (m) expect(Object.keys(m.params ?? {}).sort(), `tech ${id} level ${level}`).toEqual([...msgParamNames(m.code)].sort());
      }
  });

  it('quotes the battle bonuses per level from BALANCE.battle.researchPct', () => {
    const pct = BALANCE.battle.researchPct;
    expect(techInfo(TechType.MILITARY_TRADITION).summary.params?.pct).toEqual({ share: pct.attack / 100 });
    expect(techEffect(TechType.MILITARY_TRADITION, 4)?.params).toEqual({ pct: { share: (4 * pct.attack) / 100 } });
    expect(techEffect(TechType.IRON_WORKING, 3)?.params).toEqual({ pct: { share: (3 * pct.defence) / 100 } });
    expect(techEffect(TechType.ARCHERY, 7)?.params).toEqual({ pct: { share: (7 * pct.range) / 100 } });
    expect(techEffect(TechType.MEDICINE, 2)?.params).toEqual({ life: { share: (2 * pct.life) / 100 }, injured: { share: 2 * BALANCE.medicinePerLevel } });
    expect(techInfo(TechType.MEDICINE).summary.params).toMatchObject({ pct: { share: pct.life / 100 }, max: { share: BALANCE.medicineMaxShare } });
    expect(techInfo(TechType.COMPASS).summary.params?.battle).toEqual({ share: pct.footSpeed / 100 });
    expect(techInfo(TechType.HORSEBACK_RIDING).summary.params?.battle).toEqual({ share: pct.mountedSpeed / 100 });
  });
});
