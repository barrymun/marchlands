/**
 * `N` of T, as a tuple, for a helper that returns as many as it was asked for: `const [a, b] = await lords(api, 2)` gives
 * two players, never undefined (docs/features/unchecked-index-access.md).
 */
export type Tuple<T, N extends number, R extends T[] = []> = R['length'] extends N ? R : Tuple<T, N, [...R, T]>;
