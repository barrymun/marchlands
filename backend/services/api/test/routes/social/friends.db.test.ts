import { describe, expect, it } from 'vitest';
import type { PlayerRelationLists } from '@marchlands/contracts';
import { apiTest } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsPlayer, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

const ROUTES: RouteCall[] = [
  { method: 'GET', url: 'friends' },
  { method: 'POST', url: 'friends', body: { name: 'Someone' } },
  { method: 'DELETE', url: 'friends/1' },
  { method: 'POST', url: 'blocks', body: { name: 'Someone' } },
  { method: 'DELETE', url: 'blocks/1' },
];

describe('authentication', () => {
  it('every friends route needs a token and a player', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, ROUTES);
      await expectNeedsPlayer(api, (await accountWithoutPlayer(api)).token, ROUTES);
    }));
});

describe('GET /friends', () => {
  it('answers the friends and the blocked players', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok('GET', 'friends', { token: p.token })).toEqual({ friends: [], blocked: [] });
    }));
});

describe('POST /friends', () => {
  it('adds a friend by name and answers who it is', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const pal = await api.player('Pal');
      expect(await api.ok('POST', 'friends', { token: p.token, body: { name: 'Pal' } })).toEqual({ id: pal.playerId, name: 'Pal' });
      const lists = await api.ok<PlayerRelationLists>('GET', 'friends', { token: p.token });
      expect(lists).toEqual({ friends: [{ id: pal.playerId, name: 'Pal', prestige: expect.any(Number), lastSeen: expect.any(Number) }], blocked: [] });
    }));

  it('refuses an unknown player (404) and oneself, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player('Narcissus');
      await api.refused('POST', 'friends', 'common.playerNamedNotFound', { token: p.token, body: { name: 'Nobody' }, status: 404 });
      await api.refused('POST', 'friends', 'social.selfTarget', { token: p.token, body: { name: 'Narcissus' }, status: 400 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'friends', body: {} }]);
    }));
});

describe('DELETE /friends/:playerId', () => {
  it('removes a friend', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const pal = await api.player('Former');
      await api.ok('POST', 'friends', { token: p.token, body: { name: 'Former' } });
      expect(await api.ok('DELETE', `friends/${pal.playerId}`, { token: p.token })).toBeNull();
      expect((await api.ok<PlayerRelationLists>('GET', 'friends', { token: p.token })).friends).toEqual([]);
      await expectInvalid(api, p.token, [{ method: 'DELETE', url: 'friends/abc' }]);
    }));
});

describe('POST /blocks', () => {
  it('blocks a player: their whispers are dropped', () =>
    apiTest(async (api) => {
      const p = await api.player('Quiet');
      const pest = await api.player('Pest');
      expect(await api.ok('POST', 'blocks', { token: p.token, body: { name: 'Pest' } })).toEqual({ id: pest.playerId, name: 'Pest' });
      expect((await api.ok<PlayerRelationLists>('GET', 'friends', { token: p.token })).blocked).toEqual([expect.objectContaining({ id: pest.playerId })]);
      await api.ok('POST', 'chat/private', { token: pest.token, body: { to: 'Quiet', msg: 'hey' } });
      expect(await api.ok('GET', 'chat/private', { token: p.token })).toEqual([]);
      await api.refused('POST', 'blocks', 'common.playerNamedNotFound', { token: p.token, body: { name: 'Nobody' }, status: 404 });
    }));
});

describe('DELETE /blocks/:playerId', () => {
  it('unblocks a player, leaving friends alone', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const other = await api.player('Both');
      await api.ok('POST', 'friends', { token: p.token, body: { name: 'Both' } });
      await api.ok('POST', 'blocks', { token: p.token, body: { name: 'Both' } });
      expect(await api.ok('DELETE', `blocks/${other.playerId}`, { token: p.token })).toBeNull();
      const lists = await api.ok<PlayerRelationLists>('GET', 'friends', { token: p.token });
      expect(lists.blocked).toEqual([]);
      await expectInvalid(api, p.token, [{ method: 'DELETE', url: 'blocks/-1' }]);
    }));
});
