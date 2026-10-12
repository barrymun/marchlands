import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { AllianceRank, BALANCE, HOUR, msg } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { players } from '@marchlands/db';
import { alliance } from '#/index.ts';
import { addMember, allianceRow, createTestAlliance, withEmbassy } from '#test/support/alliance.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, reloadCity, reloadPlayer, setResources } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

/** createAlliance's name limits (not exported). */
const NAME_MIN = 2;
const NAME_MAX = 20;
const nameWhat = msg('alliance.name');

describe(alliance.createAlliance.name, () => {
  it('founds the alliance with the player as Host, for the creation gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setResources(g, p, { gold: BALANCE.allianceCreateGold + 7 });
      const res = await alliance.createAlliance(g, p.id, p.cityId, '  Iron Order ');
      expect(res.msg).toEqual(msg('alliance.event.created', { name: 'Iron Order' }));

      expect((await reloadCity(g, p.cityId)).gold).toBe(7);
      expect(g._stats.get(`${p.id}|${p.cityId}`)).toMatchObject({ 'spent.other.gold': BALANCE.allianceCreateGold });
      expect(await allianceRow(g, res.id)).toMatchObject({
        name: 'Iron Order',
        founderName: p.name,
        leaderPlayerId: p.id,
        maxMembers: BALANCE.allianceMaxMembers,
        memberCount: 1,
        createdAt: g.now,
      });
      expect(await reloadPlayer(g, p)).toMatchObject({ allianceId: res.id, allianceRank: AllianceRank.HOST, allianceJoinedAt: g.now });
      expect(await alliance.events(g, p.id)).toEqual([{ message: msg('alliance.event.created', { name: 'Iron Order' }), time: g.now }]);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE).at(-1)).toEqual({
        playerIds: [p.id],
        cmd: PushCmd.SYSTEM_INFO_MESSAGE,
        data: { alliance: true, tV: false, noSenderSystemInfo: false, msg: msg('alliance.event.created', { name: 'Iron Order' }) },
      });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)?.playerIds).toEqual([p.id]);
    }));

  it('accepts letters of any script, digits, spaces and _ . -', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setResources(g, p, { gold: BALANCE.allianceCreateGold });
      const { id } = await alliance.createAlliance(g, p.id, p.cityId, 'Ördnung_1.-ä');
      expect((await allianceRow(g, id)).name).toBe('Ördnung_1.-ä');
    }));

  it('rejects a name that is too short, too long, has other characters or a bad word', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setResources(g, p, { gold: BALANCE.allianceCreateGold });
      const length = msg('common.nameLength', { what: nameWhat, min: NAME_MIN, max: NAME_MAX });
      await expectRefused(alliance.createAlliance(g, p.id, p.cityId, '  A  '), length);
      await expectRefused(alliance.createAlliance(g, p.id, p.cityId, 'x'.repeat(NAME_MAX + 1)), length);
      await expectRefused(alliance.createAlliance(g, p.id, p.cityId, 'Bad!Name'), msg('common.nameInvalid', { what: nameWhat }));
      await expectRefused(alliance.createAlliance(g, p.id, p.cityId, 'Shitty Order'), msg('common.nameNotAllowed'));
      expect((await reloadCity(g, p.cityId)).gold).toBe(BALANCE.allianceCreateGold);
    }));

  it('rejects a name already taken, ignoring case', () =>
    game(async (g) => {
      await createTestAlliance(g, { name: 'Iron Order' });
      const p = await createTestPlayer(g);
      await setResources(g, p, { gold: BALANCE.allianceCreateGold });
      const err = await expectRefused(alliance.createAlliance(g, p.id, p.cityId, 'IRON ORDER'), msg('alliance.nameTaken', { name: 'IRON ORDER' }));
      expect(err.code).toBe(-12);
    }));

  it('rejects a player already in an alliance, without enough gold, or with a city not theirs', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await setResources(g, a.host, { gold: BALANCE.allianceCreateGold });
      await expectRefused(alliance.createAlliance(g, a.host.id, a.host.cityId, 'Second Order'), msg('alliance.alreadyMember'));

      const p = await createTestPlayer(g);
      await setResources(g, p, { gold: BALANCE.allianceCreateGold - 1 });
      await expectRefused(alliance.createAlliance(g, p.id, p.cityId, 'Poor Order'), msg('common.notEnoughGold'));
      await expectRefused(alliance.createAlliance(g, p.id, a.host.cityId, 'Thief Order'), msg('common.invalidCastle'));
      expect(await reloadPlayer(g, p)).toMatchObject({ allianceId: null });
    }));
});

