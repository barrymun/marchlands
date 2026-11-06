import { describe, expect, it } from 'vitest';
import { BattleResult } from '@marchlands/core';
import { resultLabel } from '@/components/reports-panel/report-dialog/report-content/battle-view/utils';

describe(resultLabel.name, () => {
  it('labels the two decisive outcomes', () => {
    expect(resultLabel(BattleResult.ATTACKER_WON)).toBe('Attacker won');
    expect(resultLabel(BattleResult.DEFENDER_WON)).toBe('Defender won');
  });

  it('treats anything else as a draw', () => {
    expect(resultLabel(BattleResult.DRAW)).toBe('Draw');
    expect(resultLabel('')).toBe('Draw');
    expect(resultLabel('AttackerWon')).toBe('Draw');
  });
});
