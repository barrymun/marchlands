import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type {
  AllianceApplication,
  AllianceEvent,
  AllianceList,
  AllianceMember,
  AlliancePublicInfo,
  AllianceReceivedInvite,
  AllianceSentInvite,
  CreateAllianceResult,
  MailList,
  MyAlliance,
} from '@marchlands/contracts';
import { AllianceRank, BALANCE, BuildingType } from '@marchlands/core';
import { players } from '@marchlands/db';
import { admin } from '@marchlands/game';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsPlayer, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

type Player = Awaited<ReturnType<TestApi['player']>>;

/** Every alliance route that needs a player, with a valid request. */
const PLAYER_ROUTES: RouteCall[] = [
  { method: 'GET', url: 'alliance' },
  { method: 'POST', url: 'alliance', body: { cityId: 1, allianceName: 'Order' } },
  { method: 'PATCH', url: 'alliance', body: { motd: 'hi' } },
  { method: 'POST', url: 'alliance/leave' },
  { method: 'GET', url: 'alliance/members' },
  { method: 'GET', url: 'alliance/events' },
  { method: 'GET', url: 'alliance/military' },
  { method: 'POST', url: 'alliance/invites', body: { userName: 'X' } },
  { method: 'GET', url: 'alliance/invites' },
  { method: 'POST', url: 'alliance/invites/cancel', body: { userName: 'X' } },
  { method: 'GET', url: 'alliance/my-invites' },
  { method: 'POST', url: 'alliance/my-invites/accept', body: { allianceName: 'Order' } },
  { method: 'POST', url: 'alliance/my-invites/reject', body: { allianceName: 'Order' } },
  { method: 'POST', url: 'alliance/apply', body: { allianceName: 'Order' } },
  { method: 'DELETE', url: 'alliance/apply' },
  { method: 'GET', url: 'alliance/apply' },
  { method: 'GET', url: 'alliance/applications' },
  { method: 'POST', url: 'alliance/applications/accept', body: { userName: 'X' } },
  { method: 'POST', url: 'alliance/applications/decline', body: { userName: 'X' } },
  { method: 'POST', url: 'alliance/members/rank', body: { userName: 'X', rank: 7 } },
  { method: 'POST', url: 'alliance/members/host', body: { userName: 'X' } },
  { method: 'POST', url: 'alliance/members/kick', body: { userName: 'X' } },
  { method: 'POST', url: 'alliance/mail', body: { title: 'T', content: 'C' } },
  { method: 'PUT', url: 'alliance/relations', body: { targetAllianceName: 'Other', type: 1 } },
  { method: 'DELETE', url: 'alliance/relations/Other' },
];
/** Public alliance info: a token, but no player. */
const ACCOUNT_ROUTES: RouteCall[] = [
  { method: 'GET', url: 'alliances' },
  { method: 'GET', url: 'alliances/Order' },
];

/** A new player who founds the alliance `name` over the API (given the gold it costs). */
async function founder(api: TestApi, name: string, playerName?: string) {
  const host = await api.player(playerName);
  await api.game((ctx) => admin.setResources(ctx, host.cityId, host.playerId, { gold: BALANCE.allianceCreateGold }));
  await api.ok('POST', 'alliance', { token: host.token, body: { cityId: host.cityId, allianceName: name } });
  return host;
}

/** A player with an Embassy (needed to join an alliance). */
async function joiner(api: TestApi, name?: string) {
  const p = await api.player(name);
  await api.game((ctx) => admin.setBuilding(ctx, p.cityId, p.playerId, 4, BuildingType.EMBASSY, 1));
  return p;
}

/** `p` is invited into the host's alliance and accepts. */
async function join(api: TestApi, host: Player, p: Player, allianceName: string) {
  await api.ok('POST', 'alliance/invites', { token: host.token, body: { userName: p.username } });
  await api.ok('POST', 'alliance/my-invites/accept', { token: p.token, body: { allianceName } });
}

/** A Host and a member who joined by invitation. */
async function withMember(api: TestApi) {
  const host = await founder(api, 'Order', 'Host');
  const member = await joiner(api, 'Member');
  await join(api, host, member, 'Order');
  return { host, member };
}

