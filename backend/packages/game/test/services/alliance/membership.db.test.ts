import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { AllianceRank, BALANCE, BuildingType, msg, ref } from '@marchlands/core';
import { alliances, players } from '@marchlands/db';

import { alliance } from '#/index.ts';
import { addMember, createTestAlliance, withEmbassy } from '#test/support/alliance.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, reloadPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

const noEmbassy = msg('alliance.buildingRequired', { building: ref.building(BuildingType.EMBASSY) });

describe(alliance.invite.name, () => {
  it('records the invitation and tells the player', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const presbyter = await addMember(g, a, AllianceRank.PRESIDENT);
      const p = await createTestPlayer(g);
      g._pushes.length = 0;
      await alliance.invite(g, presbyter.id, p.name.toLowerCase());

      expect(await alliance.myInvites(g, p.id)).toEqual([{ allianceName: a.name, prestige: 0, rank: 0, memberCount: 1, invitePerson: presbyter.name }]);
      expect(g.pushes()).toEqual([
        {
          playerIds: [p.id],
          cmd: PushCmd.SYSTEM_INFO_MESSAGE,
          data: { alliance: false, tV: false, noSenderSystemInfo: false, msg: msg('alliance.invited', { name: a.name }) },
        },
        { playerIds: [p.id], cmd: PushCmd.ALLIANCE_INVITE, data: { allianceName: a.name, invitePerson: presbyter.name } },
      ]);
    }));

  it('inviting twice keeps one invitation', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p = await createTestPlayer(g);
      await alliance.invite(g, a.host.id, p.name);
      await alliance.invite(g, a.host.id, p.name);
      expect(await alliance.sentInvites(g, a.host.id)).toHaveLength(1);
    }));

  it('needs Presbyter or above, a known player and one in no alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const officer = await addMember(g, a, AllianceRank.OFFICER);
      const other = await createTestAlliance(g);
      const p = await createTestPlayer(g);
      await expectRefused(alliance.invite(g, officer.id, p.name), msg('alliance.rankTooLow'));
      await expectRefused(alliance.invite(g, p.id, officer.name), msg('alliance.notMember'));
      await expectRefused(alliance.invite(g, a.host.id, 'Nobody Here'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
      await expectRefused(alliance.invite(g, a.host.id, other.host.name), msg('alliance.playerInOtherAlliance', { name: other.host.name }));
    }));
});

describe(alliance.cancelInvite.name, () => {
  it('withdraws the invitation', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p = await createTestPlayer(g);
      await alliance.invite(g, a.host.id, p.name);
      await alliance.cancelInvite(g, a.host.id, p.name);
      expect(await alliance.myInvites(g, p.id)).toEqual([]);
      expect(await alliance.sentInvites(g, a.host.id)).toEqual([]);
    }));

  it("leaves the player's application and other alliances' invitations alone", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, a.name);
      await alliance.invite(g, b.host.id, p.name);
      await alliance.cancelInvite(g, a.host.id, p.name);
      expect(await alliance.myInvites(g, p.id)).toHaveLength(1);
      expect(await alliance.applications(g, a.host.id)).toHaveLength(1);
    }));

  it('needs Presbyter or above and a known player', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const officer = await addMember(g, a, AllianceRank.OFFICER);
      const p = await createTestPlayer(g);
      await expectRefused(alliance.cancelInvite(g, officer.id, p.name), msg('alliance.rankTooLow'));
      await expectRefused(alliance.cancelInvite(g, p.id, p.name), msg('alliance.notMember'));
      await expectRefused(alliance.cancelInvite(g, a.host.id, 'Nobody Here'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
    }));
});

describe(alliance.sentInvites.name, () => {
  it("lists my alliance's invitations, not applications", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      const invited = await createTestPlayer(g);
      const applicant = await withEmbassy(g, await createTestPlayer(g));
      await g.tx.update(players).set({ prestige: 12.9 }).where(eq(players.id, invited.id));
      await alliance.invite(g, a.host.id, invited.name);
      await alliance.apply(g, applicant.id, a.name);
      expect(await alliance.sentInvites(g, m.id)).toEqual([{ userName: invited.name, prestige: 12, rank: 0, invitePerson: a.host.name, inviteTime: g.now }]);
    }));

  it('rejects a player in no alliance', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(alliance.sentInvites(g, p.id), msg('alliance.notMember'));
    }));
});

describe(alliance.myInvites.name, () => {
  it('lists invitations from every alliance, and nothing else', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      expect(await alliance.myInvites(g, p.id)).toEqual([]);
      await alliance.invite(g, a.host.id, p.name);
      await alliance.invite(g, b.host.id, p.name);
      await alliance.apply(g, p.id, a.name);
      expect((await alliance.myInvites(g, p.id)).map((x) => x.allianceName).sort()).toEqual([a.name, b.name].sort());
    }));
});

