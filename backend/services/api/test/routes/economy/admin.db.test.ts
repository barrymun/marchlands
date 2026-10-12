import { describe, expect, it } from 'vitest';
import { desc, eq } from 'drizzle-orm';
import { BuildingType, ItemId, TechType } from '@marchlands/core';
import { PushCmd, type MailCounts, type PlayerState } from '@marchlands/contracts';
import { accounts, heroes, players, pushMessages } from '@marchlands/db';
import { apiTest, type TestApi } from '#test/support/api.ts';
import { expectAdminsOnly, expectInvalid, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

/** Every operator route, with a valid request (ids that need not exist: the refusal comes first). */
const ROUTES: RouteCall[] = [
  { method: 'POST', url: 'admin/items', body: { playerName: 'X', items: { [ItemId.WAR_HORN]: 1 } } },
  { method: 'PUT', url: 'admin/cities/1/resources', body: { playerId: 1, gold: 1 } },
  { method: 'PUT', url: 'admin/cities/1/buildings', body: { playerId: 1, positionId: 3, typeId: BuildingType.MARKETPLACE, level: 1 } },
  { method: 'PUT', url: 'admin/research', body: { playerName: 'X', techId: TechType.AGRICULTURE, level: 1 } },
  { method: 'POST', url: 'admin/cities/1/heroes', body: { playerId: 1 } },
  { method: 'POST', url: 'admin/accounts/1/ban', body: { banned: true } },
  { method: 'POST', url: 'admin/mute', body: { playerName: 'X', minutes: 5 } },
  { method: 'POST', url: 'admin/broadcast', body: { msg: 'hi' } },
  { method: 'POST', url: 'admin/mail', body: { playerName: 'X', title: 'T', content: 'C' } },
  { method: 'PUT', url: 'admin/players/flags', body: { playerName: 'X', beginner: false } },
  { method: 'PUT', url: 'admin/cities/1/stats', body: { playerId: 1, population: 1 } },
  { method: 'GET', url: 'admin/online' },
];

/** The operator (first account, no player needed) and an ordinary player to act on. */
async function setup(api: TestApi) {
  const op = await api.operator();
  const p = await api.player('Subject');
  return { op, p };
}

const state = (api: TestApi, p: { token: string }) => api.ok<PlayerState>('GET', 'player', { token: p.token });

describe('authentication', () => {
  it('every operator route needs a token', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, ROUTES);
    }));

  it('every operator route is refused to an ordinary account, with or without a player', () =>
    apiTest(async (api) => {
      const { p } = await setup(api);
      await expectAdminsOnly(api, p.token, ROUTES);
      await expectAdminsOnly(api, (await api.register()).token, ROUTES);
    }));
});

describe('POST /admin/items', () => {
  it('grants items to a player by name', () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      expect(await api.ok('POST', 'admin/items', { token: op.token, body: { playerName: 'Subject', items: { [ItemId.WAR_HORN]: 3 } } })).toBeNull();
      expect((await state(api, p)).items).toContainEqual({ id: ItemId.WAR_HORN, count: 3 });
    }));

  it('refuses an unknown player (404) or item, and validates the body', () =>
    apiTest(async (api) => {
      const { op } = await setup(api);
      const a = await api.refused('POST', 'admin/items', 'common.playerNamedNotFound', {
        token: op.token,
        body: { playerName: 'Nobody', items: {} },
        status: 404,
      });
      expect(a.body.error?.params).toEqual({ name: 'Nobody' });
      await api.refused('POST', 'admin/items', 'admin.unknownItem', {
        token: op.token,
        body: { playerName: 'Subject', items: { 'no.such.item': 1 } },
        status: 400,
      });
      await expectInvalid(api, op.token, [{ method: 'POST', url: 'admin/items', body: { playerName: 'Subject', items: { [ItemId.WAR_HORN]: 'many' } } }]);
    }));
});

