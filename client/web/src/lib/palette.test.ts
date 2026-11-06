import { describe, expect, it } from 'vitest';
import { Colour, PALETTE } from '@/lib/palette';

describe('Colour', () => {
  it('names every colour of the palette', () => {
    expect(Object.keys(Colour)).toEqual(Object.keys(PALETTE));
    for (const [name, value] of Object.entries(Colour)) expect(value).toBe(name);
  });

  it('starts with the colour that is no pixel, index 0 in the sprites', () => {
    expect(Object.keys(PALETTE)[0]).toBe(Colour.CLEAR);
  });
});