describe(alliance.setInfo.name, () => {
  it('sets the note, intro and message of the day, leaving out what is not given', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const vice = await addMember(g, a, AllianceRank.VICE_HOST);
      await alliance.setInfo(g, a.host.id, { note: 'N', intro: 'I', motd: 'M' });
      await alliance.setInfo(g, vice.id, { motd: 'New' });
      expect(await allianceRow(g, a.id)).toMatchObject({ note: 'N', intro: 'I', motd: 'New' });
    }));

  it('cuts the note and intro to 2000 characters and the message of the day to 500', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await alliance.setInfo(g, a.host.id, { note: 'n'.repeat(2001), intro: 'i'.repeat(2500), motd: 'm'.repeat(501) });
      const row = await allianceRow(g, a.id);
      expect([row.note.length, row.intro.length, row.motd.length]).toEqual([2000, 2000, 500]);
    }));

  it('needs Vice Host or above', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const presbyter = await addMember(g, a, AllianceRank.PRESIDENT);
      const outsider = await createTestPlayer(g);
      await expectRefused(alliance.setInfo(g, presbyter.id, { note: 'x' }), msg('alliance.rankTooLow'));
      await expectRefused(alliance.setInfo(g, outsider.id, { note: 'x' }), msg('alliance.notMember'));
    }));
});

describe(alliance.leaveAlliance.name, () => {
  it('a member leaves: the rest are told, and the leaver remembers the alliance for the rejoin cooldown', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      g._pushes.length = 0;
      await alliance.leaveAlliance(g, m.id);

      const p = await reloadPlayer(g, m);
      expect(p).toMatchObject({ allianceId: null, allianceRank: 0 });
      expect(p.misc).toMatchObject({ lastAllianceLeftAt: g.now, lastAllianceLeftId: a.id });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).map((x) => x.playerIds)).toEqual([[m.id]]);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE)).toEqual([
        {
          playerIds: [a.host.id],
          cmd: PushCmd.SYSTEM_INFO_MESSAGE,
          data: { alliance: true, tV: false, noSenderSystemInfo: true, msg: msg('alliance.event.left', { name: m.name }) },
        },
      ]);
      expect(await allianceRow(g, a.id)).toBeDefined();
    }));

  it('the rejoin cooldown applies to the alliance left only, and ends', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const other = await createTestAlliance(g);
      const m = await addMember(g, a);
      await alliance.leaveAlliance(g, m.id);
      const cooldown = msg('alliance.rejoinCooldown', { count: BALANCE.allianceRejoinCooldownHours });
      const err = await expectRefused(alliance.apply(g, m.id, a.name), cooldown);
      expect(err.code).toBe(-301);
      await alliance.apply(g, m.id, other.name);

      g.advance(BALANCE.allianceRejoinCooldownHours * HOUR - 1);
      await expectRefused(alliance.apply(g, m.id, a.name), cooldown);
      g.advance(1);
      await alliance.apply(g, m.id, a.name);
      expect(await alliance.myApplication(g, m.id)).toEqual({ allianceName: a.name, applyTime: g.now });
    }));

  it('the last member leaving disbands the alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const applicant = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, applicant.id, a.name);
      await alliance.leaveAlliance(g, a.host.id);
      expect(await allianceRow(g, a.id)).toBeUndefined();
      expect(await reloadPlayer(g, a.host)).toMatchObject({ allianceId: null, allianceRank: 0 });
      expect(await alliance.myAlliance(g, a.host.id)).toBeNull();
      await expectRefused(alliance.allianceInfo(g, a.name), msg('alliance.namedNotFound', { name: a.name }));
    }));

  it("a disbanded alliance's applicants no longer show an application to it", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const applicant = await withEmbassy(g, await createTestPlayer(g));
      await alliance.apply(g, applicant.id, a.name);
      await alliance.leaveAlliance(g, a.host.id);
      expect(await alliance.myApplication(g, applicant.id)).toEqual({ allianceName: null, applyTime: null });
    }));

  it('a Host must hand over first while others remain', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await addMember(g, a);
      await expectRefused(alliance.leaveAlliance(g, a.host.id), msg('alliance.hostMustTransfer'));
      expect(await reloadPlayer(g, a.host)).toMatchObject({ allianceId: a.id, allianceRank: AllianceRank.HOST });
    }));

  it('a forced Host exit promotes the highest ranked member, then the one with most prestige', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await addMember(g, a, AllianceRank.PRESIDENT);
      const heir = await addMember(g, a, AllianceRank.PRESIDENT);
      await addMember(g, a, AllianceRank.OFFICER);
      await g.tx.update(players).set({ prestige: 1000 }).where(eq(players.id, heir.id));

      g.advance(1000);
      await alliance.leaveAlliance(g, a.host.id, { force: true });
      expect(await reloadPlayer(g, heir)).toMatchObject({ allianceRank: AllianceRank.HOST });
      expect(await allianceRow(g, a.id)).toMatchObject({ leaderPlayerId: heir.id });
      expect(await reloadPlayer(g, a.host)).toMatchObject({ allianceId: null });
      expect((await alliance.events(g, heir.id))[0].message).toEqual(msg('alliance.event.left', { name: a.host.name }));
    }));

  it('rejects a player in no alliance', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(alliance.leaveAlliance(g, p.id), msg('alliance.notMember'));
    }));
});
