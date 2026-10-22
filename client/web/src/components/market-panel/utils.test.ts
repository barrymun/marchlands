import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESOURCES } from '@/components/market-panel/constants';
import { cssColour, fmtPrice, resInline, resLabel } from '@/components/market-panel/utils';

describe(resLabel.name, () => {
  it('labels every tradeable resource by its type', () => {
    for (const r of RESOURCES) expect(resLabel(r.type)).toBe(r.label);
    expect(resLabel(1)).toBe('Lumber');
  });

  it('labels type 4 as gold', () => {
    expect(resLabel(4)).toBe('Gold');
  });

  it('falls back to "#<type>" for unknown types', () => {
    expect(resLabel(5)).toBe('#5');
    expect(resLabel(-1)).toBe('#-1');
  });
});

describe(resInline.name, () => {
  it('names every tradeable resource in lower case, wood as lumber', () => {
    expect(RESOURCES.map((r) => resInline(r.type))).toEqual(['food', 'lumber', 'stone', 'iron']);
  });

  it('names type 4 gold', () => {
    expect(resInline(4)).toBe('gold');
  });

  it('falls back to "#<type>" for unknown types', () => {
    expect(resInline(5)).toBe('#5');
    expect(resInline(-1)).toBe('#-1');
  });
});

describe(fmtPrice.name, () => {
  it('always shows exactly three decimals', () => {
    expect(fmtPrice(1)).toBe('1.000');
    expect(fmtPrice(0)).toBe('0.000');
    expect(fmtPrice(-1.5)).toBe('-1.500');
  });

  it('rounds to three decimals', () => {
    expect(fmtPrice(0.12345)).toBe('0.123');
    expect(fmtPrice(0.9999)).toBe('1.000');
  });

  it('groups thousands', () => {
    expect(fmtPrice(1234.5)).toBe('1,234.500');
    expect(fmtPrice(1_000_000)).toBe('1,000,000.000');
  });
});

describe(cssColour.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A document whose canvas reads back `pixel` (none: no canvas) and remembers the colours it was given. */
  function stubCanvas(pixel: number[] | null) {
    const painted: string[] = [];
    const ctx = {
      set fillStyle(c: string) {
        painted.push(c);
      },
      fillRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(pixel ?? []) }),
    };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => (pixel ? ctx : null) }) });
    return painted;
  }

  it('paints the colour and reads it back as RGBA, alpha from 0 to 1', () => {
    const painted = stubCanvas([16, 185, 129, 255]);
    expect(cssColour('oklch(0.6 0.15 160)')).toEqual([16, 185, 129, 1]);
    expect(painted).toEqual(['oklch(0.6 0.15 160)']);
    stubCanvas([255, 0, 0, 51]);
    expect(cssColour('color-mix(in oklch, red 20%, transparent)')).toEqual([255, 0, 0, 0.2]);
  });

  it('is null without a canvas', () => {
    stubCanvas(null);
    expect(cssColour('red')).toBeNull();
  });
});