const rankOf = async (api: TestApi, p: Player) => (await api.db.select().from(players).where(eq(players.id, p.playerId)))[0];

describe('authentication', () => {
  it('every alliance route needs a token', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, [...PLAYER_ROUTES, ...ACCOUNT_ROUTES]);
    }));

  it('every route but the public alliance info needs a player', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      await expectNeedsPlayer(api, a.token, PLAYER_ROUTES);
      await api.ok('GET', 'alliances', { token: a.token });
    }));
});

describe('GET /alliance', () => {
  it("answers the player's alliance with their rank and its relations, or null", () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order', 'Host');
      const mine = await api.ok<MyAlliance>('GET', 'alliance', { token: host.token });
      expect(mine).toMatchObject({ myRank: AllianceRank.HOST, friendlyList: [], middleList: [], enemyList: [] });
      expect(mine.alliance).toMatchObject({
        allianceName: 'Order',
        creatorName: 'Host',
        leaderName: 'Host',
        memberCount: 1,
        memberLimit: BALANCE.allianceMaxMembers,
      });
      const loner = await api.player();
      expect(await api.ok('GET', 'alliance', { token: loner.token })).toBeNull();
    }));
});

describe('GET /alliances', () => {
  it('lists alliances, filtered by name', () =>
    apiTest(async (api) => {
      await founder(api, 'Order');
      await founder(api, 'Chaos');
      const a = await accountWithoutPlayer(api);
      const all = await api.ok<AllianceList>('GET', 'alliances', { token: a.token });
      expect(all).toMatchObject({ pageNo: 1, pageSize: 10, totalPage: 1 });
      expect(all.alliances.map((x) => x.allianceName).sort()).toEqual(['Chaos', 'Order']);
      const found = await api.ok<AllianceList>('GET', 'alliances?key=ord', { token: a.token });
      expect(found.alliances).toEqual([{ id: expect.any(Number), allianceName: 'Order', rank: expect.any(Number), prestige: 0, honor: 0, memberCount: 1 }]);
      await expectInvalid(api, a.token, [{ method: 'GET', url: 'alliances?pageSize=100' }]);
    }));
});

describe('GET /alliances/:name', () => {
  it("answers an alliance's public info, or 404", () =>
    apiTest(async (api) => {
      await founder(api, 'Order', 'Host');
      const a = await accountWithoutPlayer(api);
      expect(await api.ok<AlliancePublicInfo>('GET', 'alliances/order', { token: a.token })).toMatchObject({
        allianceName: 'Order',
        leader: 'Host',
        creator: 'Host',
      });
      const r = await api.refused('GET', 'alliances/Nowhere', 'alliance.namedNotFound', { token: a.token, status: 404 });
      expect(r.body.error?.params).toEqual({ name: 'Nowhere' });
    }));
});

describe('POST /alliance', () => {
  it('founds an alliance for gold from the city', () =>
    apiTest(async (api) => {
      const host = await api.player();
      await api.game((ctx) => admin.setResources(ctx, host.cityId, host.playerId, { gold: BALANCE.allianceCreateGold }));
      const r = await api.ok<CreateAllianceResult>('POST', 'alliance', { token: host.token, body: { cityId: host.cityId, allianceName: 'Order' } });
      expect(r).toEqual({ id: expect.any(Number), msg: { code: 'alliance.event.created', params: { name: 'Order' } } });
      expect(await rankOf(api, host)).toMatchObject({ allianceId: r.id, allianceRank: AllianceRank.HOST });
      expect((await api.ok<{ castles: { resource: { gold: number } }[] }>('GET', 'player', { token: host.token })).castles[0]!.resource.gold).toBe(0);
    }));

  it('refuses without the gold, a name taken (409), and validates the body', () =>
    apiTest(async (api) => {
      await founder(api, 'Order');
      const p = await api.player();
      await api.game((ctx) => admin.setResources(ctx, p.cityId, p.playerId, { gold: 0 }));
      await api.refused('POST', 'alliance', 'common.notEnoughGold', { token: p.token, body: { cityId: p.cityId, allianceName: 'Poor' }, status: 400 });
      const taken = await api.refused('POST', 'alliance', 'alliance.nameTaken', {
        token: p.token,
        body: { cityId: p.cityId, allianceName: 'ORDER' },
        status: 409,
      });
      expect(taken.body.ok).toBe(-12);
      await expectInvalid(api, p.token, [
        { method: 'POST', url: 'alliance', body: { allianceName: 'X' } },
        { method: 'POST', url: 'alliance', body: { cityId: p.cityId } },
      ]);
    }));
});

