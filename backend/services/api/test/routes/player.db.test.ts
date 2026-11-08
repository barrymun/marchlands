import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type {
  ArmyPreset,
  CastleSign,
  Flow,
  FlowRunReport,
  LordStatistics,
  PlayerState,
  PublicPlayerInfo,
  UseItemResult,
  WorldInfo,
  ZoneStats,
} from '@marchlands/contracts';
import { BuffId, ItemId } from '@marchlands/core';
import { players } from '@marchlands/db';
import { admin } from '@marchlands/game';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsPlayer, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

type Player = Awaited<ReturnType<TestApi['player']>>;

const state = (api: TestApi, p: Player) => api.ok<PlayerState>('GET', 'player', { token: p.token });
const playerRow = async (api: TestApi, p: Player) => (await api.db.select().from(players).where(eq(players.id, p.playerId)))[0];
const giveGold = (api: TestApi, p: Player, gold = 1_000_000) => api.game((ctx) => admin.setResources(ctx, p.cityId, p.playerId, { gold }));

/** Every route of this file that needs a player, with a valid request. */
const PLAYER_ROUTES: RouteCall[] = [
  { method: 'GET', url: 'player' },
  { method: 'GET', url: 'players/Someone' },
  { method: 'PATCH', url: 'player/face', body: { faceUrl: 'images/icon/player/faceB1.jpg', sex: 1 } },
  { method: 'POST', url: 'player/flag', body: { flag: 'F' } },
  { method: 'POST', url: 'player/rename', body: { userName: 'Renamed' } },
  { method: 'POST', url: 'player/gender', body: { sex: 1 } },
  { method: 'POST', url: 'player/title/promote', body: { cityId: 1 } },
  { method: 'POST', url: 'player/tutorial', body: { step: 3 } },
  { method: 'POST', url: 'player/furlough', body: { days: 1, cityId: 1 } },
  { method: 'DELETE', url: 'player/furlough' },
  { method: 'POST', url: 'player/truce', body: { cityId: 1 } },
  { method: 'POST', url: 'player/restart' },
  { method: 'GET', url: 'player/bookmarks' },
  { method: 'POST', url: 'player/bookmarks', body: { tileId: 1 } },
  { method: 'DELETE', url: 'player/bookmarks/1' },
  { method: 'GET', url: 'player/army-presets' },
  { method: 'POST', url: 'player/army-presets', body: { name: 'Scouts', troops: { scouter: 10 } } },
  { method: 'DELETE', url: 'player/army-presets/abc' },
  { method: 'GET', url: 'player/statistics' },
  { method: 'GET', url: 'player/flows' },
  { method: 'POST', url: 'player/flows', body: { name: 'F', actions: [{ type: 'setMayor', stat: 'power' }] } },
  { method: 'DELETE', url: 'player/flows/abc' },
  { method: 'POST', url: 'player/flows/abc/run', body: {} },
  { method: 'POST', url: 'player/flows/abc/repeat', body: { repeat: true } },
  { method: 'POST', url: 'player/flows/abc/stop' },
  { method: 'POST', url: 'player/items/x/use', body: {} },
];

describe('authentication', () => {
  it('every route needs a token', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, [
        { method: 'GET', url: 'world' },
        { method: 'GET', url: 'world/zones' },
        { method: 'POST', url: 'player', body: { userName: 'Nobody', castleName: 'Nowhere', flag: 'N', sex: 0 } },
        ...PLAYER_ROUTES,
      ]);
    }));

  it('every route but the world info and POST /player needs a player', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      await expectNeedsPlayer(api, a.token, PLAYER_ROUTES);
    }));

  it('answers 401 without a token even when the body is invalid', () =>
    apiTest(async (api) => {
      await api.refused('POST', 'player/flag', 'auth.notLoggedIn', { status: 401 });
    }));
});

describe('GET /world', () => {
  it('answers the world info with the online count, for an account without a player', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      const w = await api.ok<WorldInfo>('GET', 'world', { token: a.token });
      expect(w).toMatchObject({ mapSize: expect.any(Number), source: expect.any(String), online: 0 });
    }));
});

