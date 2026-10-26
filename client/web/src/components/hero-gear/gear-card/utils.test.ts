import { afterEach, describe, expect, it, vi } from 'vitest';
import { GEAR_LEVEL_KEY } from '@/components/hero-gear/gear-card/constants';
import { gearLevelRose, rememberedGearLevel, rememberGearLevel } from '@/components/hero-gear/gear-card/utils';

afterEach(() => vi.unstubAllGlobals());

/** A localStorage holding `stored` under the gear level's key, recording what is set. */
function storage(stored: string | null) {
  const setItem = vi.fn();
  vi.stubGlobal('localStorage', { getItem: (key: string) => (key === GEAR_LEVEL_KEY ? stored : null), setItem });
  return setItem;
}

describe(rememberedGearLevel.name, () => {
  it('reads the level remembered for the player', () => {
    storage('{"12":4,"30":9}');
    expect(rememberedGearLevel(12)).toBe(4);
    expect(rememberedGearLevel(30)).toBe(9);
  });

  it('is null for a player never shown, or nothing stored', () => {
    storage('{"12":4}');
    expect(rememberedGearLevel(13)).toBeNull();
    storage(null);
    expect(rememberedGearLevel(12)).toBeNull();
  });

  it('is null for what it cannot read', () => {
    storage('not json');
    expect(rememberedGearLevel(12)).toBeNull();
    storage('{"12":"four"}');
    expect(rememberedGearLevel(12)).toBeNull();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(rememberedGearLevel(12)).toBeNull();
  });
});

describe(rememberGearLevel.name, () => {
  it('stores the level beside other players’', () => {
    const setItem = storage('{"30":9}');
    rememberGearLevel(12, 5);
    expect(setItem).toHaveBeenCalledWith(GEAR_LEVEL_KEY, '{"12":5,"30":9}');
  });

  it('starts afresh over what it cannot read', () => {
    for (const stored of ['[broken', 'null', '[1,2]']) {
      const setItem = storage(stored);
      rememberGearLevel(12, 5);
      expect(setItem).toHaveBeenCalledWith(GEAR_LEVEL_KEY, '{"12":5}');
    }
  });

  it('carries on without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => rememberGearLevel(12, 5)).not.toThrow();
  });
});

describe(gearLevelRose.name, () => {
  it('is true only when the level is above the one last shown', () => {
    expect(gearLevelRose(3, 4)).toBe(true);
    expect(gearLevelRose(4, 4)).toBe(false);
    expect(gearLevelRose(5, 4)).toBe(false);
  });

  it('is false when the card never showed the gear before', () => {
    expect(gearLevelRose(null, 10)).toBe(false);
  });
});
