// Helpers for the ranking tests (services/rankings.db.test.ts, engine/rankings.db.test.ts).

import { addPrestige } from '#/helpers.ts';
import { getPlayer, savePlayer } from '#/repo.ts';
import { type TestPlayer } from '#test/support/factories.ts';
import { type TestGame } from '#test/support/game.ts';

export async function setFame(g: TestGame, p: TestPlayer, fame: { prestige?: number; honor?: number }) {
  const row = await getPlayer(g, p.id);
  if (fame.prestige != null) addPrestige(row, fame.prestige - row.prestige);
  if (fame.honor != null) row.honor = fame.honor;
  await savePlayer(g, row);
}
