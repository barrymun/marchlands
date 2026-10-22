import { describe, expect, it } from 'vitest';

import type { ChatHistory } from '@marchlands/contracts';
import { BALANCE } from '@marchlands/core';
import { admin } from '@marchlands/game';

import { apiTest } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsPlayer, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

const ROUTES: RouteCall[] = [
  { method: 'POST', url: 'chat/world', body: { msg: 'hi' } },
  { method: 'POST', url: 'chat/beginner', body: { msg: 'hi' } },
  { method: 'POST', url: 'chat/alliance', body: { msg: 'hi' } },
  { method: 'POST', url: 'chat/private', body: { to: 'Someone', msg: 'hi' } },
  { method: 'GET', url: 'chat/world' },
];

describe('authentication', () => {
  it('every chat route needs a token and a player', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, ROUTES);
      await expectNeedsPlayer(api, (await accountWithoutPlayer(api)).token, ROUTES);
    }));
});

describe('POST /chat/world', () => {
  it('posts to the world channel', () =>
    apiTest(async (api) => {
      const p = await api.player('Crier');
      expect(await api.ok('POST', 'chat/world', { token: p.token, body: { msg: ' Hear ye ' } })).toBeNull();
      const listener = await api.player();
      expect(await api.ok<ChatHistory>('GET', 'chat/world', { token: listener.token })).toEqual([
        { id: expect.any(Number), channel: 'world', fromUser: 'Crier', fromId: p.playerId, toId: null, msg: 'Hear ye', time: expect.any(Number) },
      ]);
    }));

  it('refuses an empty message, a muted player, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.refused('POST', 'chat/world', 'social.emptyMessage', { token: p.token, body: { msg: '  ' }, status: 400 });
      await api.game((ctx) => admin.mute(ctx, p.username, 5));
      await api.refused('POST', 'chat/world', 'social.muted', { token: p.token, body: { msg: 'let me speak' }, status: 400 });
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'chat/world', body: {} },
        { method: 'POST', url: 'chat/world', body: { msg: 42 } },
      ]);
    }));
});

describe('POST /chat/beginner', () => {
  it('posts to the beginner channel only', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.ok('POST', 'chat/beginner', { token: p.token, body: { msg: 'how do I build?' } });
      expect(await api.ok<ChatHistory>('GET', 'chat/beginner', { token: p.token })).toEqual([
        expect.objectContaining({ channel: 'beginner', msg: 'how do I build?' }),
      ]);
      expect(await api.ok('GET', 'chat/world', { token: p.token })).toEqual([]);
    }));
});

describe('POST /chat/alliance', () => {
  it("posts to the player's alliance", () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.game((ctx) => admin.setResources(ctx, p.cityId, p.playerId, { gold: BALANCE.allianceCreateGold }));
      await api.ok('POST', 'alliance', { token: p.token, body: { cityId: p.cityId, allianceName: 'Chatters' } });
      await api.ok('POST', 'chat/alliance', { token: p.token, body: { msg: 'to arms' } });
      expect(await api.ok<ChatHistory>('GET', 'chat/alliance', { token: p.token })).toEqual([expect.objectContaining({ channel: 'alliance', msg: 'to arms' })]);
    }));

  it('refuses a player without an alliance', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.refused('POST', 'chat/alliance', 'social.notInAlliance', { token: p.token, body: { msg: 'anyone?' }, status: 400 });
      expect(await api.ok('GET', 'chat/alliance', { token: p.token })).toEqual([]);
    }));
});

describe('POST /chat/private', () => {
  it('whispers to another player, seen by both and nobody else', () =>
    apiTest(async (api) => {
      const from = await api.player();
      const to = await api.player('Listener');
      const outsider = await api.player();
      await api.ok('POST', 'chat/private', { token: from.token, body: { to: 'Listener', msg: 'psst' } });
      const seen = [expect.objectContaining({ channel: 'private', fromId: from.playerId, toId: to.playerId, msg: 'psst' })];
      expect(await api.ok('GET', 'chat/private', { token: to.token })).toEqual(seen);
      expect(await api.ok('GET', 'chat/private', { token: from.token })).toEqual(seen);
      expect(await api.ok('GET', 'chat/private', { token: outsider.token })).toEqual([]);
    }));

  it('refuses an unknown player (404), and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const a = await api.refused('POST', 'chat/private', 'common.playerNamedNotFound', { token: p.token, body: { to: 'Nobody', msg: 'hi' }, status: 404 });
      expect(a.body.error?.params).toEqual({ name: 'Nobody' });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'chat/private', body: { msg: 'hi' } }]);
    }));
});

describe('GET /chat/:channel', () => {
  it('answers the messages after `since`', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.ok('POST', 'chat/world', { token: p.token, body: { msg: 'first' } });
      const [first] = await api.ok<ChatHistory>('GET', 'chat/world', { token: p.token });
      expect(await api.ok('GET', `chat/world?since=${first!.time}`, { token: p.token })).toEqual([]);
      expect(await api.ok('GET', `chat/world?since=${first!.time - 1}`, { token: p.token })).toEqual([first]);
    }));

  it('validates the channel and the query', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await expectInvalid(api, p.token, [
        { method: 'GET', url: 'chat/tavern' },
        { method: 'GET', url: 'chat/world?since=yesterday' },
      ]);
    }));
});
