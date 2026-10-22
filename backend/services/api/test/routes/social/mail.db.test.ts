import { describe, expect, it } from 'vitest';

import type { MailCounts, MailDetail, MailList } from '@marchlands/contracts';
import { admin } from '@marchlands/game';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsPlayer, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

const ROUTES: RouteCall[] = [
  { method: 'GET', url: 'mail' },
  { method: 'GET', url: 'mail/unread' },
  { method: 'GET', url: 'mail/1' },
  { method: 'POST', url: 'mail', body: { to: 'Someone', title: 'Hi', content: 'Hello' } },
  { method: 'POST', url: 'mail/read', body: { ids: [1] } },
  { method: 'POST', url: 'mail/delete', body: { ids: [1] } },
];

/** Two players; `from` has sent `to` one mail, whose id is returned. */
async function mailed(api: TestApi) {
  const from = await api.player('Sender');
  const to = await api.player('Receiver');
  await api.ok('POST', 'mail', { token: from.token, body: { to: 'Receiver', title: 'Greetings', content: 'Well met' } });
  const list = await api.ok<MailList>('GET', 'mail', { token: to.token });
  return { from, to, mailId: list.mails[0]!.mailid };
}

describe('authentication', () => {
  it('every mail route needs a token and a player', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, ROUTES);
      await expectNeedsPlayer(api, (await accountWithoutPlayer(api)).token, ROUTES);
    }));
});

describe('GET /mail', () => {
  it('answers a page of the inbox, or of another folder', () =>
    apiTest(async (api) => {
      const { from, to, mailId } = await mailed(api);
      const inbox = await api.ok<MailList>('GET', 'mail', { token: to.token });
      expect(inbox).toMatchObject({ pageNo: 1, pageSize: 10, totalPage: 1 });
      expect(inbox.mails).toEqual([
        expect.objectContaining({
          mailid: mailId,
          type_id: 1,
          title: 'Greetings',
          sender: 'Sender',
          receiver: 'Receiver',
          playerId: from.playerId,
          isRead: false,
        }),
      ]);
      const sent = await api.ok<MailList>('GET', 'mail?type=3', { token: from.token });
      expect(sent.mails).toEqual([expect.objectContaining({ type_id: 3, title: 'Greetings', receiver: 'Receiver' })]);
      expect((await api.ok<MailList>('GET', 'mail?type=1&pageNo=2&pageSize=5', { token: to.token })).mails).toEqual([]);
    }));

  it('refuses an unknown folder, and validates the query', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.refused('GET', 'mail?type=4', 'common.invalidData', { token: p.token, status: 400 });
      await expectInvalid(api, p.token, [
        { method: 'GET', url: 'mail?pageSize=51' },
        { method: 'GET', url: 'mail?pageNo=0' },
        { method: 'GET', url: 'mail?type=inbox' },
      ]);
    }));
});

describe('GET /mail/unread', () => {
  it('counts unread mail', () =>
    apiTest(async (api) => {
      const { to } = await mailed(api);
      await api.game((ctx) => admin.mailPlayer(ctx, 'Receiver', 'Notice', 'From the game'));
      expect(await api.ok<MailCounts>('GET', 'mail/unread', { token: to.token })).toEqual({ count: 2, count_inbox: 1, count_system: 1 });
    }));
});

describe('GET /mail/:mailId', () => {
  it('answers the mail with its content and marks it read', () =>
    apiTest(async (api) => {
      const { to, mailId } = await mailed(api);
      const m = await api.ok<MailDetail>('GET', `mail/${mailId}`, { token: to.token });
      expect(m).toMatchObject({ mailid: mailId, title: 'Greetings', content: 'Well met', sender: 'Sender', systemContent: null });
      expect((await api.ok<MailCounts>('GET', 'mail/unread', { token: to.token })).count).toBe(0);
    }));

  it("answers 404 for an unknown mail or another player's", () =>
    apiTest(async (api) => {
      const { from, mailId } = await mailed(api);
      const outsider = await api.player();
      await api.refused('GET', 'mail/999999', 'mail.notFound', { token: from.token, status: 404 });
      await api.refused('GET', `mail/${mailId}`, 'mail.notFound', { token: outsider.token, status: 404 });
      await expectInvalid(api, from.token, [{ method: 'GET', url: 'mail/abc' }]);
    }));
});

describe('POST /mail', () => {
  it('sends a mail to another player by name', () =>
    apiTest(async (api) => {
      const { to } = await mailed(api);
      expect((await api.ok<MailCounts>('GET', 'mail/unread', { token: to.token })).count_inbox).toBe(1);
    }));

  it('refuses an unknown player (404) and oneself', () =>
    apiTest(async (api) => {
      const p = await api.player('Lonely');
      const body = { title: 'Hi', content: 'Hello' };
      const a = await api.refused('POST', 'mail', 'common.playerNamedNotFound', { token: p.token, body: { ...body, to: 'Nobody' }, status: 404 });
      expect(a.body).toEqual({ ok: -41, error: { code: 'common.playerNamedNotFound', params: { name: 'Nobody' } } });
      await api.refused('POST', 'mail', 'mail.toSelf', { token: p.token, body: { ...body, to: 'Lonely' }, status: 400 });
    }));

  it('validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'mail', body: { to: 'X', title: 'T' } },
        { method: 'POST', url: 'mail', body: { to: 1, title: 'T', content: 'C' } },
      ]);
    }));
});

describe('POST /mail/read', () => {
  it('marks mail read', () =>
    apiTest(async (api) => {
      const { to, mailId } = await mailed(api);
      expect(await api.ok('POST', 'mail/read', { token: to.token, body: { ids: [mailId] } })).toBeNull();
      expect((await api.ok<MailCounts>('GET', 'mail/unread', { token: to.token })).count).toBe(0);
      await expectInvalid(api, to.token, [
        { method: 'POST', url: 'mail/read', body: {} },
        { method: 'POST', url: 'mail/read', body: { ids: ['a'] } },
      ]);
    }));
});

describe('POST /mail/delete', () => {
  it('deletes mail', () =>
    apiTest(async (api) => {
      const { to, mailId } = await mailed(api);
      expect(await api.ok('POST', 'mail/delete', { token: to.token, body: { ids: [mailId] } })).toBeNull();
      expect((await api.ok<MailList>('GET', 'mail', { token: to.token })).mails).toEqual([]);
      await expectInvalid(api, to.token, [{ method: 'POST', url: 'mail/delete', body: { ids: Array(501).fill(1) } }]);
    }));
});