describe('PATCH /alliance', () => {
  it('sets the note, intro and message of the day (Host)', () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      expect(await api.ok('PATCH', 'alliance', { token: host.token, body: { motd: 'Muster at dawn', intro: 'We hold the line' } })).toBeNull();
      expect((await api.ok<MyAlliance>('GET', 'alliance', { token: member.token })).alliance).toMatchObject({
        motd: 'Muster at dawn',
        allianceInfo: 'We hold the line',
      });
      const a = await api.refused('PATCH', 'alliance', 'alliance.rankTooLow', { token: member.token, body: { motd: 'coup' }, status: 400 });
      expect(a.body.ok).toBe(-42);
      await expectInvalid(api, host.token, [{ method: 'PATCH', url: 'alliance', body: { motd: 1 } }]);
    }));
});

describe('POST /alliance/leave', () => {
  it('lets a member leave; the Host must hand over first', () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      await api.refused('POST', 'alliance/leave', 'alliance.hostMustTransfer', { token: host.token, status: 400 });
      expect(await api.ok('POST', 'alliance/leave', { token: member.token })).toBeNull();
      expect(await api.ok('GET', 'alliance', { token: member.token })).toBeNull();
      await api.refused('POST', 'alliance/leave', 'alliance.notMember', { token: member.token, status: 400 });
    }));
});

describe('GET /alliance/members', () => {
  it('lists the members by rank', () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      const list = await api.ok<AllianceMember[]>('GET', 'alliance/members', { token: member.token });
      expect(list.map((m) => [m.id, m.userName, m.levelId])).toEqual([
        [host.playerId, 'Host', AllianceRank.HOST],
        [member.playerId, 'Member', AllianceRank.MEMBER],
      ]);
      expect(list[0]).toMatchObject({ castleCount: 1, prestige: expect.any(Number), lastLoginTime: expect.any(Number) });
      await api.refused('GET', 'alliance/members', 'alliance.notMember', { token: (await api.player()).token, status: 400 });
    }));
});

describe('GET /alliance/events', () => {
  it('answers the event log, newest first', () =>
    apiTest(async (api) => {
      const { host } = await withMember(api);
      const log = await api.ok<AllianceEvent[]>('GET', 'alliance/events', { token: host.token });
      expect(log.map((e) => e.message.code)).toEqual(['alliance.event.joined', 'alliance.event.created']);
      expect(log[0]).toEqual({ message: { code: 'alliance.event.joined', params: { name: 'Member' } }, time: expect.any(Number) });
    }));
});

describe('GET /alliance/military', () => {
  it("answers the members' armies (none at home)", () =>
    apiTest(async (api) => {
      const { member } = await withMember(api);
      expect(await api.ok('GET', 'alliance/military', { token: member.token })).toEqual([]);
      await api.refused('GET', 'alliance/military', 'alliance.notMember', { token: (await api.player()).token, status: 400 });
    }));
});

describe('POST /alliance/invites', () => {
  it('invites a player, who sees the invitation', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order', 'Host');
      const guest = await api.player('Guest');
      expect(await api.ok('POST', 'alliance/invites', { token: host.token, body: { userName: 'Guest' } })).toBeNull();
      expect(await api.ok<AllianceSentInvite[]>('GET', 'alliance/invites', { token: host.token })).toEqual([
        { userName: 'Guest', prestige: expect.any(Number), rank: expect.any(Number), invitePerson: 'Host', inviteTime: expect.any(Number) },
      ]);
      expect(await api.ok<AllianceReceivedInvite[]>('GET', 'alliance/my-invites', { token: guest.token })).toEqual([
        { allianceName: 'Order', prestige: 0, rank: expect.any(Number), memberCount: 1, invitePerson: 'Host' },
      ]);
    }));

  it('refuses an unknown player (404), a member below Presbyter, and validates the body', () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      await api.player('Guest');
      await api.refused('POST', 'alliance/invites', 'common.playerNamedNotFound', { token: host.token, body: { userName: 'Nobody' }, status: 404 });
      await api.refused('POST', 'alliance/invites', 'alliance.rankTooLow', { token: member.token, body: { userName: 'Guest' }, status: 400 });
      await expectInvalid(api, host.token, [{ method: 'POST', url: 'alliance/invites', body: {} }]);
    }));
});

