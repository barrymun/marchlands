// List helpers that never read past the end (docs/features/unchecked-index-access.md: iterate, don't index).

/** Each element with the one after it: [a, b], [b, c] … (none for fewer than two). */
export function pairs<T>(list: Iterable<T>): [T, T][] {
  const out: [T, T][] = [];
  let prev: { value: T } | null = null;
  for (const value of list) {
    if (prev) out.push([prev.value, value]);
    prev = { value };
  }
  return out;
}

/** A copy of `list` with the element at `from` moved to `to`; unchanged when `from` is out of range. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const taken = next.splice(from, 1);
  if (!taken.length) return next;
  next.splice(to, 0, ...taken);
  return next;
}