describe('GET /world/zones', () => {
  it('answers the population of each state, for an account without a player', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      const zones = await api.ok<ZoneStats[]>('GET', 'world/zones', { token: a.token });
      expect(zones.map((z) => z.id)).toEqual([...Array(16).keys()]);
      expect(zones[0]).toEqual({
        id: 0,
        playerCount: expect.any(Number),
        castleCount: expect.any(Number),
        openFlats: expect.any(Number),
        settled: expect.any(Number),
      });
    }));
});

describe('POST /player', () => {
  it('creates the player and its first city and answers its state with a token naming the player', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      const created = await api.ok<PlayerState & { token: string }>('POST', 'player', {
        token: a.token,
        body: { userName: 'Founder', castleName: 'First Light', flag: 'FL', sex: 1, zone: 3 },
      });
      expect(created.token).toEqual(expect.any(String));
      expect(created.playerInfo).toMatchObject({ userName: 'Founder', flag: 'FL', sex: 1, castleCount: 1 });
      expect(created.castles).toEqual([expect.objectContaining({ name: 'First Light' })]);
      const [row] = await api.db.select().from(players).where(eq(players.accountId, a.accountId));
      expect(row).toMatchObject({ id: created.playerInfo.id, name: 'Founder' });
      // the new token works where a player is needed
      expect((await api.ok<PlayerState>('GET', 'player', { token: created.token })).playerInfo.id).toBe(row!.id);
    }));

  it('refuses a second player for the account, and a name already taken', () =>
    apiTest(async (api) => {
      const p = await api.player('Taken');
      const body = { userName: 'Other', castleName: 'Other City', flag: 'O', sex: 0 };
      const again = await api.refused('POST', 'player', 'player.accountExists', { token: p.token, body, status: 409 });
      expect(again.body.ok).toBe(-86);
      const b = await api.register();
      await api.refused('POST', 'player', 'player.nameTaken', { token: b.token, body: { ...body, userName: 'Taken' }, status: 409 });
    }));

  it('validates the body', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      await expectInvalid(api, a.token, [
        { method: 'POST', url: 'player', body: { castleName: 'X', flag: 'X', sex: 0 } },
        { method: 'POST', url: 'player', body: { userName: 'X', castleName: 'X', flag: 'X', sex: 0, zone: 16 } },
        { method: 'POST', url: 'player', body: { userName: 'X', castleName: 'X', flag: 'X', sex: 0.5 } },
      ]);
    }));
});

describe('GET /player', () => {
  it("answers the player's full state", () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Statesman');
      const s = await state(api, p);
      expect(s.playerInfo).toMatchObject({ id: p.playerId, userName: 'Statesman', beginner: true });
      expect(s.castles.map((c) => c.id)).toEqual([p.cityId]);
      expect(s).toMatchObject({ items: expect.any(Array), buffs: [], selfArmys: [], castleSignBean: [], furlough: false, tutorialStepId: expect.any(Number) });
    }));

  it('records the login', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.db.update(players).set({ lastLoginAt: 1 }).where(eq(players.id, p.playerId));
      await state(api, p);
      expect((await playerRow(api, p))!.lastLoginAt).toBeGreaterThan(1);
    }));
});

describe('GET /players/:name', () => {
  it("answers another player's public profile with their cities and the relation", () =>
    apiTest(async (api) => {
      const viewer = await api.player();
      const other = await api.player('Neighbour');
      const info = await api.ok<PublicPlayerInfo>('GET', 'players/Neighbour', { token: viewer.token });
      expect(info).toMatchObject({ id: other.playerId, userName: 'Neighbour', relation: 4 });
      expect(info.castles).toEqual([{ id: other.cityId, name: 'Neighbour City', fieldId: expect.any(Number), x: expect.any(Number), y: expect.any(Number) }]);
      expect((await api.ok<PublicPlayerInfo>('GET', 'players/Neighbour', { token: other.token })).relation).toBe(5);
    }));

  it('answers 404 with the name for an unknown player', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const a = await api.refused('GET', 'players/Ghost', 'common.playerNamedNotFound', { token: p.token, status: 404 });
      expect(a.body).toEqual({ ok: -41, error: { code: 'common.playerNamedNotFound', params: { name: 'Ghost' } } });
    }));
});

