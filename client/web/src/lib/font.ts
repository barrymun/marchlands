// The font style the client shows, chosen in Player settings and kept in this browser, like the locale. The styles
// themselves are CSS (index.css, `[data-font=…]` on <html>): this only picks one, remembers it and tells the select.

/** The font styles a player can choose, by the values they're remembered under, so a value never changes. */
export const FontStyle = { CLASSIC: 'classic', LEDGER: 'ledger', TERMINAL: 'terminal', CLEAR: 'clear' } as const;
export type FontStyle = (typeof FontStyle)[keyof typeof FontStyle];
export const FONT_STYLES = Object.values(FontStyle);
export const DEFAULT_FONT_STYLE: FontStyle = FontStyle.CLASSIC;
/** localStorage key of the chosen style */
const STORAGE_KEY = 'marchlands-font';

/** The style a remembered value names; the default for none, or for a value no longer offered. */
export function fontStyleOf(value: string | null | undefined): FontStyle {
  return FONT_STYLES.find((style) => style === value) ?? DEFAULT_FONT_STYLE;
}

/** Each style's @font-face rules beyond Classic's, which are in index.css, so the first page carries one style's. */
const STYLE_FONTS: Record<FontStyle, (() => Promise<unknown>) | null> = {
  [FontStyle.CLASSIC]: null,
  [FontStyle.LEDGER]: () => import('@/lib/fonts/ledger.css'),
  [FontStyle.TERMINAL]: () => import('@/lib/fonts/terminal.css'),
  [FontStyle.CLEAR]: () => import('@/lib/fonts/clear.css'),
};

/** Loads a style's fonts. Settles either way: a failed download leaves the fallback fonts, and is tried again next time. */
export function loadFontStyle(style: FontStyle): Promise<void> {
  const load = STYLE_FONTS[style];
  if (!load) return Promise.resolve();
  return load().then(
    () => undefined,
    () => undefined,
  );
}

let current: FontStyle = DEFAULT_FONT_STYLE;
const listeners = new Set<() => void>();

function show(style: FontStyle) {
  document.documentElement.dataset.font = style;
}

/** Shows the remembered style and loads its fonts; main.tsx waits for it before the first render, so nothing shows in another font first. */
export function startFontStyle(): Promise<void> {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // storage blocked: the default
  }
  current = fontStyleOf(stored);
  show(current);
  return loadFontStyle(current);
}

/** Shows a style at once (its text swaps into its fonts as they arrive) and remembers it in this browser. */
export function setFontStyle(style: FontStyle) {
  current = style;
  show(style);
  void loadFontStyle(style);
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // storage blocked: it lasts until the page is reloaded
  }
  for (const listener of listeners) listener();
}

/** The style shown now (for useSyncExternalStore). */
export function getFontStyle(): FontStyle {
  return current;
}

/** Calls `listener` whenever the style changes (for useSyncExternalStore); returns the unsubscribe. */
export function subscribeFontStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
