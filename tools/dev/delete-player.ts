// Delete test accounts and everything they own, the way the game does it: the player's restart
// (player.restartPlayer) releases their valleys, turns their castles back into flat land, sends home
// armies stationed with them, clears their timed events and leaves (or disbands) their alliance. Then
// the player and account rows go.
//
//   npm run delete-player -- fx_abcde fx_fghij        lists what would be deleted
//   npm run delete-player -- fx_abcde fx_fghij --yes  deletes it
//
// Admin accounts are never deleted.

import { and, count, eq, inArray } from 'drizzle-orm';

import { tileXY } from '@marchlands/core';
import { accounts, armies, cities, connect, one, players, tiles } from '@marchlands/db';
import { player, runGame } from '@marchlands/game';

const args = process.argv.slice(2);
const confirm = args.includes('--yes');
const usernames = args.filter((a) => !a.startsWith('--'));
if (!usernames.length) {
  console.error('usage: npm run delete-player -- <username>... [--yes]');
  process.exit(1);
}

const { db, close } = connect(process.env.DATABASE_URL, 2);
try {
  for (const username of usernames) {
    const [account] = await db.select().from(accounts).where(eq(accounts.username, username));
    if (!account) {
      console.log(`${username}: no such account`);
      continue;
    }
    if (account.isAdmin) {
      console.log(`${username}: an admin account, skipped`);
      continue;
    }
    const [p] = await db.select().from(players).where(eq(players.accountId, account.id));
    if (p) {
      const owned = await db.select().from(cities).where(eq(cities.playerId, p.id));
      const cityIds = owned.map((c) => c.id);
      const { valleys } = one(cityIds.length ? await db.select({ valleys: count() }).from(tiles).where(inArray(tiles.ownerCityId, cityIds)) : [{ valleys: 0 }]);
      const { marching } = one(await db.select({ marching: count() }).from(armies).where(eq(armies.playerId, p.id)));
      const where = owned.map((c) => {
        const { x, y } = tileXY(c.tileId);
        return `${c.name} (${x},${y})`;
      });
      console.log(`${username}: player ${p.name} (id ${p.id}); cities: ${where.join(', ') || 'none'}; valleys: ${valleys}; armies: ${marching}`);
    } else console.log(`${username}: account only (no player)`);
    if (!confirm) continue;
    await runGame(db, async (ctx) => {
      if (p) {
        await player.restartPlayer(ctx, p.id);
        await ctx.tx.delete(players).where(eq(players.id, p.id));
      }
      await ctx.tx.delete(accounts).where(and(eq(accounts.id, account.id), eq(accounts.isAdmin, false)));
    });
    console.log(`${username}: deleted`);
  }
  if (!confirm) console.log('Nothing deleted: run again with --yes to delete.');
} finally {
  await close();
}