describe('PUT /admin/cities/:cityId/resources', () => {
  it("sets a city's resources", () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      expect(await api.ok('PUT', `admin/cities/${p.cityId}/resources`, { token: op.token, body: { playerId: p.playerId, gold: 12_345 } })).toBeNull();
      expect((await state(api, p)).castles[0].resource.gold).toBe(12_345);
    }));

  it("refuses a city that is not the player's (403), and validates the request", () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      const other = await api.player();
      await api.refused('PUT', `admin/cities/${other.cityId}/resources`, 'common.invalidCastle', {
        token: op.token,
        body: { playerId: p.playerId, gold: 1 },
        status: 403,
      });
      await expectInvalid(api, op.token, [
        { method: 'PUT', url: `admin/cities/${p.cityId}/resources`, body: { playerId: p.playerId, gold: -1 } },
        { method: 'PUT', url: `admin/cities/${p.cityId}/resources`, body: { gold: 1 } },
        { method: 'PUT', url: 'admin/cities/abc/resources', body: { playerId: p.playerId, gold: 1 } },
      ]);
    }));
});

describe('PUT /admin/cities/:cityId/buildings', () => {
  it('puts a building in a city', () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      const body = { playerId: p.playerId, positionId: 3, typeId: BuildingType.MARKETPLACE, level: 2 };
      expect(await api.ok('PUT', `admin/cities/${p.cityId}/buildings`, { token: op.token, body })).toBeNull();
      expect((await state(api, p)).castles[0].buildings).toContainEqual(expect.objectContaining({ positionId: 3, typeId: BuildingType.MARKETPLACE, level: 2 }));
      await api.refused('PUT', `admin/cities/${p.cityId}/buildings`, 'admin.invalidLevel', { token: op.token, body: { ...body, level: 99 }, status: 400 });
      await expectInvalid(api, op.token, [{ method: 'PUT', url: `admin/cities/${p.cityId}/buildings`, body: { ...body, level: undefined } }]);
    }));
});

describe('PUT /admin/research', () => {
  it("sets a player's technology level", () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      expect(await api.ok('PUT', 'admin/research', { token: op.token, body: { playerName: 'Subject', techId: TechType.AGRICULTURE, level: 3 } })).toBeNull();
      expect((await state(api, p)).research[TechType.AGRICULTURE]).toMatchObject({ level: 3 });
      await api.refused('PUT', 'admin/research', 'admin.invalidLevel', {
        token: op.token,
        body: { playerName: 'Subject', techId: TechType.AGRICULTURE, level: 99 },
        status: 400,
      });
      await expectInvalid(api, op.token, [{ method: 'PUT', url: 'admin/research', body: { playerName: 'Subject', techId: 'farming', level: 1 } }]);
    }));
});

describe('POST /admin/cities/:cityId/heroes', () => {
  it('adds a hero and answers its id', () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      const id = await api.ok<number>('POST', `admin/cities/${p.cityId}/heroes`, { token: op.token, body: { playerId: p.playerId } });
      expect(id).toEqual(expect.any(Number));
      const [row] = await api.db.select().from(heroes).where(eq(heroes.id, id));
      expect(row).toMatchObject({ playerId: p.playerId, cityId: p.cityId });
      await expectInvalid(api, op.token, [{ method: 'POST', url: `admin/cities/${p.cityId}/heroes`, body: { playerId: p.playerId, innLevel: 'max' } }]);
    }));
});

describe('POST /admin/accounts/:accountId/ban', () => {
  it('bans an account (no new logins) and lifts the ban', () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      expect(await api.ok('POST', `admin/accounts/${p.accountId}/ban`, { token: op.token, body: { banned: true, reason: 'cheating' } })).toBeNull();
      expect((await api.db.select().from(accounts).where(eq(accounts.id, p.accountId)))[0]).toMatchObject({ status: 1, banReason: 'cheating' });
      await api.refused('POST', 'auth/login', 'auth.banned', { body: { username: p.username, password: 'test-password' }, status: 403 });
      await api.ok('POST', `admin/accounts/${p.accountId}/ban`, { token: op.token, body: { banned: false } });
      await api.ok('POST', 'auth/login', { body: { username: p.username, password: 'test-password' } });
      await expectInvalid(api, op.token, [{ method: 'POST', url: `admin/accounts/${p.accountId}/ban`, body: { banned: 'yes' } }]);
    }));

  it("refuses a banned account's existing token", () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      await api.ok('POST', `admin/accounts/${p.accountId}/ban`, { token: op.token, body: { banned: true } });
      const a = await api.call('GET', 'player', { token: p.token });
      expect(a.status).toBeGreaterThanOrEqual(401);
    }));
});

