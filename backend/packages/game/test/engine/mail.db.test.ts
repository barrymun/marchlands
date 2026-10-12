import { describe, expect, it } from 'vitest';

import { MailType } from '@marchlands/core';

import { mail } from '#/index.ts';

import { createTestPlayer } from '#test/support/factories.ts';

import { game } from '#test/support/game.ts';

import { sendSystemMail } from '#/engine/mail.ts';

describe(sendSystemMail.name, () => {
  it('files system mail with no sender and its message', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await sendSystemMail(g, a.id, 'Welcome', 'Body');
      const [m] = (await mail.listMail(g, a.id, MailType.SYSTEM, 1, 10)).mails;
      expect(m).toMatchObject({ title: 'Welcome', sender: null, isRead: false });
      expect(await mail.mailCounts(g, a.id)).toMatchObject({ count: 1, count_system: 1 });
    }));

  it('sent on behalf of a player, it goes to the inbox from them', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await sendSystemMail(g, b.id, 'Circular', 'Text', { fromId: a.id, fromName: a.name });
      const [m] = (await mail.listMail(g, b.id, MailType.INBOX, 1, 10)).mails;
      expect(m).toMatchObject({ sender: a.name, playerId: a.id });
    }));
});
