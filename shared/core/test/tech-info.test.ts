import { describe, expect, it } from 'vitest';
import { BALANCE, BuildingType, FortType, MSG_CODES, TECH_IDS, TechType, TroopType, msgParamNames, ref, techEffect, techInfo } from '../src/index.ts';

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
      params: { resource: ref.resource('wood'), pct: Math.round(BALANCE.resourceTechBonusPerLevel * 1000) / 10 },
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
    expect(techEffect(TechType.CONSTRUCTION, 2)).toEqual({ code: 'techInfo.effect.construction', params: { pct: 19 } });
    expect(techEffect(TechType.MEDICINE, 20)?.params?.injured).toBe(50);
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
});