describe('PATCH /player/face', () => {
  it('sets the portrait and sex once', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const body = { faceUrl: 'images/icon/player/faceB1.jpg', sex: 1 };
      expect(await api.ok('PATCH', 'player/face', { token: p.token, body })).toBeNull();
      expect((await state(api, p)).playerInfo).toMatchObject({ faceUrl: body.faceUrl, sex: 1, changedFace: true });
      await api.refused('PATCH', 'player/face', 'player.invalidSetting', { token: p.token, body, status: 400 });
    }));

  it('validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await expectInvalid(api, p.token, [
        { method: 'PATCH', url: 'player/face', body: { sex: 1 } },
        { method: 'PATCH', url: 'player/face', body: { faceUrl: 'x', sex: '1' } },
      ]);
    }));
});

describe('POST /player/flag', () => {
  it('changes the flag', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok('POST', 'player/flag', { token: p.token, body: { flag: 'NEW' } })).toBeNull();
      expect((await playerRow(api, p))!.flag).toBe('NEW');
      await api.refused('POST', 'player/flag', 'player.invalidFlag', { token: p.token, body: { flag: 'TOOLONG' }, status: 400 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'player/flag', body: { flag: 5 } }]);
    }));
});

describe('POST /player/flag-colour', () => {
  it('changes the colour, and only to one of the set', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok('POST', 'player/flag-colour', { token: p.token, body: { colour: 'teal' } })).toBeNull();
      expect((await playerRow(api, p))!.flagColour).toBe('teal');
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'player/flag-colour', body: { colour: 'chartreuse' } }]);
    }));
});

describe('POST /player/rename', () => {
  it('renames the player, then not again for a while', () =>
    apiTest(async (api) => {
      const p = await api.player('Before');
      await api.ok('POST', 'player/rename', { token: p.token, body: { userName: 'After' } });
      expect((await playerRow(api, p))!.name).toBe('After');
      expect((await state(api, p)).nextRenameAt).toBeGreaterThan(Date.now());
      const a = await api.refused('POST', 'player/rename', 'player.renameCooldown', { token: p.token, body: { userName: 'Again' }, status: 400 });
      expect(a.body.error?.params).toEqual({ count: expect.any(Number) });
    }));

  it('refuses a name another player has, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.player('Holder');
      await api.refused('POST', 'player/rename', 'player.nameTaken', { token: p.token, body: { userName: 'Holder' }, status: 409 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'player/rename', body: {} }]);
    }));
});

describe('POST /player/gender', () => {
  it('changes the gender; the same gender is refused', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.ok('POST', 'player/gender', { token: p.token, body: { sex: 1 } });
      expect((await playerRow(api, p))!.sex).toBe(1);
      await api.refused('POST', 'player/gender', 'player.sameGender', { token: p.token, body: { sex: 1 }, status: 400 });
    }));

  it('accepts only 0 or 1', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'player/gender', body: { sex: 2 } },
        { method: 'POST', url: 'player/gender', body: { sex: -1 } },
      ]);
    }));
});

describe('POST /player/title/promote', () => {
  it('refuses without the prestige, and at the highest title; the city paying is required', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const body = { cityId: p.cityId };
      const a = await api.refused('POST', 'player/title/promote', 'player.title.prestigeRequired', { token: p.token, body, status: 400 });
      expect(a.body.error?.params).toEqual({ prestige: expect.any(Number) });
      await api.game((ctx) => admin.setPlayerFlags(ctx, p.username, { title: 9 }));
      await api.refused('POST', 'player/title/promote', 'player.title.highest', { token: p.token, body, status: 400 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'player/title/promote', body: {} }]);
    }));
});

describe('POST /player/tutorial', () => {
  it('stores the tutorial step', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.ok('POST', 'player/tutorial', { token: p.token, body: { step: 7 } });
      expect((await state(api, p)).tutorialStepId).toBe(7);
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'player/tutorial', body: { step: -1 } },
        { method: 'POST', url: 'player/tutorial', body: {} },
      ]);
    }));
});

