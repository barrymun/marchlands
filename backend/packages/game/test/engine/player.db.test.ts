import { describe, expect, it } from 'vitest';

import { eq } from 'drizzle-orm';

import { BALANCE, ItemId, msg, PlayerStatus } from '@marchlands/core';

import { PushCmd } from '@marchlands/contracts';

import { mails } from '@marchlands/db';

import { admin, mail, player } from '#/index.ts';

import { createTestPlayer, giveItems, reloadPlayer } from '#test/support/factories.ts';

import { game } from '#test/support/game.ts';

import { checkBeginner, isProtected } from '#/engine/player.ts';

describe(isProtected.name, () => {
  it('names why a player cannot be attacked: beginner, truce or holiday', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(isProtected(await reloadPlayer(g, a), g.now)).toEqual(msg('player.protected.beginner'));
      await admin.setPlayerFlags(g, a.name, { beginner: false });
      expect(isProtected(await reloadPlayer(g, a), g.now)).toBeNull();

      await giveItems(g, a, { [ItemId.TRUCE_AGREEMENT]: 1 });
      await player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, a.cityId);
      const inTruce = await reloadPlayer(g, a);
      expect(isProtected(inTruce, g.now)).toEqual(msg('player.protected.truce'));
      // a buff whose time is over protects no more, even before its expiry runs
      expect(isProtected(inTruce, g.now + BALANCE.truceDurationMs)).toBeNull();

      await g.runDue(g.now + BALANCE.truceDurationMs);
      await player.startFurlough(g, a.id, 1, a.cityId);
      expect(isProtected(await reloadPlayer(g, a), g.now)).toEqual(msg('player.protected.holiday'));
    }));
});

describe(checkBeginner.name, () => {
  it('keeps protection for a young player below the Town Hall level', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      g.advance(BALANCE.beginnerProtectionMs);
      const p = await reloadPlayer(g, a);
      await checkBeginner(g, p, BALANCE.beginnerTownHallLevel - 1);
      expect(p.beginner).toBe(true);
      expect(g.pushes(PushCmd.NEW_MAIL)).toEqual([]);
    }));

  it('ends protection at the Town Hall level, with a system mail', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const p = await reloadPlayer(g, a);
      p.status = PlayerStatus.BEGINNER;
      await checkBeginner(g, p, BALANCE.beginnerTownHallLevel);
      expect(p).toMatchObject({ beginner: false, status: PlayerStatus.NORMAL });
      const [m] = await g.tx.select().from(mails).where(eq(mails.playerId, a.id));
      expect(m).toMatchObject({
        type: 2,
        system: { title: msg('player.mail.protectionExpired.title'), content: msg('player.mail.protectionExpired.content') },
      });
      expect(g.pushes(PushCmd.NEW_MAIL).at(-1)).toMatchObject({ playerIds: [a.id], data: { count: 1, count_system: 1 } });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { beginner: false } } });
    }));

  it('ends protection once it has run out', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      g.advance(BALANCE.beginnerProtectionMs + 1);
      const p = await reloadPlayer(g, a);
      await checkBeginner(g, p);
      expect(p.beginner).toBe(false);
      expect(await mail.mailCounts(g, a.id)).toMatchObject({ count_system: 1 });
    }));

  it('does nothing for a player no longer protected', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setPlayerFlags(g, a.name, { beginner: false });
      const p = await reloadPlayer(g, a);
      const pushes = g.pushes().length;
      await checkBeginner(g, p, BALANCE.beginnerTownHallLevel);
      expect(g.pushes()).toHaveLength(pushes);
      expect(await mail.mailCounts(g, a.id)).toMatchObject({ count: 0 });
    }));
});