describe('GET /alliance/invites', () => {
  it('refuses a player without an alliance', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await api.refused('GET', 'alliance/invites', 'alliance.notMember', { token: p.token, status: 400 });
    }));
});

describe('POST /alliance/invites/cancel', () => {
  it('withdraws an invitation', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      const guest = await api.player('Guest');
      await api.ok('POST', 'alliance/invites', { token: host.token, body: { userName: 'Guest' } });
      expect(await api.ok('POST', 'alliance/invites/cancel', { token: host.token, body: { userName: 'Guest' } })).toBeNull();
      expect(await api.ok('GET', 'alliance/my-invites', { token: guest.token })).toEqual([]);
      await expectInvalid(api, host.token, [{ method: 'POST', url: 'alliance/invites/cancel', body: { userName: 3 } }]);
    }));
});

describe('GET /alliance/my-invites', () => {
  it('answers no invitations for a new player', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok('GET', 'alliance/my-invites', { token: p.token })).toEqual([]);
    }));
});

describe('POST /alliance/my-invites/accept', () => {
  it('joins the alliance', () =>
    apiTest(async (api) => {
      const { member } = await withMember(api);
      expect((await api.ok<MyAlliance>('GET', 'alliance', { token: member.token })).myRank).toBe(AllianceRank.MEMBER);
    }));

  it('refuses without an Embassy, without an invitation, and validates the body', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      const guest = await api.player('Guest');
      await api.ok('POST', 'alliance/invites', { token: host.token, body: { userName: 'Guest' } });
      const a = await api.refused('POST', 'alliance/my-invites/accept', 'alliance.buildingRequired', {
        token: guest.token,
        body: { allianceName: 'Order' },
        status: 400,
      });
      expect(a.body.error?.params).toEqual({ building: { ref: 'building', id: BuildingType.EMBASSY } });
      const stranger = await joiner(api);
      await api.refused('POST', 'alliance/my-invites/accept', 'alliance.inviteNotFound', {
        token: stranger.token,
        body: { allianceName: 'Order' },
        status: 400,
      });
      await expectInvalid(api, guest.token, [{ method: 'POST', url: 'alliance/my-invites/accept', body: {} }]);
    }));
});

describe('POST /alliance/my-invites/reject', () => {
  it('turns an invitation down', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      const guest = await api.player('Guest');
      await api.ok('POST', 'alliance/invites', { token: host.token, body: { userName: 'Guest' } });
      expect(await api.ok('POST', 'alliance/my-invites/reject', { token: guest.token, body: { allianceName: 'Order' } })).toBeNull();
      expect(await api.ok('GET', 'alliance/invites', { token: host.token })).toEqual([]);
      await api.refused('POST', 'alliance/my-invites/reject', 'alliance.namedNotFound', { token: guest.token, body: { allianceName: 'Nowhere' }, status: 404 });
    }));
});

describe('POST /alliance/apply', () => {
  it('applies to an alliance; the application shows on both sides', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      const hopeful = await joiner(api, 'Hopeful');
      expect(await api.ok('POST', 'alliance/apply', { token: hopeful.token, body: { allianceName: 'Order' } })).toBeNull();
      expect(await api.ok('GET', 'alliance/apply', { token: hopeful.token })).toEqual({ allianceName: 'Order', applyTime: expect.any(Number) });
      expect(await api.ok<AllianceApplication[]>('GET', 'alliance/applications', { token: host.token })).toEqual([
        { userName: 'Hopeful', prestige: expect.any(Number), rank: expect.any(Number), inviteTime: expect.any(Number), castleCount: 1 },
      ]);
    }));

  it('refuses without an Embassy and validates the body', () =>
    apiTest(async (api) => {
      await founder(api, 'Order');
      const p = await api.player();
      await api.refused('POST', 'alliance/apply', 'alliance.buildingRequired', { token: p.token, body: { allianceName: 'Order' }, status: 400 });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'alliance/apply', body: { allianceName: null } }]);
    }));
});

