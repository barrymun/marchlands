import { describe, expect, it } from 'vitest';

import { Relation } from '@marchlands/core';

import { isFriendly, relationBetween } from '#/engine/relations.ts';
import { alliance } from '#/index.ts';
import { foundAlliance, joinAlliance } from '#test/support/alliance.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

describe(relationBetween.name, () => {
  it('a player is SELF to themselves, alliance or not', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await relationBetween(g, a.id, a.id)).toBe(Relation.SELF);
      await foundAlliance(g, a, 'Order');
      expect(await relationBetween(g, a.id, a.id)).toBe(Relation.SELF);
    }));

  it('two players without an alliance have no relation (they are not one alliance)', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      expect(await relationBetween(g, a.id, b.id)).toBe(Relation.NO_RELATION);
    }));

  it('a member and a player without an alliance have no relation either way', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      expect(await relationBetween(g, a.id, b.id)).toBe(Relation.NO_RELATION);
      expect(await relationBetween(g, b.id, a.id)).toBe(Relation.NO_RELATION);
    }));

  it('members of one alliance are ALLIANCE', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      await joinAlliance(g, a, b, 'Order');
      expect(await relationBetween(g, a.id, b.id)).toBe(Relation.ALLIANCE);
      expect(await relationBetween(g, b.id, a.id)).toBe(Relation.ALLIANCE);
    }));

  it("members of different alliances see the viewer's alliance relation", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      await foundAlliance(g, b, 'Chaos');
      await joinAlliance(g, b, c, 'Chaos');
      expect(await relationBetween(g, a.id, c.id)).toBe(Relation.NO_RELATION);
      await alliance.setRelation(g, a.id, 'Chaos', Relation.ALLY);
      expect(await relationBetween(g, a.id, c.id)).toBe(Relation.ALLY);
      expect(await relationBetween(g, c.id, a.id)).toBe(Relation.NO_RELATION);
      await alliance.setRelation(g, a.id, 'Chaos', Relation.NEUTRAL);
      expect(await relationBetween(g, a.id, c.id)).toBe(Relation.NEUTRAL);
      // war is mutual
      await alliance.setRelation(g, a.id, 'Chaos', Relation.ENEMY);
      expect(await relationBetween(g, a.id, c.id)).toBe(Relation.ENEMY);
      expect(await relationBetween(g, c.id, a.id)).toBe(Relation.ENEMY);
    }));

  it('an unknown player has no relation', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      expect(await relationBetween(g, a.id, 2_000_000_000)).toBe(Relation.NO_RELATION);
    }));
});

describe('isFriendly', () => {
  it('only self, alliance and ally are friendly', () => {
    expect(Object.values(Relation).filter(isFriendly)).toEqual([Relation.ALLIANCE, Relation.ALLY, Relation.SELF]);
  });
});
