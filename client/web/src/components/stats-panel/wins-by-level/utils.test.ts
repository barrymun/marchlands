import { describe, expect, it } from 'vitest';
import { winsByLevel } from '@/components/stats-panel/wins-by-level/utils';

describe(winsByLevel.name, () => {
  it('lists the levels won at, barbarian cities then historic cities', () => {
    const c = { 'npcWins.16': 34, 'npcWins.9': 486, 'npcWins.10': 10_041, 'npcWins.12': 34, 'npcWins.14': 34 };
    expect(winsByLevel(c)).toEqual([
      { level: 9, wins: 486, historic: null },
      { level: 10, wins: 10_041, historic: null },
      { level: 12, wins: 34, historic: 12 },
      { level: 14, wins: 34, historic: 14 },
      { level: 16, wins: 34, historic: 16 },
    ]);
  });

  it('includes Atlantis and the lowest level', () => {
    expect(winsByLevel({ 'npcWins.1': 3, 'npcWins.18': 1 })).toEqual([
      { level: 1, wins: 3, historic: null },
      { level: 18, wins: 1, historic: 18 },
    ]);
  });

  it('leaves out levels never won at and levels that do not exist', () => {
    expect(winsByLevel({ 'npcWins.5': 0, 'npcWins.11': 7, 'npcWins.13': 2 })).toEqual([]);
    expect(winsByLevel({})).toEqual([]);
  });
});