describe('DELETE /alliance/apply', () => {
  it('withdraws the application, and refuses when there is none', () =>
    apiTest(async (api) => {
      await founder(api, 'Order');
      const hopeful = await joiner(api);
      await api.ok('POST', 'alliance/apply', { token: hopeful.token, body: { allianceName: 'Order' } });
      expect(await api.ok('DELETE', 'alliance/apply', { token: hopeful.token })).toBeNull();
      expect(await api.ok('GET', 'alliance/apply', { token: hopeful.token })).toEqual({ allianceName: null, applyTime: null });
      await api.refused('DELETE', 'alliance/apply', 'alliance.notApplied', { token: hopeful.token, status: 400 });
    }));
});

describe('GET /alliance/applications', () => {
  it('needs Presbyter rank or above', () =>
    apiTest(async (api) => {
      const { member } = await withMember(api);
      await api.refused('GET', 'alliance/applications', 'alliance.rankTooLow', { token: member.token, status: 400 });
    }));
});

describe('POST /alliance/applications/accept', () => {
  it('takes the applicant in', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      const hopeful = await joiner(api, 'Hopeful');
      await api.ok('POST', 'alliance/apply', { token: hopeful.token, body: { allianceName: 'Order' } });
      expect(await api.ok('POST', 'alliance/applications/accept', { token: host.token, body: { userName: 'Hopeful' } })).toBeNull();
      expect((await api.ok<MyAlliance>('GET', 'alliance', { token: hopeful.token })).alliance.allianceName).toBe('Order');
      await api.refused('POST', 'alliance/applications/accept', 'common.playerNamedNotFound', { token: host.token, body: { userName: 'Nobody' }, status: 404 });
    }));

  it('refuses a player who did not apply', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      await api.player('Bystander');
      await api.refused('POST', 'alliance/applications/accept', 'alliance.applicationNotFound', {
        token: host.token,
        body: { userName: 'Bystander' },
        status: 400,
      });
    }));
});

describe('POST /alliance/applications/decline', () => {
  it('declines the application', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      const hopeful = await joiner(api, 'Hopeful');
      await api.ok('POST', 'alliance/apply', { token: hopeful.token, body: { allianceName: 'Order' } });
      expect(await api.ok('POST', 'alliance/applications/decline', { token: host.token, body: { userName: 'Hopeful' } })).toBeNull();
      expect(await api.ok('GET', 'alliance/applications', { token: host.token })).toEqual([]);
      expect(await api.ok('GET', 'alliance/apply', { token: hopeful.token })).toEqual({ allianceName: null, applyTime: null });
      await expectInvalid(api, host.token, [{ method: 'POST', url: 'alliance/applications/decline', body: {} }]);
    }));
});

describe('POST /alliance/members/rank', () => {
  it("sets a member's rank", () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      expect(await api.ok('POST', 'alliance/members/rank', { token: host.token, body: { userName: 'Member', rank: AllianceRank.OFFICER } })).toBeNull();
      expect((await rankOf(api, member))!.allianceRank).toBe(AllianceRank.OFFICER);
    }));

  it('refuses a rank outside 5-8, a rank above the actor, and validates the body', () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      await api.refused('POST', 'alliance/members/rank', 'alliance.invalidRank', { token: host.token, body: { userName: 'Member', rank: 4 }, status: 400 });
      await api.refused('POST', 'alliance/members/rank', 'alliance.rankTooLow', { token: member.token, body: { userName: 'Host', rank: 8 }, status: 400 });
      await expectInvalid(api, host.token, [{ method: 'POST', url: 'alliance/members/rank', body: { userName: 'Member', rank: 'officer' } }]);
    }));
});

