import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIGURE_KEY, FigureMode } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/constants';
import { figureMode, saveFigureMode, webglWorks } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/utils';

afterEach(() => vi.unstubAllGlobals());

describe(figureMode.name, () => {
  it('is 3D unless 2D was picked', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === FIGURE_KEY ? '2d' : null) });
    expect(figureMode()).toBe(FigureMode.TWO_D);
    vi.stubGlobal('localStorage', { getItem: () => '3d' });
    expect(figureMode()).toBe(FigureMode.THREE_D);
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(figureMode()).toBe(FigureMode.THREE_D);
    vi.stubGlobal('localStorage', { getItem: () => 'something else' });
    expect(figureMode()).toBe(FigureMode.THREE_D);
  });

  it('is 3D without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(figureMode()).toBe(FigureMode.THREE_D);
  });
});

describe(saveFigureMode.name, () => {
  it('stores the choice under its key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    saveFigureMode(FigureMode.TWO_D);
    expect(setItem).toHaveBeenCalledWith(FIGURE_KEY, '2d');
  });

  it('carries on without storage', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveFigureMode(FigureMode.THREE_D)).not.toThrow();
  });
});

describe(webglWorks.name, () => {
  const withContext = (getContext: () => unknown) => vi.stubGlobal('document', { createElement: () => ({ getContext }) });

  it('is true where a canvas gives a WebGL 2 context', () => {
    withContext(() => ({}));
    expect(webglWorks()).toBe(true);
  });

  it('is false where it gives none, or throws', () => {
    withContext(() => null);
    expect(webglWorks()).toBe(false);
    withContext(() => {
      throw new Error('no WebGL');
    });
    expect(webglWorks()).toBe(false);
  });
});
