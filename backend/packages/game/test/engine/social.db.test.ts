import { describe, expect, it } from 'vitest';
import { social } from '#/index.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { isBlocked } from '#/engine/social.ts';

describe(isBlocked.name, () => {
  it('is true only when the receiver blocks the sender', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      expect(await isBlocked(g, a.id, b.id)).toBe(false);
      await social.addRelation(g, a.id, b.name, 'friend');
      expect(await isBlocked(g, a.id, b.id)).toBe(false);
      await social.addRelation(g, a.id, b.name, 'block');
      expect(await isBlocked(g, a.id, b.id)).toBe(true);
      expect(await isBlocked(g, b.id, a.id)).toBe(false);
      await social.removeRelation(g, a.id, b.id, 'block');
      expect(await isBlocked(g, a.id, b.id)).toBe(false);
    }));
});
