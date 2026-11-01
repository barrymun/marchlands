/**
 * The tile a player typed, as two whole numbers in any of the usual forms ("300, 120", "300 120", "(300,120)"), wrapped
 * onto a map `mapSize` tiles across as the map itself wraps; null for anything else.
 */
export function parseCoords(text: string, mapSize: number): { x: number; y: number } | null {
  const parts = text
    .replace(/[()]/g, ' ')
    .trim()
    .split(/[\s,]+/);
  if (parts.length !== 2 || !parts.every((p) => /^-?\d+$/.test(p))) return null;
  const [x, y] = parts.map((p) => ((Number(p) % mapSize) + mapSize) % mapSize);
  return x == null || y == null ? null : { x, y };
}
