// A screen's place kept in the address's search parameters (/cities/12/reports?tab=army&page=3), so a reload, the
// back button and a shared link all land where the player was. A screen describes its parameters once (a schema of
// `param`s, in its constants.ts) and reads and writes them with `useSearchState` (hooks/use-search-state.ts).
//
// Reading never fails: a missing, mistyped or out-of-range value reads as the default, so an old or hand-edited
// address always opens the screen. A default is never written, so a screen nobody narrowed keeps a clean address.

/** How long a search box waits after the last key before the address takes its text (`useSearchText`). */
export const SEARCH_TEXT_DELAY_MS = 300;

/** A search box over a text parameter (`useSearchText`): what it shows, the address's text it last saw, and the last text it wrote there. */
export interface SearchBox {
  draft: string;
  seen: string;
  sent: string;
}

/** A box showing the address's text. */
export const searchBox = (value: string): SearchBox => ({ draft: value, seen: value, sent: value });

/**
 * The box once the address reads `value`: the same box while the address hasn't moved; when it moved some other way
 * (Clear filters, the back button) the box shows it; when it only caught up with what the box wrote, the keys typed
 * since stay.
 */
export function followAddress(box: SearchBox, value: string): SearchBox {
  if (value === box.seen) return box;
  return { draft: value === box.sent ? box.draft : value, seen: value, sent: box.sent };
}

/** What the box writes once typing pauses: its text, or nothing when the address already says it. */
export const textToWrite = (box: SearchBox, value: string): string | null => (box.draft === value ? null : box.draft);

/** One search parameter: how it reads from the address, and what it writes there (null for the default, left out). */
export interface Param<T> {
  read(raw: string | null): T;
  write(value: T): string | null;
}

/** A screen's parameters by name. */
export type SearchSchema = Record<string, Param<unknown>>;

/** The values a schema reads, by name. */
export type SearchValues<S extends SearchSchema> = { [K in keyof S]: S[K] extends Param<infer T> ? T : never };

/** A whole number as written in an address (no leading zeros, no -0, no exponent); anything else is null. */
function wholeNumber(raw: string | null): number | null {
  if (raw == null || !/^(?:0|-?[1-9]\d{0,15})$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/** A whole number from 1 up, as written in an address; anything else is null. */
function positiveInt(raw: string | null): number | null {
  const n = wholeNumber(raw);
  return n != null && n >= 1 ? n : null;
}

export const param = {
  /** One of a fixed list (a tab, a sort); the fallback is the default. */
  oneOf<const T extends string>(values: readonly T[], fallback: NoInfer<T>): Param<T> {
    return { read: (raw) => values.find((v) => v === raw) ?? fallback, write: (v) => (v === fallback ? null : v) };
  },
  /** One of a fixed list, or none (the default). */
  maybe<const T extends string>(values: readonly T[]): Param<T | null> {
    return { read: (raw) => values.find((v) => v === raw) ?? null, write: (v) => v };
  },
  /** Text as typed, cut to `max` characters (what the server takes); blank is the default. */
  text(max: number): Param<string> {
    return { read: (raw) => (raw ?? '').slice(0, max), write: (v) => (v.trim() ? v.slice(0, max) : null) };
  },
  /** On or off (the default), written `1`. */
  flag(): Param<boolean> {
    return { read: (raw) => raw === '1', write: (v) => (v ? '1' : null) };
  },
  /** A page number from 1 (the default). */
  page(): Param<number> {
    return { read: (raw) => positiveInt(raw) ?? 1, write: (v) => (v > 1 ? String(v) : null) };
  },
  /** The id of something shown (a report, a hero), or none (the default). */
  id(): Param<number | null> {
    return { read: positiveInt, write: (v) => (v == null ? null : String(v)) };
  },
  /** The id of something shown that the server names with a short string (a flow: letters and digits), or none. */
  key(): Param<string | null> {
    return { read: (raw) => (raw != null && /^[\da-z]{1,32}$/i.test(raw) ? raw : null), write: (v) => v };
  },
  /** A place on the map, written in the game's notation (`300,500`), or none (the default). */
  point(): Param<{ x: number; y: number } | null> {
    return {
      read: (raw) => {
        const m = raw == null ? null : /^(\d{1,4}),(\d{1,4})$/.exec(raw);
        return m?.[1] && m[2] ? { x: Number(m[1]), y: Number(m[2]) } : null;
      },
      write: (v) => (v == null ? null : `${v.x},${v.y}`),
    };
  },
  /** A whole number the screen accepts (a building's position, which may be negative), or none (the default). */
  int(accepts: (n: number) => boolean): Param<number | null> {
    return {
      read: (raw) => {
        const n = wholeNumber(raw);
        return n != null && accepts(n) ? n : null;
      },
      write: (v) => (v == null ? null : String(v)),
    };
  },
};

/**
 * The schema's values in these search parameters. A `prefix` keeps a panel's names apart from the page under it
 * (`items.q`): pages own the plain names.
 */
export function readSearch<S extends SearchSchema>(schema: S, search: URLSearchParams, prefix = ''): SearchValues<S> {
  return Object.fromEntries(Object.entries(schema).map(([name, p]) => [name, p.read(search.get(prefix + name))])) as SearchValues<S>;
}

/** What the schema reads from an empty address: the screen as nobody narrowed it. */
export function defaultsOf<S extends SearchSchema>(schema: S): SearchValues<S> {
  return readSearch(schema, new URLSearchParams());
}

/** The search parameters without those under a prefix: a panel's own, once it closes. */
export function dropPrefix(search: URLSearchParams, prefix: string): URLSearchParams {
  const next = new URLSearchParams(search);
  for (const name of new Set(next.keys())) if (name.startsWith(prefix)) next.delete(name);
  return next;
}

/** The search parameters with these values written (a default taken out), every other parameter left as it was. */
export function writeSearch<S extends SearchSchema>(schema: S, search: URLSearchParams, patch: Partial<SearchValues<S>>, prefix = ''): URLSearchParams {
  const next = new URLSearchParams(search);
  for (const [name, value] of Object.entries(patch as Record<string, unknown>)) {
    const p = schema[name];
    if (!p || value === undefined) continue;
    const raw = p.write(value);
    if (raw == null) next.delete(prefix + name);
    else next.set(prefix + name, raw);
  }
  return next;
}