describe('POST /alliance/members/host', () => {
  it('hands the Host title to a Vice Host', () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      const a = await api.refused('POST', 'alliance/members/host', 'alliance.hostToViceHostOnly', {
        token: host.token,
        body: { userName: 'Member' },
        status: 400,
      });
      expect(a.body.ok).toBe(-88);
      await api.ok('POST', 'alliance/members/rank', { token: host.token, body: { userName: 'Member', rank: AllianceRank.VICE_HOST } });
      expect(await api.ok('POST', 'alliance/members/host', { token: host.token, body: { userName: 'Member' } })).toBeNull();
      expect((await rankOf(api, member))!.allianceRank).toBe(AllianceRank.HOST);
      expect((await rankOf(api, host))!.allianceRank).toBe(AllianceRank.VICE_HOST);
    }));
});

describe('POST /alliance/members/kick', () => {
  it('expels a lower-ranked member', () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      await api.refused('POST', 'alliance/members/kick', 'alliance.kickHigherRank', { token: member.token, body: { userName: 'Host' }, status: 400 });
      expect(await api.ok('POST', 'alliance/members/kick', { token: host.token, body: { userName: 'Member' } })).toBeNull();
      expect((await rankOf(api, member))!.allianceId).toBeNull();
      await api.refused('POST', 'alliance/members/kick', 'alliance.memberNotFound', { token: host.token, body: { userName: 'Member' }, status: 400 });
    }));
});

describe('POST /alliance/mail', () => {
  it('mails every other member', () =>
    apiTest(async (api) => {
      const { host, member } = await withMember(api);
      expect(await api.ok('POST', 'alliance/mail', { token: host.token, body: { title: 'Orders', content: 'Hold the bridge' } })).toBeNull();
      const inbox = await api.ok<MailList>('GET', 'mail', { token: member.token });
      expect(inbox.mails).toEqual([expect.objectContaining({ title: '[Alliance] Orders', sender: 'Host' })]);
      await api.refused('POST', 'alliance/mail', 'alliance.rankTooLow', { token: member.token, body: { title: 'T', content: 'C' }, status: 400 });
      await expectInvalid(api, host.token, [{ method: 'POST', url: 'alliance/mail', body: { title: 'T' } }]);
    }));
});

describe('PUT /alliance/relations', () => {
  it('sets a relation with another alliance', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      await founder(api, 'Kin');
      expect(await api.ok('PUT', 'alliance/relations', { token: host.token, body: { targetAllianceName: 'Kin', type: 1 } })).toBeNull();
      expect((await api.ok<MyAlliance>('GET', 'alliance', { token: host.token })).friendlyList).toEqual([expect.objectContaining({ allianceName: 'Kin' })]);
    }));

  it('refuses an unknown relation, an unknown alliance (404), and validates the body', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      await founder(api, 'Kin');
      await api.refused('PUT', 'alliance/relations', 'alliance.invalidRelation', {
        token: host.token,
        body: { targetAllianceName: 'Kin', type: 4 },
        status: 400,
      });
      await api.refused('PUT', 'alliance/relations', 'alliance.namedNotFound', {
        token: host.token,
        body: { targetAllianceName: 'Nowhere', type: 1 },
        status: 404,
      });
      await expectInvalid(api, host.token, [{ method: 'PUT', url: 'alliance/relations', body: { targetAllianceName: 'Kin' } }]);
    }));
});

describe('DELETE /alliance/relations/:name', () => {
  it('drops a relation', () =>
    apiTest(async (api) => {
      const host = await founder(api, 'Order');
      await founder(api, 'Kin');
      await api.ok('PUT', 'alliance/relations', { token: host.token, body: { targetAllianceName: 'Kin', type: 2 } });
      expect(await api.ok('DELETE', 'alliance/relations/Kin', { token: host.token })).toBeNull();
      expect((await api.ok<MyAlliance>('GET', 'alliance', { token: host.token })).middleList).toEqual([]);
      await api.refused('DELETE', 'alliance/relations/Nowhere', 'alliance.namedNotFound', { token: host.token, status: 404 });
    }));
});
