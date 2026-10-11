import { describe, expect, it } from 'vitest';
import { msg } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { mail, social } from '../../src/index.ts';
import { expectRefused } from '../support/expect.ts';
import { createTestPlayer } from '../support/factories.ts';
import { game } from '../support/game.ts';

const { MailFolder } = mail;

describe(mail.sendMail.name, () => {
  it('delivers to the inbox and keeps a read copy in the sent folder', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await mail.sendMail(g, a.id, b.name, 'Hello', 'How are you?');

      const inbox = await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10);
      expect(inbox.mails).toHaveLength(1);
      expect(inbox.mails[0]).toMatchObject({ title: 'Hello', sender: a.name, receiver: b.name, playerId: a.id, isRead: false });

      const sent = await mail.listMail(g, a.id, MailFolder.SENT, 1, 10);
      expect(sent.mails[0]).toMatchObject({ title: 'Hello', sender: a.name, receiver: b.name, isRead: true });
      expect(await mail.mailCounts(g, b.id)).toEqual({ count: 1, count_inbox: 1, count_system: 0 });
      expect(g.pushes(PushCmd.NEW_MAIL).at(-1)).toMatchObject({ playerIds: [b.id], data: { count: 1, count_inbox: 1 } });
    }));

  it('escapes HTML and trims the title and content', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await mail.sendMail(g, a.id, b.name, '  <b>Hi</b>  ', '<script>x</script>');
      const [m] = (await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails;
      const read = await mail.readMail(g, b.id, m.mailid);
      expect(read.title).toBe('&lt;b&gt;Hi&lt;/b&gt;');
      expect(read.content).toBe('&lt;script&gt;x&lt;/script&gt;');
    }));

  it('rejects an unknown player, yourself and an empty mail', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(mail.sendMail(g, a.id, 'Nobody Here', 't', 'c'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
      await expectRefused(mail.sendMail(g, a.id, a.name, 't', 'c'), msg('mail.toSelf'));
      await expectRefused(mail.sendMail(g, a.id, b.name, '  ', 'c'), msg('mail.titleAndContentRequired'));
    }));

  it('a blocked sender still gets the sent copy, but nothing is delivered', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await social.addRelation(g, b.id, a.name, 'block');
      await mail.sendMail(g, a.id, b.name, 'Hi', 'there');
      expect((await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails).toHaveLength(0);
      expect((await mail.listMail(g, a.id, MailFolder.SENT, 1, 10)).mails).toHaveLength(1);
    }));
});

describe(mail.sendSystemMail.name, () => {
  it('files system mail with no sender and its message', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await mail.sendSystemMail(g, a.id, 'Welcome', 'Body');
      const [m] = (await mail.listMail(g, a.id, MailFolder.SYSTEM, 1, 10)).mails;
      expect(m).toMatchObject({ title: 'Welcome', sender: null, isRead: false });
      expect(await mail.mailCounts(g, a.id)).toMatchObject({ count: 1, count_system: 1 });
    }));

  it('sent on behalf of a player, it goes to the inbox from them', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await mail.sendSystemMail(g, b.id, 'Circular', 'Text', { fromId: a.id, fromName: a.name });
      const [m] = (await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails;
      expect(m).toMatchObject({ sender: a.name, playerId: a.id });
    }));
});

describe(mail.listMail.name, () => {
  it('pages newest first', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      for (let i = 1; i <= 5; i++) {
        await mail.sendMail(g, a.id, b.name, `Mail ${i}`, 'x');
        g.advance(1000);
      }
      const page1 = await mail.listMail(g, b.id, MailFolder.INBOX, 1, 2);
      expect(page1).toMatchObject({ pageNo: 1, pageSize: 2, totalPage: 3 });
      expect(page1.mails.map((m) => m.title)).toEqual(['Mail 5', 'Mail 4']);
      expect((await mail.listMail(g, b.id, MailFolder.INBOX, 3, 2)).mails.map((m) => m.title)).toEqual(['Mail 1']);
    }));

  it('rejects an unknown folder and a bad page size', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(mail.listMail(g, a.id, 9, 1, 10), msg('common.invalidData'));
      await expectRefused(mail.listMail(g, a.id, 1, 1, 51), msg('common.invalidData'));
    }));
});

describe(mail.readMail.name, () => {
  it('marks the mail read and updates the counts', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await mail.sendMail(g, a.id, b.name, 'Hi', 'there');
      const [m] = (await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails;
      expect(await mail.readMail(g, b.id, m.mailid)).toMatchObject({ content: 'there', isRead: true });
      expect(await mail.mailCounts(g, b.id)).toMatchObject({ count: 0 });
    }));

  it("cannot read another player's mail", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await mail.sendMail(g, a.id, b.name, 'Hi', 'there');
      const [m] = (await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails;
      await expectRefused(mail.readMail(g, a.id, m.mailid), msg('mail.notFound'));
    }));
});

describe(mail.markMailRead.name, () => {
  it('marks only the listed mails of that player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await mail.sendMail(g, a.id, b.name, 'One', 'x');
      await mail.sendMail(g, a.id, b.name, 'Two', 'x');
      const mails = (await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails;
      await mail.markMailRead(g, a.id, [mails[0].mailid]); // not a's mail: no effect
      await mail.markMailRead(g, b.id, [mails[0].mailid]);
      expect(await mail.mailCounts(g, b.id)).toMatchObject({ count: 1 });
    }));
});

describe(mail.deleteMail.name, () => {
  it('deletes only the listed mails of that player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await mail.sendMail(g, a.id, b.name, 'Hi', 'x');
      const [m] = (await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails;
      await mail.deleteMail(g, a.id, [m.mailid]);
      expect((await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails).toHaveLength(1);
      await mail.deleteMail(g, b.id, [m.mailid]);
      expect((await mail.listMail(g, b.id, MailFolder.INBOX, 1, 10)).mails).toHaveLength(0);
      expect((await mail.listMail(g, a.id, MailFolder.SENT, 1, 10)).mails).toHaveLength(1);
    }));
});