describe('POST /player/furlough', () => {
  it("starts holiday mode, paid with the city's gold", () =>
    apiTest(async (api) => {
      const p = await api.player();
      await giveGold(api, p);
      await api.ok('POST', 'player/furlough', { token: p.token, body: { days: 2, cityId: p.cityId } });
      const s = await state(api, p);
      expect(s.furlough).toBe(true);
      expect(s.buffs.map((b) => b.id)).toContain(BuffId.HOLIDAY);
      expect(s.castles[0]!.resource.gold).toBeLessThan(1_000_000);
    }));

  it('refuses a number of days out of range, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const a = await api.refused('POST', 'player/furlough', 'player.holiday.invalidDays', {
        token: p.token,
        body: { days: 31, cityId: p.cityId },
        status: 400,
      });
      expect(a.body.error?.params).toEqual({ max: 30 });
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'player/furlough', body: { days: 1 } },
        { method: 'POST', url: 'player/furlough', body: { days: 1, cityId: -1 } },
      ]);
    }));
});

describe('DELETE /player/furlough', () => {
  it('ends holiday mode', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await giveGold(api, p);
      await api.ok('POST', 'player/furlough', { token: p.token, body: { days: 1, cityId: p.cityId } });
      expect(await api.ok('DELETE', 'player/furlough', { token: p.token })).toBeNull();
      const s = await state(api, p);
      expect(s.furlough).toBe(false);
      expect(s.buffs.map((b) => b.id)).not.toContain(BuffId.HOLIDAY);
    }));
});

describe('POST /player/truce', () => {
  it("buys a King's Peace with the city's gold when none is owned", () =>
    apiTest(async (api) => {
      const p = await api.player();
      await giveGold(api, p);
      await api.ok('POST', 'player/truce', { token: p.token, body: { cityId: p.cityId } });
      expect((await state(api, p)).buffs).toContainEqual(expect.objectContaining({ id: BuffId.TRUCE, itemId: ItemId.KINGS_PEACE }));
    }));

  it("refuses another player's city (403) and validates the body", () =>
    apiTest(async (api) => {
      const p = await api.player();
      const other = await api.player();
      await api.refused('POST', 'player/truce', 'common.invalidCastle', { token: p.token, body: { cityId: other.cityId }, status: 403 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'player/truce', body: { itemId: ItemId.KINGS_PEACE } }]);
    }));
});

describe('POST /player/restart', () => {
  it('wipes the cities but keeps the player', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok('POST', 'player/restart', { token: p.token })).toBeNull();
      const s = await state(api, p);
      expect(s.castles).toEqual([]);
      expect(s.playerInfo.id).toBe(p.playerId);
    }));
});

describe('GET /player/bookmarks', () => {
  it('answers the bookmarks', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok('GET', 'player/bookmarks', { token: p.token })).toEqual([]);
    }));
});

describe('POST /player/bookmarks', () => {
  it("bookmarks a player's castle and answers the list", () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.player('Marked');
      const { castles } = await api.ok<PublicPlayerInfo>('GET', 'players/Marked', { token: p.token });
      const tileId = castles[0]!.fieldId;
      const list = await api.ok<CastleSign[]>('POST', 'player/bookmarks', { token: p.token, body: { tileId } });
      expect(list).toEqual([expect.objectContaining({ tileId, name: 'Marked City', x: castles[0]!.x, y: castles[0]!.y })]);
      expect(await api.ok('GET', 'player/bookmarks', { token: p.token })).toEqual(list);
    }));

  it('refuses a tile without a castle, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.refused('POST', 'player/bookmarks', 'common.invalidCoordinates', { token: p.token, body: { tileId: 10_000_000 }, status: 400 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'player/bookmarks', body: { tileId: -5 } }]);
    }));
});

describe('DELETE /player/bookmarks/:tileId', () => {
  it('removes a bookmark and answers the list', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.player('Unmarked');
      const { castles } = await api.ok<PublicPlayerInfo>('GET', 'players/Unmarked', { token: p.token });
      await api.ok('POST', 'player/bookmarks', { token: p.token, body: { tileId: castles[0]!.fieldId } });
      expect(await api.ok('DELETE', `player/bookmarks/${castles[0]!.fieldId}`, { token: p.token })).toEqual([]);
      await expectInvalid(api, p.token, [{ method: 'DELETE', url: 'player/bookmarks/abc' }]);
    }));
});