describe(alliance.acceptInvite.name, () => {
  it('joins as a Member, clears every pending request and tells the alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, b.name);
      await alliance.invite(g, b.host.id, p.name);
      await alliance.invite(g, a.host.id, p.name);
      g._pushes.length = 0;
      await alliance.acceptInvite(g, p.id, a.name.toUpperCase());

      expect(await reloadPlayer(g, p)).toMatchObject({ allianceId: a.id, allianceRank: AllianceRank.MEMBER, allianceJoinedAt: g.now });
      expect(await alliance.myApplication(g, p.id)).toEqual({ allianceName: null, applyTime: null });
      expect(await alliance.myInvites(g, p.id)).toEqual([]);
      expect(await alliance.applications(g, b.host.id)).toEqual([]);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).map((x) => x.playerIds)).toEqual([[p.id]]);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)).toMatchObject({
        playerIds: expect.arrayContaining([a.host.id, p.id]),
        data: { alliance: true, msg: msg('alliance.event.joined', { name: p.name }) },
      });
    }));

  it('rejects a player already in an alliance, without an Embassy, or not invited', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const p = await createTestPlayer(g);
      await alliance.invite(g, a.host.id, p.name);
      await expectRefused(alliance.acceptInvite(g, p.id, a.name), noEmbassy);
      await withEmbassy(g, p);
      await expectRefused(alliance.acceptInvite(g, p.id, 'No Such Order'), msg('alliance.namedNotFound', { name: 'No Such Order' }));
      await expectRefused(alliance.acceptInvite(g, p.id, b.name), msg('alliance.inviteNotFound'));
      await alliance.acceptInvite(g, p.id, a.name);
      await expectRefused(alliance.acceptInvite(g, p.id, a.name), msg('alliance.alreadyMember'));
    }));

  it('rejects joining a full alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await g.tx.update(alliances).set({ maxMembers: 1 }).where(eq(alliances.id, a.id));
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.invite(g, a.host.id, p.name);
      await expectRefused(alliance.acceptInvite(g, p.id, a.name), msg('alliance.full'));
    }));

  it('rejects rejoining the alliance just left (rejoin cooldown)', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      await alliance.leaveAlliance(g, m.id);
      await alliance.invite(g, a.host.id, m.name);
      await expectRefused(alliance.acceptInvite(g, m.id, a.name), msg('alliance.rejoinCooldown', { count: BALANCE.allianceRejoinCooldownHours }));
    }));
});

describe(alliance.rejectInvite.name, () => {
  it("removes the invitation, leaving others' alone", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const p = await createTestPlayer(g);
      await alliance.invite(g, a.host.id, p.name);
      await alliance.invite(g, b.host.id, p.name);
      await alliance.rejectInvite(g, p.id, a.name);
      expect((await alliance.myInvites(g, p.id)).map((x) => x.allianceName)).toEqual([b.name]);
      await alliance.rejectInvite(g, p.id, a.name); // nothing left to reject: no error
    }));

  it('rejects an unknown alliance', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(alliance.rejectInvite(g, p.id, 'No Such Order'), msg('alliance.namedNotFound', { name: 'No Such Order' }));
    }));
});

describe(alliance.apply.name, () => {
  it('files one application at a time and tells the alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, a.name);
      g.advance(1000);
      await alliance.apply(g, p.id, b.name.toLowerCase());

      expect(await alliance.myApplication(g, p.id)).toEqual({ allianceName: b.name, applyTime: g.now });
      expect(await alliance.applications(g, a.host.id)).toEqual([]);
      expect((await alliance.applications(g, b.host.id)).map((x) => x.userName)).toEqual([p.name]);
      expect((await alliance.events(g, b.host.id))[0].message).toEqual(msg('alliance.event.applied', { name: p.name }));
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)).toMatchObject({ playerIds: [b.host.id] });
    }));

  it('rejects a player already in an alliance, without an Embassy, or applying to an unknown alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const p = await createTestPlayer(g);
      await expectRefused(alliance.apply(g, a.host.id, b.name), msg('alliance.alreadyMember'));
      await expectRefused(alliance.apply(g, p.id, a.name), noEmbassy);
      await withEmbassy(g, p);
      await expectRefused(alliance.apply(g, p.id, 'No Such Order'), msg('alliance.namedNotFound', { name: 'No Such Order' }));
    }));
});