describe('POST /admin/mute', () => {
  it('mutes a player in chat', () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      expect(await api.ok('POST', 'admin/mute', { token: op.token, body: { playerName: 'Subject', minutes: 10 } })).toBeNull();
      await api.refused('POST', 'chat/world', 'social.muted', { token: p.token, body: { msg: 'hello?' }, status: 400 });
      await expectInvalid(api, op.token, [{ method: 'POST', url: 'admin/mute', body: { playerName: 'Subject', minutes: -1 } }]);
    }));
});

describe('POST /admin/broadcast', () => {
  it('sends a system message to everyone', () =>
    apiTest(async (api) => {
      const { op } = await setup(api);
      expect(await api.ok('POST', 'admin/broadcast', { token: op.token, body: { msg: 'Server restarts at noon' } })).toBeNull();
      const [push] = await api.db.select().from(pushMessages).orderBy(desc(pushMessages.id)).limit(1);
      expect(push).toMatchObject({
        playerIds: [],
        cmd: PushCmd.SYSTEM_INFO_MESSAGE,
        data: { tV: true, msg: { code: 'admin.broadcast', params: { text: 'Server restarts at noon' } } },
      });
      await expectInvalid(api, op.token, [{ method: 'POST', url: 'admin/broadcast', body: {} }]);
    }));
});

describe('POST /admin/mail', () => {
  it('sends system mail to a player', () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      expect(await api.ok('POST', 'admin/mail', { token: op.token, body: { playerName: 'Subject', title: 'Welcome', content: 'Enjoy' } })).toBeNull();
      expect(await api.ok<MailCounts>('GET', 'mail/unread', { token: p.token })).toMatchObject({ count_system: 1 });
      await api.refused('POST', 'admin/mail', 'common.playerNamedNotFound', {
        token: op.token,
        body: { playerName: 'Nobody', title: 'T', content: 'C' },
        status: 404,
      });
    }));
});

describe('PUT /admin/players/flags', () => {
  it("sets a player's beginner protection and title", () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      expect(await api.ok('PUT', 'admin/players/flags', { token: op.token, body: { playerName: 'Subject', beginner: false, title: 2 } })).toBeNull();
      expect((await api.db.select().from(players).where(eq(players.id, p.playerId)))[0]).toMatchObject({ beginner: false, title: 2 });
      await expectInvalid(api, op.token, [{ method: 'PUT', url: 'admin/players/flags', body: { playerName: 'Subject', beginner: 'no' } }]);
    }));
});

describe('PUT /admin/cities/:cityId/stats', () => {
  it("sets a city's population and troops", () =>
    apiTest(async (api) => {
      const { op, p } = await setup(api);
      const body = { playerId: p.playerId, population: 500, troops: { archer: 40 } };
      expect(await api.ok('PUT', `admin/cities/${p.cityId}/stats`, { token: op.token, body })).toBeNull();
      expect((await state(api, p)).castles[0].troop).toMatchObject({ archer: 40 });
      await expectInvalid(api, op.token, [{ method: 'PUT', url: `admin/cities/${p.cityId}/stats`, body: { ...body, troops: { archer: -1 } } }]);
    }));
});

describe('GET /admin/online', () => {
  it('answers how many players are connected', () =>
    apiTest(async (api) => {
      const { op } = await setup(api);
      expect(await api.ok('GET', 'admin/online', { token: op.token })).toEqual({ online: 0 });
    }));
});
