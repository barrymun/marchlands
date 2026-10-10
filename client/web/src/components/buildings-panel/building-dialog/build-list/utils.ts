export function areaOf(pos: number): 'inside' | 'outside' | 'walls' {
  if (pos === -2) return 'walls';
  return pos >= 1000 ? 'outside' : 'inside';
}
