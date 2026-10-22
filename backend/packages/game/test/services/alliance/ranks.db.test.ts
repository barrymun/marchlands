import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { AllianceRank, BALANCE, MailType, msg, ref } from '@marchlands/core';

import { alliance, mail } from '#/index.ts';
import { addMember, allianceRow, createTestAlliance } from '#test/support/alliance.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, reloadPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

describe(alliance.setRank.name, () => {
  it('promotes and demotes, telling the member and the alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      g._pushes.length = 0;
      await alliance.setRank(g, a.host.id, m.name, AllianceRank.PRESIDENT);
      expect(await reloadPlayer(g, m)).toMatchObject({ allianceRank: AllianceRank.PRESIDENT });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).map((x) => x.playerIds)).toEqual([[m.id]]);
      const promoted = msg('alliance.event.promoted', { actor: a.host.name, name: m.name, rank: ref.rank(AllianceRank.PRESIDENT) });
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)).toMatchObject({ playerIds: expect.arrayContaining([a.host.id, m.id]), data: { msg: promoted } });

      g.advance(1000);
      await alliance.setRank(g, a.host.id, m.name, AllianceRank.OFFICER);
      expect(await reloadPlayer(g, m)).toMatchObject({ allianceRank: AllianceRank.OFFICER });
      expect((await alliance.events(g, m.id))[0]!.message).toEqual(
        msg('alliance.event.demoted', { actor: a.host.name, name: m.name, rank: ref.rank(AllianceRank.OFFICER) }),
      );
    }));

  it('a Presbyter may promote a Member to Officer, but not to their own rank or above', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const presbyter = await addMember(g, a, AllianceRank.PRESIDENT);
      const m = await addMember(g, a);
      await expectRefused(alliance.setRank(g, presbyter.id, m.name, AllianceRank.PRESIDENT), msg('alliance.rankTooLow'));
      await alliance.setRank(g, presbyter.id, m.name, AllianceRank.OFFICER);
      expect(await reloadPlayer(g, m)).toMatchObject({ allianceRank: AllianceRank.OFFICER });
    }));

  it('the actor must outrank the member', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p1 = await addMember(g, a, AllianceRank.PRESIDENT);
      const p2 = await addMember(g, a, AllianceRank.PRESIDENT);
      const m = await addMember(g, a);
      const err = await expectRefused(alliance.setRank(g, p1.id, p2.name, AllianceRank.MEMBER), msg('alliance.rankTooLow'));
      expect(err.code).toBe(-42);
      await expectRefused(alliance.setRank(g, m.id, a.host.name, AllianceRank.MEMBER), msg('alliance.rankTooLow'));
    }));

  it('keeps to the number of members a rank may have', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await addMember(g, a, AllianceRank.VICE_HOST);
      await addMember(g, a, AllianceRank.VICE_HOST);
      const m = await addMember(g, a);
      await expectRefused(
        alliance.setRank(g, a.host.id, m.name, AllianceRank.VICE_HOST),
        msg('alliance.rankLimit', { count: 2, rank: ref.rank(AllianceRank.VICE_HOST) }),
      );
      for (let i = 0; i < 4; i++) await addMember(g, a, AllianceRank.PRESIDENT);
      await expectRefused(
        alliance.setRank(g, a.host.id, m.name, AllianceRank.PRESIDENT),
        msg('alliance.rankLimit', { count: 4, rank: ref.rank(AllianceRank.PRESIDENT) }),
      );
      // Members are unlimited
      const o = await addMember(g, a, AllianceRank.OFFICER);
      await alliance.setRank(g, a.host.id, o.name, AllianceRank.MEMBER);
    }));

  it('rejects an invalid rank, yourself, and someone not in the alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      const other = await createTestAlliance(g);
      const outsider = await createTestPlayer(g);
      await expectRefused(alliance.setRank(g, a.host.id, m.name, AllianceRank.HOST), msg('alliance.invalidRank'));
      await expectRefused(alliance.setRank(g, a.host.id, m.name, 9), msg('alliance.invalidRank'));
      await expectRefused(alliance.setRank(g, outsider.id, m.name, AllianceRank.OFFICER), msg('alliance.notMember'));
      await expectRefused(alliance.setRank(g, a.host.id, a.host.name, AllianceRank.OFFICER), msg('alliance.ownRank'));
      await expectRefused(alliance.setRank(g, a.host.id, other.host.name, AllianceRank.OFFICER), msg('alliance.memberNotFound'));
      await expectRefused(alliance.setRank(g, a.host.id, 'Nobody Here', AllianceRank.OFFICER), msg('alliance.memberNotFound'));
    }));
});

