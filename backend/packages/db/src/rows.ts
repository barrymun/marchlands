/**
 * The only row of a query that always gives exactly one: a `count(*)`, or an `insert … returning()` of one row.
 * Throws otherwise: an internal error rather than a message for the player, since it means a bug. A query that can
 * find nothing keeps its own check (docs/features/unchecked-index-access.md).
 */
export function one<T>(rows: readonly T[]): T {
  const [row, ...rest] = rows;
  if (row === undefined || rest.length > 0) throw new Error(`expected one row, got ${rows.length}`);
  return row;
}
