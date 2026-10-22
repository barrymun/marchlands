import { useState, useSyncExternalStore } from 'react';
import { SHORT_LIST, TERMINAL_QUERY } from '@/components/market-panel/constants';
import { useMediaQuery } from '@/hooks/use-media-query';

/** Calls `onChange` whenever the classes on <html> change (next-themes puts `dark` there). */
function watchHtmlClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** Whether the page is in dark mode, so a chart drawn on a canvas can take the theme's colours again when it changes. */
export const useDarkMode = () => useSyncExternalStore(watchHtmlClass, () => document.documentElement.classList.contains('dark'));

/**
 * A long list as the page shows it: whole in the terminal, where its pane scrolls by itself; narrower, where only the
 * page scrolls, its first rows until the player asks for the rest.
 */
export function useShortList<T>(items: T[]) {
  const terminal = useMediaQuery(TERMINAL_QUERY);
  const [all, setAll] = useState(false);
  const shown = terminal || all ? items : items.slice(0, SHORT_LIST);
  return { shown, hidden: items.length - shown.length, showAll: () => setAll(true) };
}
