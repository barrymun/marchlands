import { describe, expect, it } from 'vitest';
import type { GetPlayerResponse, HeroBean } from '@marchlands/api-client';
import { patchHeroes, patchPlayerHeroes, resourceName } from '@/lib/push/utils';

const hero = (id: number, level = 1) => ({ id, name: `Hero ${id}`, level }) as HeroBean;

describe(patchHeroes.name, () => {
  it('replaces an existing hero in place, keeping the order', () => {
    const out = patchHeroes([hero(1), hero(2), hero(3)], hero(2, 9), 0);
    expect(out.map((h) => [h.id, h.level])).toEqual([
      [1, 1],
      [2, 9],
      [3, 1],
    ]);
  });
  it('adds a hero it does not have yet at the end', () => {
    expect(patchHeroes([hero(1)], hero(5), 0).map((h) => h.id)).toEqual([1, 5]);
  });
  it('removes the hero when it left (updateType 1)', () => {
    expect(patchHeroes([hero(1), hero(2)], hero(1), 1).map((h) => h.id)).toEqual([2]);
  });
  it('does not change the list it was given', () => {
    const list = [hero(1)];
    patchHeroes(list, hero(1, 5), 0);
    expect(list[0]!.level).toBe(1);
  });
});

describe(patchPlayerHeroes.name, () => {
  const player = {
    castles: [
      { id: 10, heros: [hero(1)] },
      { id: 11, heros: [hero(2)] },
    ],
  } as unknown as GetPlayerResponse;

  it('patches only the hero list of the given city', () => {
    const out = patchPlayerHeroes(player, 11, hero(2, 7), 0);
    expect(out.castles[0]!.heros).toBe(player.castles[0]!.heros);
    expect(out.castles[1]!.heros[0]!.level).toBe(7);
  });
  it('leaves the player unchanged for a city it does not own', () => {
    expect(patchPlayerHeroes(player, 99, hero(3), 0).castles).toEqual(player.castles);
  });
});

describe(resourceName.name, () => {
  it('names the four market resources', () => {
    expect([0, 1, 2, 3].map(resourceName)).toEqual(['food', 'lumber', 'stone', 'iron']);
  });
  it('falls back to goods for anything else', () => {
    expect(resourceName(4)).toBe('goods');
    expect(resourceName(-1)).toBe('goods');
  });
});
