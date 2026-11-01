import { describe, expect, it } from 'vitest';
import { parseCoords } from '@/components/map-panel/go-to-coords/utils';

describe(parseCoords.name, () => {
  it('reads two numbers with a comma, spaces or brackets', () => {
    expect(parseCoords('300, 120', 800)).toEqual({ x: 300, y: 120 });
    expect(parseCoords('300 120', 800)).toEqual({ x: 300, y: 120 });
    expect(parseCoords('(300,120)', 800)).toEqual({ x: 300, y: 120 });
    expect(parseCoords('  ( 0 , 0 )  ', 800)).toEqual({ x: 0, y: 0 });
    expect(parseCoords('300,,120', 800)).toEqual({ x: 300, y: 120 });
  });

  it('wraps numbers off the map onto it, as the map wraps', () => {
    expect(parseCoords('800, 801', 800)).toEqual({ x: 0, y: 1 });
    expect(parseCoords('-1, 0', 800)).toEqual({ x: 799, y: 0 });
  });

  it('refuses anything but two whole numbers', () => {
    expect(parseCoords('', 800)).toBeNull();
    expect(parseCoords('300', 800)).toBeNull();
    expect(parseCoords('300, 120, 5', 800)).toBeNull();
    expect(parseCoords('300.5, 120', 800)).toBeNull();
    expect(parseCoords('x, y', 800)).toBeNull();
  });
});