describe('GET /player/army-presets', () => {
  it('answers the saved presets', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok('GET', 'player/army-presets', { token: p.token })).toEqual([]);
    }));
});

describe('POST /player/army-presets', () => {
  it('saves a preset and answers the list', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const list = await api.ok<ArmyPreset[]>('POST', 'player/army-presets', {
        token: p.token,
        body: { name: ' Raiders ', troops: { scouter: 5, archer: 0 } },
      });
      expect(list).toEqual([{ id: expect.any(String), name: 'Raiders', troops: { scouter: 5 } }]);
      expect(await api.ok('GET', 'player/army-presets', { token: p.token })).toEqual(list);
    }));

  it('refuses a preset without troops, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.refused('POST', 'player/army-presets', 'common.noTroopsSelected', { token: p.token, body: { name: 'Empty', troops: {} }, status: 400 });
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'player/army-presets', body: { name: 'X' } },
        { method: 'POST', url: 'player/army-presets', body: { name: 'X', troops: { scouter: 1.5 } } },
      ]);
    }));
});

describe('DELETE /player/army-presets/:presetId', () => {
  it('deletes a preset and answers the list', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const [preset] = await api.ok<ArmyPreset[]>('POST', 'player/army-presets', { token: p.token, body: { name: 'Gone', troops: { scouter: 1 } } });
      expect(await api.ok('DELETE', `player/army-presets/${preset!.id}`, { token: p.token })).toEqual([]);
    }));
});

describe('GET /player/statistics', () => {
  it("answers the player's statistics with one entry per city", () =>
    apiTest(async (api) => {
      const p = await api.player();
      const s = await api.ok<LordStatistics>('GET', 'player/statistics', { token: p.token });
      expect(s).toMatchObject({ allTime: {}, last7Days: {}, since: expect.any(Number) });
      expect(s.cities).toEqual([expect.objectContaining({ cityId: p.cityId, name: expect.any(String), owned: true })]);
    }));
});

/** A one-action flow (pick the mayor) on the player's city, which gets a hero to run it with. */
async function mayorFlow(api: TestApi, p: Player) {
  await api.game((ctx) => admin.addHero(ctx, p.cityId, p.playerId, 1));
  const [f] = await api.ok<Flow[]>('POST', 'player/flows', {
    token: p.token,
    body: { name: 'Mayor', actions: [{ type: 'setMayor', stat: 'power' }], cities: [p.cityId] },
  });
  return f;
}

describe('GET /player/flows', () => {
  it('answers the saved flows', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok('GET', 'player/flows', { token: p.token })).toEqual([]);
      const f = await mayorFlow(api, p);
      expect(await api.ok<Flow[]>('GET', 'player/flows', { token: p.token })).toEqual([f]);
    }));
});

describe('POST /player/flows', () => {
  it('creates a flow and answers the list', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const f = await mayorFlow(api, p);
      expect(f).toMatchObject({ id: expect.any(String), name: 'Mayor', status: 'idle', repeat: false, actions: [{ type: 'setMayor', stat: 'power' }] });
    }));

  it('refuses an unknown flow id, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const body = { id: 'nope', name: 'F', actions: [{ type: 'setMayor', stat: 'power' }] };
      await api.refused('POST', 'player/flows', 'flow.notFound', { token: p.token, body, status: 404 });
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'player/flows', body: { name: 'F', actions: [] } },
        { method: 'POST', url: 'player/flows', body: { name: 'F', actions: [{ type: 'dance' }] } },
        { method: 'POST', url: 'player/flows', body: { name: 'F', actions: [{ type: 'setMayor', stat: 'power' }], cities: [] } },
      ]);
    }));
});

describe('DELETE /player/flows/:flowId', () => {
  it('deletes a flow and answers the list', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const f = (await mayorFlow(api, p))!;
      expect(await api.ok('DELETE', `player/flows/${f.id}`, { token: p.token })).toEqual([]);
    }));
});

