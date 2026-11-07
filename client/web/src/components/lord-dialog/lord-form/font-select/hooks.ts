import { useSyncExternalStore } from 'react';
import { DEFAULT_FONT_STYLE, getFontStyle, subscribeFontStyle } from '@/lib/font';

/** The font style shown now, re-rendering when the player picks another. */
export function useFontStyle() {
  return useSyncExternalStore(subscribeFontStyle, getFontStyle, () => DEFAULT_FONT_STYLE);
}
