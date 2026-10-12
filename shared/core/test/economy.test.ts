import { describe, expect, it } from 'vitest';
import { researchesInCity } from '#/index.ts';

describe(researchesInCity.name, () => {
  it("lists the techs running in that city only, and none that aren't running", () => {
    const research = {
      1: { level: 2, cityId: 10, startTime: 1, endTime: 5 },
      2: { level: 0, cityId: 11, startTime: 1, endTime: 5 },
      3: { level: 4 },
      7: { level: 1, cityId: 10, startTime: 2, endTime: 9 },
    };
    expect(researchesInCity(research, 10)).toEqual([1, 7]);
    expect(researchesInCity(research, 11)).toEqual([2]);
    expect(researchesInCity(research, 12)).toEqual([]);
    expect(researchesInCity({}, 10)).toEqual([]);
  });

  it('a tech with no end time is not running, even with a city', () => {
    expect(researchesInCity({ 1: { level: 1, cityId: 10, endTime: 0 } }, 10)).toEqual([]);
  });
});
