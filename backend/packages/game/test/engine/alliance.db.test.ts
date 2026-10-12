import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { players } from '@marchlands/db';
import { addMember, allianceRow, createTestAlliance } from '#test/support/alliance.ts';
import { game } from '#test/support/game.ts';
import { refreshAllianceStats } from '#/engine/alliance.ts';

describe(refreshAllianceStats.name, () => {
  it("sums members' prestige, honour, members and cities, and ranks the alliances", () =>
    game(async (g) => {
      const small = await createTestAlliance(g);
      const big = await createTestAlliance(g);
      const m = await addMember(g, big);
      await g.tx.update(players).set({ prestige: 100, honor: 1 }).where(eq(players.id, small.host.id));
      await g.tx.update(players).set({ prestige: 70, honor: 10 }).where(eq(players.id, big.host.id));
      await g.tx.update(players).set({ prestige: 50, honor: 10 }).where(eq(players.id, m.id));

      await refreshAllianceStats(g);
      const s = await allianceRow(g, small.id);
      const b = await allianceRow(g, big.id);
      expect(s).toMatchObject({ prestige: 100, honor: 1, memberCount: 1, cityCount: 1 });
      expect(b).toMatchObject({ prestige: 120, honor: 20, memberCount: 2, cityCount: 2 });
      expect(b.prestigeRank).toBeLessThan(s.prestigeRank);
      expect(b.honorRank).toBeLessThan(s.honorRank);
      expect(b.membersRank).toBeLessThan(s.membersRank);
      expect(s.prestigeRank).toBeGreaterThan(0);
    }));
});