describe(alliance.transferHost.name, () => {
  it('the Host and a Vice Host swap ranks and the alliance has a new leader', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const vice = await addMember(g, a, AllianceRank.VICE_HOST);
      g._pushes.length = 0;
      await alliance.transferHost(g, a.host.id, vice.name);
      expect(await reloadPlayer(g, vice)).toMatchObject({ allianceRank: AllianceRank.HOST });
      expect(await reloadPlayer(g, a.host)).toMatchObject({ allianceRank: AllianceRank.VICE_HOST });
      expect(await allianceRow(g, a.id)).toMatchObject({ leaderPlayerId: vice.id });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).map((x) => x.playerIds)).toEqual([[vice.id], [a.host.id]]);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)?.data).toMatchObject({ msg: msg('alliance.event.newHost', { name: vice.name }) });
      // the old Host can now leave
      await alliance.leaveAlliance(g, a.host.id);
    }));

  it('only the Host may hand over, and only to a Vice Host of the alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const vice = await addMember(g, a, AllianceRank.VICE_HOST);
      const presbyter = await addMember(g, a, AllianceRank.PRESIDENT);
      const other = await createTestAlliance(g);
      const outsider = await createTestPlayer(g);
      await expectRefused(alliance.transferHost(g, outsider.id, vice.name), msg('alliance.notMember'));
      await expectRefused(alliance.transferHost(g, vice.id, presbyter.name), msg('alliance.rankTooLow'));
      const err = await expectRefused(alliance.transferHost(g, a.host.id, presbyter.name), msg('alliance.hostToViceHostOnly'));
      expect(err.code).toBe(-88);
      await expectRefused(alliance.transferHost(g, a.host.id, other.host.name), msg('common.playerNamedNotFound', { name: other.host.name }));
      await expectRefused(alliance.transferHost(g, a.host.id, 'Nobody Here'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
    }));
});

describe(alliance.kick.name, () => {
  it('removes a lower ranked member, who cannot rejoin straight away', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const officer = await addMember(g, a, AllianceRank.OFFICER);
      const m = await addMember(g, a);
      g._pushes.length = 0;
      await alliance.kick(g, officer.id, m.name);

      const p = await reloadPlayer(g, m);
      expect(p).toMatchObject({ allianceId: null, allianceRank: 0 });
      expect(p.misc).toMatchObject({ lastAllianceLeftAt: g.now, lastAllianceLeftId: a.id });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).map((x) => x.playerIds)).toEqual([[m.id]]);
      const told = g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)!;
      expect(told.data).toMatchObject({ msg: msg('alliance.event.removed', { name: m.name, actor: officer.name }) });
      expect(told.playerIds.toSorted((x, y) => x - y)).toEqual([a.host.id, officer.id].toSorted((x, y) => x - y));
      await alliance.invite(g, a.host.id, m.name);
      await expectRefused(alliance.acceptInvite(g, m.id, a.name), msg('alliance.rejoinCooldown', { count: BALANCE.allianceRejoinCooldownHours }));
    }));

  it('rejects kicking yourself, an equal or higher rank, or someone not in the alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m1 = await addMember(g, a);
      const m2 = await addMember(g, a);
      const other = await createTestAlliance(g);
      const outsider = await createTestPlayer(g);
      await expectRefused(alliance.kick(g, outsider.id, m1.name), msg('alliance.notMember'));
      await expectRefused(alliance.kick(g, m1.id, m1.name), msg('alliance.kickSelf'));
      await expectRefused(alliance.kick(g, m1.id, m2.name), msg('alliance.kickHigherRank'));
      await expectRefused(alliance.kick(g, m1.id, a.host.name), msg('alliance.kickHigherRank'));
      await expectRefused(alliance.kick(g, a.host.id, other.host.name), msg('alliance.memberNotFound'));
      await expectRefused(alliance.kick(g, a.host.id, 'Nobody Here'), msg('alliance.memberNotFound'));
    }));
});

describe(alliance.massMail.name, () => {
  it('mails every other member, from the sender', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const officer = await addMember(g, a, AllianceRank.OFFICER);
      const m = await addMember(g, a);
      const outsider = await createTestPlayer(g);
      await alliance.massMail(g, officer.id, 'Muster', 'At dawn.');
      for (const p of [a.host, m]) {
        const [mailRow] = (await mail.listMail(g, p.id, MailType.INBOX, 1, 10)).mails;
        expect(mailRow).toMatchObject({ title: '[Alliance] Muster', sender: officer.name, playerId: officer.id });
        expect((await mail.readMail(g, p.id, mailRow!.mailid)).content).toBe('At dawn.');
      }
      expect((await mail.listMail(g, officer.id, MailType.INBOX, 1, 10)).mails).toEqual([]);
      expect((await mail.listMail(g, outsider.id, MailType.INBOX, 1, 10)).mails).toEqual([]);
    }));

  it('needs Officer or above', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      const outsider = await createTestPlayer(g);
      await expectRefused(alliance.massMail(g, m.id, 't', 'c'), msg('alliance.rankTooLow'));
      await expectRefused(alliance.massMail(g, outsider.id, 't', 'c'), msg('alliance.notMember'));
    }));
});