describe(alliance.cancelApplication.name, () => {
  it('withdraws the application', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, a.name);
      await alliance.cancelApplication(g, p.id);
      expect(await alliance.myApplication(g, p.id)).toEqual({ allianceName: null, applyTime: null });
      expect(await alliance.applications(g, a.host.id)).toEqual([]);
    }));

  it('rejects a player with no application', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(alliance.cancelApplication(g, p.id), msg('alliance.notApplied'));
    }));
});

describe(alliance.myApplication.name, () => {
  it('is empty until the player applies', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      expect(await alliance.myApplication(g, p.id)).toEqual({ allianceName: null, applyTime: null });
      await alliance.apply(g, p.id, a.name);
      expect(await alliance.myApplication(g, p.id)).toEqual({ allianceName: a.name, applyTime: g.now });
    }));
});

describe(alliance.applications.name, () => {
  it('lists applications to my alliance, not invitations', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const presbyter = await addMember(g, a, AllianceRank.PRESIDENT);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.invite(g, a.host.id, (await createTestPlayer(g)).name);
      await alliance.apply(g, p.id, a.name);
      expect(await alliance.applications(g, presbyter.id)).toEqual([expect.objectContaining({ userName: p.name, prestige: 0, rank: 0, inviteTime: g.now })]);
    }));

  it("counts each applicant's cities", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, a.name);
      expect((await alliance.applications(g, a.host.id))[0].castleCount).toBe(1);
    }));

  it('needs Presbyter or above', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const officer = await addMember(g, a, AllianceRank.OFFICER);
      const p = await createTestPlayer(g);
      await expectRefused(alliance.applications(g, officer.id), msg('alliance.rankTooLow'));
      await expectRefused(alliance.applications(g, p.id), msg('alliance.notMember'));
    }));
});

describe(alliance.acceptApplication.name, () => {
  it('takes the applicant in as a Member and tells the alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, a.name);
      await alliance.acceptApplication(g, a.host.id, p.name.toUpperCase());
      expect(await reloadPlayer(g, p)).toMatchObject({ allianceId: a.id, allianceRank: AllianceRank.MEMBER });
      expect(await alliance.myApplication(g, p.id)).toEqual({ allianceName: null, applyTime: null });
      expect(await alliance.applications(g, a.host.id)).toEqual([]);
      expect((await alliance.events(g, p.id)).map((e) => e.message)).toContainEqual(msg('alliance.event.joined', { name: p.name }));
    }));

  it('needs Presbyter or above, a known player in no alliance who applied here', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const officer = await addMember(g, a, AllianceRank.OFFICER);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, b.name);
      await expectRefused(alliance.acceptApplication(g, officer.id, p.name), msg('alliance.rankTooLow'));
      await expectRefused(alliance.acceptApplication(g, p.id, p.name), msg('alliance.notMember'));
      await expectRefused(alliance.acceptApplication(g, a.host.id, 'Nobody Here'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
      await expectRefused(alliance.acceptApplication(g, a.host.id, b.host.name), msg('alliance.playerInOtherAlliance', { name: b.host.name }));
      await expectRefused(alliance.acceptApplication(g, a.host.id, p.name), msg('alliance.applicationNotFound'));
    }));

  it('rejects taking in a member over the limit', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await g.tx.update(alliances).set({ maxMembers: 1 }).where(eq(alliances.id, a.id));
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, a.name);
      await expectRefused(alliance.acceptApplication(g, a.host.id, p.name), msg('alliance.full'));
    }));
});

describe(alliance.declineApplication.name, () => {
  it('removes the application and clears it for the applicant', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const presbyter = await addMember(g, a, AllianceRank.PRESIDENT);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, a.name);
      await alliance.declineApplication(g, presbyter.id, p.name);
      expect(await alliance.applications(g, a.host.id)).toEqual([]);
      expect(await alliance.myApplication(g, p.id)).toEqual({ allianceName: null, applyTime: null });
      expect(await reloadPlayer(g, p)).toMatchObject({ allianceId: null });
    }));

  it('leaves alone an application to another alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const p = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, p.id, b.name);
      await alliance.declineApplication(g, a.host.id, p.name);
      expect(await alliance.applications(g, b.host.id)).toHaveLength(1);
      expect(await alliance.myApplication(g, p.id)).toEqual({ allianceName: b.name, applyTime: g.now });
    }));

  it('needs Presbyter or above and a known player', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const officer = await addMember(g, a, AllianceRank.OFFICER);
      const p = await createTestPlayer(g);
      await expectRefused(alliance.declineApplication(g, officer.id, p.name), msg('alliance.rankTooLow'));
      await expectRefused(alliance.declineApplication(g, p.id, p.name), msg('alliance.notMember'));
      await expectRefused(alliance.declineApplication(g, a.host.id, 'Nobody Here'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
    }));
});
