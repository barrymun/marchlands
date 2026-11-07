import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FONT_STYLE, FontStyle, fontStyleOf, getFontStyle, loadFontStyle, setFontStyle, startFontStyle, subscribeFontStyle } from '@/lib/font';

/** A stand-in <html>: what the styles are shown by. */
function stubPage(stored: string | null = null) {
  const html = { dataset: {} as Record<string, string> };
  const setItem = vi.fn();
  vi.stubGlobal('document', { documentElement: html });
  vi.stubGlobal('localStorage', { getItem: (key: string) => (key === 'marchlands-font' ? stored : null), setItem });
  return { html, setItem };
}

describe(fontStyleOf.name, () => {
  it('reads every style by its value', () => {
    for (const style of Object.values(FontStyle)) expect(fontStyleOf(style)).toBe(style);
  });

  it('falls back to Classic for none, or a value no longer offered', () => {
    expect(DEFAULT_FONT_STYLE).toBe(FontStyle.CLASSIC);
    expect(fontStyleOf(null)).toBe(FontStyle.CLASSIC);
    expect(fontStyleOf(undefined)).toBe(FontStyle.CLASSIC);
    expect(fontStyleOf('')).toBe(FontStyle.CLASSIC);
    expect(fontStyleOf('geist')).toBe(FontStyle.CLASSIC);
    expect(fontStyleOf('LEDGER')).toBe(FontStyle.CLASSIC);
  });
});

describe(loadFontStyle.name, () => {
  it("settles for every style, Classic's fonts being always there", async () => {
    for (const style of Object.values(FontStyle)) await expect(loadFontStyle(style)).resolves.toBeUndefined();
  });
});

describe(startFontStyle.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the remembered style', async () => {
    const { html } = stubPage('terminal');
    await startFontStyle();
    expect(html.dataset.font).toBe('terminal');
    expect(getFontStyle()).toBe(FontStyle.TERMINAL);
  });

  it('shows Classic with nothing remembered', async () => {
    const { html } = stubPage(null);
    await startFontStyle();
    expect(html.dataset.font).toBe('classic');
    expect(getFontStyle()).toBe(FontStyle.CLASSIC);
  });

  it('shows Classic when storage throws', async () => {
    const { html } = stubPage();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    await startFontStyle();
    expect(html.dataset.font).toBe('classic');
  });
});

describe(setFontStyle.name, () => {
  beforeEach(async () => {
    stubPage();
    await startFontStyle();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the style at once and remembers it', () => {
    const { html, setItem } = stubPage();
    setFontStyle(FontStyle.LEDGER);
    expect(html.dataset.font).toBe('ledger');
    expect(setItem).toHaveBeenCalledWith('marchlands-font', 'ledger');
    expect(getFontStyle()).toBe(FontStyle.LEDGER);
  });

  it('still shows the style when storage throws', () => {
    const { html } = stubPage();
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked');
      },
    });
    setFontStyle(FontStyle.CLEAR);
    expect(html.dataset.font).toBe('clear');
    expect(getFontStyle()).toBe(FontStyle.CLEAR);
  });
});

describe(subscribeFontStyle.name, () => {
  beforeEach(() => stubPage());
  afterEach(() => vi.unstubAllGlobals());

  it('tells a listener of each change until it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFontStyle(listener);
    setFontStyle(FontStyle.TERMINAL);
    setFontStyle(FontStyle.CLASSIC);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setFontStyle(FontStyle.LEDGER);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