describe('POST /player/flows/:flowId/run', () => {
  it('runs the flow now and answers what each city did', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const f = (await mayorFlow(api, p))!;
      const r = await api.ok<FlowRunReport>('POST', `player/flows/${f.id}/run`, { token: p.token, body: {} });
      expect(r).toMatchObject({ preview: false, flow: { id: f.id }, skippedCities: [] });
      expect(r.cities).toEqual([expect.objectContaining({ cityId: p.cityId, ok: true, error: null })]);
      const [after] = await api.ok<Flow[]>('GET', 'player/flows', { token: p.token });
      expect(after!.runs).toBe(1);
    }));

  it('previews without running', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const f = (await mayorFlow(api, p))!;
      const r = await api.ok<FlowRunReport>('POST', `player/flows/${f.id}/run`, { token: p.token, body: { preview: true } });
      expect(r).toMatchObject({ preview: true, flow: null, cities: [expect.objectContaining({ cityId: p.cityId })] });
      const [after] = await api.ok<Flow[]>('GET', 'player/flows', { token: p.token });
      expect(after).toMatchObject({ runs: 0, lastPreview: { cities: [expect.objectContaining({ cityId: p.cityId })] } });
    }));

  it('answers 404 for an unknown flow, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.refused('POST', 'player/flows/nope/run', 'flow.notFound', { token: p.token, body: {}, status: 404 });
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'player/flows/nope/run', body: { cityIds: [] } },
        { method: 'POST', url: 'player/flows/nope/run', body: { preview: 'yes' } },
      ]);
    }));
});

describe('POST /player/flows/:flowId/repeat', () => {
  it('switches repeat on and off', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const f = (await mayorFlow(api, p))!;
      const [on] = await api.ok<Flow[]>('POST', `player/flows/${f.id}/repeat`, { token: p.token, body: { repeat: true } });
      expect(on).toMatchObject({ id: f.id, repeat: true });
      expect(on!.runs).toBeGreaterThan(0);
      const [off] = await api.ok<Flow[]>('POST', `player/flows/${f.id}/repeat`, { token: p.token, body: { repeat: false } });
      expect(off!.repeat).toBe(false);
    }));

  it('answers 404 for an unknown flow, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.refused('POST', 'player/flows/nope/repeat', 'flow.notFound', { token: p.token, body: { repeat: true }, status: 404 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'player/flows/nope/repeat', body: {} }]);
    }));
});

describe('POST /player/flows/:flowId/stop', () => {
  it('stops a repeating flow', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const f = (await mayorFlow(api, p))!;
      await api.ok('POST', `player/flows/${f.id}/repeat`, { token: p.token, body: { repeat: true } });
      const [stopped] = await api.ok<Flow[]>('POST', `player/flows/${f.id}/stop`, { token: p.token });
      expect(stopped).toMatchObject({ id: f.id, repeat: false, status: 'idle' });
      await api.refused('POST', 'player/flows/nope/stop', 'flow.notFound', { token: p.token, status: 404 });
    }));
});

describe('POST /player/items/:itemId/use', () => {
  it('uses an item the player owns', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.game((ctx) => admin.grantItems(ctx, p.username, { [ItemId.WAR_HORN]: 2 }));
      const r = await api.ok<UseItemResult>('POST', `player/items/${ItemId.WAR_HORN}/use`, { token: p.token, body: {} });
      expect(r).toEqual({ itemId: ItemId.WAR_HORN });
      const s = await state(api, p);
      expect(s.items).toContainEqual({ id: ItemId.WAR_HORN, count: 1 });
      expect(s.buffs).toContainEqual(expect.objectContaining({ itemId: ItemId.WAR_HORN }));
    }));

  it('refuses an item the player does not have, and validates the body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const a = await api.refused('POST', `player/items/${ItemId.WAR_HORN}/use`, 'common.insufficientItems', { token: p.token, body: {}, status: 400 });
      expect(a.body.ok).toBe(-24);
      await expectInvalid(api, p.token, [{ method: 'POST', url: `player/items/${ItemId.WAR_HORN}/use`, body: { cityId: 'here' } }]);
    }));

  it('takes a request without a body', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.game((ctx) => admin.grantItems(ctx, p.username, { [ItemId.WAR_HORN]: 1 }));
      await api.ok('POST', `player/items/${ItemId.WAR_HORN}/use`, { token: p.token });
    }));
});
