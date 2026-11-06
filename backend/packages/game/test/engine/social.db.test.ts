import { describe, expect, it } from 'vitest';

import { PlayerRelationKind } from '@marchlands/core';

import { isBlocked } from '#/engine/social.ts';
import { social } from '#/index.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

describe(isBlocked.name, () => {
  it('is true only when the receiver blocks the sender', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      expect(await isBlocked(g, a.id, b.id)).toBe(false);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.FRIEND);
      expect(await isBlocked(g, a.id, b.id)).toBe(false);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.BLOCK);
      expect(await isBlocked(g, a.id, b.id)).toBe(true);
      expect(await isBlocked(g, b.id, a.id)).toBe(false);
      await social.removeRelation(g, a.id, b.id, PlayerRelationKind.BLOCK);
      expect(await isBlocked(g, a.id, b.id)).toBe(false);
    }));
});
