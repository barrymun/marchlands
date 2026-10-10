import { describe, expect, it } from 'vitest';
import { refundText } from '@/components/buildings-panel/building-dialog/building-detail/utils';

describe(refundText.name, () => {
  it('lists resources in gold, food, lumber, stone, iron order', () => {
    expect(refundText({ iron: 5, wood: 800, food: 1200, gold: 10, stone: 3 })).toBe('10 gold, 1,200 food, 800 lumber, 3 stone, 5 iron');
  });

  it('calls wood lumber', () => {
    expect(refundText({ wood: 800 })).toBe('800 lumber');
  });

  it('floors amounts and drops those below one', () => {
    expect(refundText({ food: 99.9, stone: 0.9, iron: 0 })).toBe('99 food');
  });

  it('drops negative amounts', () => {
    expect(refundText({ gold: -50, food: 1 })).toBe('1 food');
  });

  it('abbreviates large amounts', () => {
    expect(refundText({ food: 1_234_567 })).toBe('1.2M food');
    expect(refundText({ wood: 150_000 })).toBe('150K lumber');
  });

  it('says "nothing" when nothing is returned', () => {
    expect(refundText({})).toBe('nothing');
    expect(refundText({ gold: 0.5 })).toBe('nothing');
  });
});
