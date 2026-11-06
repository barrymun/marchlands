import { describe, expect, it } from 'vitest';
import { MovementReportSchema } from '#/types.ts';

describe('MovementReportSchema', () => {
  const army = { hero: null, troops: { archer: 5 } };
  const resources = { gold: 0, food: 0, wood: 0, stone: 4000, iron: 0 };

  it('keeps who sent an ally’s reinforcements and the goods they delivered', () => {
    const report = { ...army, from: 'Ally', resources };
    expect(MovementReportSchema.parse(report)).toEqual(report);
  });

  it('still reads an ally’s report with no goods, as older reports are', () => {
    const report = { ...army, from: 'Ally' };
    expect(MovementReportSchema.parse(report)).toEqual(report);
  });

  it('reads reinforcements reaching the player’s own city, and an army come home', () => {
    const own = { ...army, resources, heroReturned: true };
    const home = { ...army, resources };
    expect(MovementReportSchema.parse(own)).toEqual(own);
    expect(MovementReportSchema.parse(home)).toEqual(home);
  });
});
