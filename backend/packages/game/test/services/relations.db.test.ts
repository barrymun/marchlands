import { describe, expect, it } from 'vitest';
import { Relation } from '@marchlands/core';
import { alliance, relations } from '../../src/index.ts';
import { createTestPlayer } from '../support/factories.ts';
import { game } from '../support/game.ts';
import { foundAlliance, joinAlliance } from '../support/alliance.ts';

describe(relations.allianceOf.name, () => {
  it('is null for a player without an alliance and the alliance id for a member', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      expect(await relations.allianceOf(g, a.id)).toBeNull();
      const id = await foundAlliance(g, a, 'Order');
      await joinAlliance(g, a, b, 'Order');
      expect(await relations.allianceOf(g, a.id)).toBe(id);
      expect(await relations.allianceOf(g, b.id)).toBe(id);
    }));

  it('is null for an unknown player', () =>
    game(async (g) => {
      expect(await relations.allianceOf(g, 2_000_000_000)).toBeNull();
    }));
});

describe(relations.allianceRelation.name, () => {
  it('an alliance is ALLIANCE to itself and NO_RELATION to another by default', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const x = await foundAlliance(g, a, 'Order');
      const y = await foundAlliance(g, b, 'Chaos');
      expect(await relations.allianceRelation(g, x, x)).toBe(Relation.ALLIANCE);
      expect(await relations.allianceRelation(g, x, y)).toBe(Relation.NO_RELATION);
    }));

  it('friendship and neutrality are one-sided, as stored', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const x = await foundAlliance(g, a, 'Order');
      const y = await foundAlliance(g, b, 'Chaos');
      await alliance.setRelation(g, a.id, 'Chaos', Relation.ALLY);
      expect(await relations.allianceRelation(g, x, y)).toBe(Relation.ALLY);
      expect(await relations.allianceRelation(g, y, x)).toBe(Relation.NO_RELATION);
      await alliance.setRelation(g, a.id, 'Chaos', Relation.NEUTRAL);
      expect(await relations.allianceRelation(g, x, y)).toBe(Relation.NEUTRAL);
    }));

  it('war is mutual', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const x = await foundAlliance(g, a, 'Order');
      const y = await foundAlliance(g, b, 'Chaos');
      await alliance.setRelation(g, a.id, 'Chaos', Relation.ENEMY);
      expect(await relations.allianceRelation(g, x, y)).toBe(Relation.ENEMY);
      expect(await relations.allianceRelation(g, y, x)).toBe(Relation.ENEMY);
    }));
});

describe(relations.relationBetween.name, () => {
  it('a player is SELF to themselves, alliance or not', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await relations.relationBetween(g, a.id, a.id)).toBe(Relation.SELF);
      await foundAlliance(g, a, 'Order');
      expect(await relations.relationBetween(g, a.id, a.id)).toBe(Relation.SELF);
    }));

  it('two players without an alliance have no relation (they are not one alliance)', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      expect(await relations.relationBetween(g, a.id, b.id)).toBe(Relation.NO_RELATION);
    }));

  it('a member and a player without an alliance have no relation either way', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      expect(await relations.relationBetween(g, a.id, b.id)).toBe(Relation.NO_RELATION);
      expect(await relations.relationBetween(g, b.id, a.id)).toBe(Relation.NO_RELATION);
    }));

  it('members of one alliance are ALLIANCE', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      await joinAlliance(g, a, b, 'Order');
      expect(await relations.relationBetween(g, a.id, b.id)).toBe(Relation.ALLIANCE);
      expect(await relations.relationBetween(g, b.id, a.id)).toBe(Relation.ALLIANCE);
    }));

  it("members of different alliances see the viewer's alliance relation", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      await foundAlliance(g, b, 'Chaos');
      await joinAlliance(g, b, c, 'Chaos');
      expect(await relations.relationBetween(g, a.id, c.id)).toBe(Relation.NO_RELATION);
      await alliance.setRelation(g, a.id, 'Chaos', Relation.ALLY);
      expect(await relations.relationBetween(g, a.id, c.id)).toBe(Relation.ALLY);
      expect(await relations.relationBetween(g, c.id, a.id)).toBe(Relation.NO_RELATION);
      await alliance.setRelation(g, a.id, 'Chaos', Relation.ENEMY);
      expect(await relations.relationBetween(g, c.id, a.id)).toBe(Relation.ENEMY);
    }));

  it('an unknown player has no relation', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      expect(await relations.relationBetween(g, a.id, 2_000_000_000)).toBe(Relation.NO_RELATION);
    }));
});

describe('isFriendly', () => {
  it('only self, alliance and ally are friendly', () => {
    expect(Object.values(Relation).filter(relations.isFriendly)).toEqual([Relation.ALLIANCE, Relation.ALLY, Relation.SELF]);
  });
});
