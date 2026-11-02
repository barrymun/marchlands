import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type PanelId, panelPrefix } from '@/lib/nav';
import {
  dropPrefix,
  followAddress,
  readSearch,
  SEARCH_TEXT_DELAY_MS,
  searchBox,
  type SearchSchema,
  type SearchValues,
  textToWrite,
  writeSearch,
} from '@/lib/search-state';

/**
 * A screen's place in the address (lib/search-state.ts): its values, read from the search parameters, and `set` to
 * change some of them, leaving every other parameter (the panel, another screen's) as it was. A change replaces the
 * address, so the back button doesn't step through every filter tried; `{ push: true }` adds a step instead, for
 * something the back button should close (an opened report), and `drop` takes out every name under a prefix (a
 * panel's own, as it closes). A panel names itself (`{ panel: PanelId.ITEMS }`), so its names (`items.q`) stay apart from
 * the page under it and go when it closes (`useGameNav`).
 */
export function useSearchState<S extends SearchSchema>(schema: S, { panel }: { panel?: PanelId } = {}) {
  const [search, setSearch] = useSearchParams();
  const prefix = panel ? panelPrefix(panel) : '';
  const values = useMemo(() => readSearch(schema, search, prefix), [schema, search, prefix]);
  const set = useCallback(
    (patch: Partial<SearchValues<S>>, { push = false, drop }: { push?: boolean; drop?: string } = {}) =>
      setSearch((s) => writeSearch(schema, drop ? dropPrefix(s, drop) : s, patch, prefix), { replace: !push }),
    [schema, setSearch, prefix],
  );
  return [values, set] as const;
}

/**
 * A search box over a text parameter: the box shows each key at once, and `onSettled` writes the address (and so asks
 * the server) once typing has paused for `ms`. When the address changes some other way (Clear filters, the back
 * button), the box follows it; when it only catches up with what the box wrote, keys typed since stay
 * (`followAddress`, lib/search-state.ts).
 */
export function useSearchText(value: string, onSettled: (text: string) => void, ms = SEARCH_TEXT_DELAY_MS) {
  const [box, setBox] = useState(() => searchBox(value));
  const followed = followAddress(box, value);
  if (followed !== box) setBox(followed);
  const settle = useEffectEvent(() => {
    const text = textToWrite(box, value);
    if (text == null) return;
    setBox((b) => ({ ...b, sent: text }));
    onSettled(text);
  });
  useEffect(() => {
    const id = setTimeout(settle, ms);
    return () => clearTimeout(id);
  }, [box.draft, ms]);
  const setDraft = useCallback((draft: string) => setBox((b) => ({ ...b, draft })), []);
  return [followed.draft, setDraft] as const;
}
