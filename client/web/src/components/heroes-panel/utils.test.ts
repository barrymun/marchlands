import { describe, expect, it } from 'vitest';
import { heroesTab } from '@/components/heroes-panel/utils';

describe(heroesTab.name, () => {
  it('takes the tab the address names', () => {
    expect(heroesTab('gear')).toBe('gear');
    expect(heroesTab('heroes')).toBe('heroes');
  });

  it('shows the heroes for the Inn, which sits beside them', () => {
    expect(heroesTab('inn')).toBe('heroes');
  });

  it('shows the heroes for no tab or one it does not know', () => {
    expect(heroesTab(null)).toBe('heroes');
    expect(heroesTab('nonsense')).toBe('heroes');
  });
});
